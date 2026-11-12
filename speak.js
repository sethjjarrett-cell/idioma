/* Reading Spanish aloud, with the voice the phone already has.

   The browser's speech synthesis, which costs nothing, needs no network and
   works offline on an iPhone. The quality is whatever the device ships: on an
   iPhone a good Mexican or Spanish voice, on a laptop usually Google's. There
   is rarely a Colombian voice anywhere, so the order below goes Colombian,
   then Latin American, then any Spanish, and Spain's last: a Mexican accent
   is a far better model for Bogotá than a Madrid one.

   No DOM here beyond the speech API itself. app.js decides when to speak and
   what; this file decides how.

   Two browser habits shape it:
   - Safari can drop an utterance that is garbage-collected mid-sentence and
     never fire its end event, so the one being spoken is kept in `current`.
   - The voice list arrives late in some browsers, after a voiceschanged
     event, so it is read again when that fires rather than once at load.

   And three that made Listen silent on an iPhone:
   - Stopping one utterance and starting the next in the same breath (cancel
     then speak) often loses the new one in Safari, and Chrome now and then.
     So after a cancel the next one waits a moment before it is handed over.
   - iOS only lets a page speak once a tap has unlocked it. The first tap
     anywhere says nothing, silently, which is what unlocks it; after that a
     short wait before speaking no longer loses the permission.
   - A voice the phone lists but has not downloaded, or an engine that has
     stuck, takes the utterance and never starts it. If nothing has started
     within a second and a half it is tried once more on the language alone,
     and if that does not start either, `onSilent` says so, so the page can
     tell the learner instead of leaving them tapping at nothing. */
