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
     event, so it is read again when that fires rather than once at load. */
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

  /* Say it. Returns whether anything was handed to the voice, which is not
     the same as anything being heard: a phone on silent or at no volume says
     yes here and stays quiet, and there is no way for a page to know. */
  function say(text, options = {}) {
    if (!supported) return false;
    // Braces are the bank's mark for the word a sentence is teaching, and a
    // run of underscores is a cloze blank. Neither is meant to be read out.
    const clean = String(text == null ? "" : text)
      .replace(/[{}]/g, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return false;
    try {
      // Anything still playing is from the last card and is stopped, so two
      // taps never talk over each other.
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new Utterance(clean);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      // Set even with no voice found: given a language, most browsers pick a
      // Spanish voice of their own rather than reading it out in English.
      u.lang = voice ? voice.lang : "es-CO";
      u.rate = options.slow ? RATE_SLOW : RATE;
      u.onend = u.onerror = () => { if (current === u) current = null; };
      current = u;
      synth.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stop() {
    if (!supported) return;
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

  window.Speech = { supported, say, stop, voiceName, voicesKnown, hasSpanishVoice,
    RATE, RATE_SLOW, pickVoice, reload: load };
})();