(function () {
  "use strict";

  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const supported = !!(synth && Utterance);

  /* A little under normal speed for everyday listening, and properly slow for
     the second go. 1 is the voice's own pace, which on most phones is quicker
     than a learner can follow. */
  const RATE = 0.85;
  const RATE_SLOW = 0.55;

  // Most wanted first. Compared lower case, with an underscore read as a
  // hyphen, since Android writes es_CO.
  const PREFER = ["es-co", "es-419", "es-us", "es-mx"];

  let voices = [];
  const load = () => {
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  };
  if (supported) {
    load();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", load);
    else synth.onvoiceschanged = load;
  }

  const langOf = (v) => String((v && v.lang) || "").replace("_", "-").toLowerCase();
  const spanish = () => voices.filter((v) => langOf(v).startsWith("es"));

  /* The best Spanish voice there is, or null. Within a locale, a voice that
     runs on the device beats one that needs the network, because the network
     is exactly what a phone on a bus does not have. */
  function pickVoice() {
    const es = spanish();
    if (!es.length) return null;
    const best = (list) => list.find((v) => v.localService) || list[0];
    for (const want of PREFER) {
      const here = es.filter((v) => langOf(v) === want);
      if (here.length) return best(here);
    }
    const notSpain = es.filter((v) => langOf(v) !== "es-es");
    return best(notSpain.length ? notSpain : es);
  }

  let current = null;

  // The tap that unlocks speech on iOS: an utterance at no volume, said once.
  let unlocked = false;
  function unlock() {
    if (unlocked || !supported) return;
    unlocked = true;
    try {
      const u = new Utterance(" ");
      u.volume = 0;
      synth.speak(u);
    } catch (e) { /* nothing to unlock */ }
    for (const t of ["pointerdown", "touchend", "keydown"]) document.removeEventListener(t, unlock, true);
  }
  if (supported && typeof document !== "undefined") {
    for (const t of ["pointerdown", "touchend", "keydown"]) document.addEventListener(t, unlock, true);
  }

  const START_WAIT = 1500;   // how long an utterance may take to begin
  const AFTER_CANCEL = 120;  // the pause after stopping, before the next

  const tidy = (text) => String(text == null ? "" : text)
    .replace(/[{}]/g, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();

  function utterance(text, voice, options) {
    const u = new Utterance(text);
    if (voice) u.voice = voice;
    // Set even with no voice found: given a language, most browsers pick a
    // Spanish voice of their own rather than reading it out in English.
    u.lang = voice ? voice.lang : "es-CO";
    u.rate = options.slow ? RATE_SLOW : RATE;
    return u;
  }

  /* Hand an utterance over, waiting first if something had to be stopped,
     and watch that it actually starts. */
  /* Bumped by every new request, so a retry or a silence report from an
     older one never acts once something newer has been asked for. Not
     `current`, which an engine clears on its own when it errors or is
     cancelled. */
  let generation = 0;

  function speakWatched(make, options, attempt, gen = ++generation) {
    const u = make(attempt);
    let started = false;
    const onstart = u.onstart;
    u.onstart = (e) => { started = true; if (onstart) onstart(e); };
    const go = () => {
      try {
        if (synth.paused) synth.resume();
        current = u;
        synth.speak(u);
      } catch (e) { /* reported below as silence */ }
      setTimeout(() => {
        if (started || gen !== generation) return;
        try { synth.cancel(); } catch (e) { /* nothing to stop */ }
        // The retry waits after the cancel too, or it is dropped the same way.
        if (attempt === 0) setTimeout(() => { if (gen === generation) speakWatched(make, options, 1, gen); }, AFTER_CANCEL);
        else if (options.onSilent) options.onSilent();
      }, START_WAIT);
    };
    let busy = false;
    try { busy = synth.speaking || synth.pending; } catch (e) { busy = false; }
    if (busy) {
      try { synth.cancel(); } catch (e) { /* nothing to stop */ }
      setTimeout(go, AFTER_CANCEL);
    } else {
      go();
    }
  }

  /* Say it. Returns whether anything was handed to the voice, which is not
     the same as anything being heard: a phone on silent or at no volume says
     yes here and stays quiet, and there is no way for a page to know. */
  function say(text, options = {}) {
    if (!supported) return false;
    // Braces are the bank's mark for the word a sentence is teaching, and a
    // run of underscores is a cloze blank. Neither is meant to be read out.
    const clean = tidy(text);
    if (!clean) return false;
    if (!voices.length) load();
    try {
      speakWatched((attempt) => {
        // The second try leaves the voice to the browser: the one picked may
        // be listed and not actually there.
        const u = utterance(clean, attempt === 0 ? pickVoice() : null, options);
        u.onend = u.onerror = () => { if (current === u) current = null; };
        return u;
      }, options, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Several lines one after another, as a conversation: the voice's own
     queue does the waiting. `onLine(i)` fires as line i starts and `onDone`
     after the last, so the page can follow along. Stops whatever was playing
     first, like say. */
  function sayAll(texts, options = {}) {
    if (!supported || !texts.length) return false;
    if (!voices.length) load();
    try {
      const queue = () => {
        const voice = pickVoice();
        texts.forEach((text, i) => {
          const u = utterance(tidy(text), voice, options);
          u.onstart = () => { if (options.onLine) options.onLine(i); };
          if (i === texts.length - 1) u.onend = u.onerror = () => { if (options.onDone) options.onDone(); };
          if (i === 0) current = u;
          synth.speak(u);
        });
      };
      generation++;
      let busy = false;
      try { busy = synth.speaking || synth.pending; } catch (e) { busy = false; }
      if (busy) { synth.cancel(); setTimeout(queue, AFTER_CANCEL); } else queue();
      return true;
    } catch (e) {
      return false;
    }
  }

  function stop() {
    if (!supported) return;
    generation++;
    try { synth.cancel(); } catch (e) { /* nothing to stop */ }
    current = null;
  }

  /* What the menu shows, so "it sounds English" has an answer to point at. */
  function voiceName() {
    const v = pickVoice();
    return v ? `${v.name} (${v.lang})` : "";
  }

  /* Whether the device has said what voices it has. An empty list early on
     means "not yet", not "none", so a missing Spanish voice is only reported
     once there is a list to be missing from. */
  const voicesKnown = () => voices.length > 0;
  const hasSpanishVoice = () => spanish().length > 0;

  window.Speech = { supported, say, sayAll, stop, voiceName, voicesKnown, hasSpanishVoice,
    RATE, RATE_SLOW, pickVoice, reload: load, START_WAIT, AFTER_CANCEL };
})();
