/* UI wiring: three screens over the engine and the store.

   Nothing here decides anything about mastery; it asks Engine for a card,
   hands the result back, and draws what comes out. Keeping the rules out
   of the view is what makes the rules easy to change later.
*/

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loaded = Store.load();
  let state = loaded.state;

  /* Round state lives in memory only; an interrupted round is not worth
     persisting, and the per-word progress behind it already is. */
  let round = null;
  let card = null;
  let lastResult = null;

  /* The word's progress as it stood when the card was drawn. Every grade
     is applied to this rather than to whatever the last grade left, so
     answering again, fixing a near miss and overriding a wrong answer all
     land on exactly the progress that answer would have produced first
     time. Re-grading used to unpick its own arithmetic by hand, which
     could not restore a streak it had already zeroed. */
  let cardBefore = null;
  let retypes = 0;

  /* Which cards want Spanish typed back, and so get the accent keys. It is a
     property of the band: recognition asks for English, and every other
     band with an answer box asks for Spanish. */
  const SPANISH_BACK = new Set(["production", "cloze", "translate", "drill", "listen"]);

  /* What the next round will be drawn from. null is the whole bank; a topic
     narrows the pool; a drill replaces the pool with conjugations and is not
     word practice at all. */
  let pick = null;

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */

  let toastTimer = null;
  function toast(message, bad) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("bad", !!bad);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const words = () => Store.allWords(state);
  const sentences = () => Store.allSentences(state);
  // Reads go through peek so that merely drawing a screen never creates a
  // progress row; only answering a card or toggling a word writes one.
  const prog = (id) => Store.peekProgress(state, id);
  const progWrite = (id) => Store.progressFor(state, id);

  /* Sentences keep a separate book, so which one a card writes to is a
     property of the card rather than of the id. Everything that touches
     progress goes through these two, and nothing else needs to know. */
  /* Which language the answer is in. Recognition shows the Spanish and wants
     the English; everything else wants the Spanish. */
  const askedFor = (c) => (c && c.band.key === "recognition" ? "en" : "es");

  const bookPeek = (c) => (c && c.isSentence ? Store.peekPhrase : Store.peekProgress);
  const bookWrite = (c) => (c && c.isSentence ? Store.phraseProgressFor : Store.progressFor);
  const cardProgress = (c) => bookPeek(c)(state, c.word.id);

  /* What a round is made of. Kept in settings so the choice survives a
     reload: picking Sentences and then coming back to Words every time would
     be its own small annoyance. */
  // Listening needs a voice. Without one the mode is not offered at all, and
  // a saved choice of it falls back to words like any unknown mode does.
  const MODES = ["words", "verbs", "sentences", "grammar"].concat(Speech.supported ? ["listen"] : []);
  const mode = () => (MODES.includes(state.settings.mode) ? state.settings.mode : "words");
  const sentencesFor = (wordId) => sentences().filter((s) => s.wordId === wordId);
  const commit = () => Store.save(state);

  function accuracy(p) {
    const n = p.totalCorrect + p.totalWrong;
    return n ? Math.round((p.totalCorrect / n) * 100) : null;
  }

  /* An id that stays readable in the JSON, since the file is meant to be
     hand-edited. Falls back to a counter if the slug is taken. */
  function makeWordId(es) {
    const base = Engine.normalise(es).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "word";
    const taken = new Set(words().map((w) => w.id));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  }
  function makeSentenceId() {
    const taken = new Set(sentences().map((s) => s.id));
    let n = sentences().length + 1;
    let id = `c${String(n).padStart(3, "0")}`;
    while (taken.has(id)) { n++; id = `c${String(n).padStart(3, "0")}`; }
    return id;
  }

  /* ------------------------------------------------------------------
     Screens
     ------------------------------------------------------------------ */

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("on"));
    $("screen-" + name).classList.add("on");
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.screen === name));
    if (name === "manage") renderBank();
    if (name === "progress") renderProgress();
    if (name === "topics") renderTopics();
    if (name === "lessons") renderLessons();
  }

  $("tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) showScreen(tab.dataset.screen);
  });

  /* ------------------------------------------------------------------
     Theme

     Paper by default, whatever the operating system prefers; dark is a
     choice made here. Kept in its own localStorage key rather than in the
     synced settings, because which theme suits a phone at night is not which
     theme suits a laptop at noon, and the sync merge would have two devices
     overwriting each other's answer every time they met.

     The attribute is also set by a four-line script in the head, which is
     what stops a dark-mode user seeing a white flash on every load; this is
     only what happens when the toggle moves.
     ------------------------------------------------------------------ */

  const THEME_KEY = "idioma.theme.v1";
  const PAPER = "#efe3c8";
  const OLIVE = "#24241a";

  function loadTheme() {
    try { return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "paper"; }
    catch (e) { return "paper"; }
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    const root = document.documentElement;
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    // So the browser chrome on a phone matches the page rather than fighting it.
    const meta = $("theme-colour");
    if (meta) meta.setAttribute("content", dark ? OLIVE : PAPER);
    try { window.localStorage.setItem(THEME_KEY, dark ? "dark" : "paper"); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------------
     Reading aloud

     The phone's own Spanish voice, through speak.js. Whether it reads things
     out unasked is a per-device choice, kept out of the synced settings for
     the same reason the theme is: the laptop at a desk and the phone on a bus
     want different answers.

     One rule for when: Spanish is read once, when it first appears. A card
     that shows Spanish reads it as the card arrives; a card that asks for
     Spanish reads the answer at the verdict, never before, because reading it
     out first would be giving it away.
     ------------------------------------------------------------------ */

  const AUDIO_KEY = "idioma.audio.v1";
  function loadAudio() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUDIO_KEY) || "{}");
      return { auto: saved.auto !== false };
    } catch (e) {
      return { auto: true };
    }
  }
  let audio = loadAudio();
  const saveAudio = () => {
    try { window.localStorage.setItem(AUDIO_KEY, JSON.stringify(audio)); } catch (e) { /* private mode */ }
  };

  const say = (text, slow) => Speech.say(text, { slow: !!slow });
  const autoSay = (text) => { if (audio.auto) say(text); };

  const SPEAKER = '<svg aria-hidden="true" focusable="false"><use href="#speaker-sym"/></svg>';
  const sayButton = (text, label) => (Speech.supported && text
    ? `<button class="say-btn" type="button" data-say="${esc(text)}" aria-label="${esc(label || "Hear it")}">${SPEAKER}</button>`
    : "");
  // Only where tapping will do something; a pointer over a table cell that
  // stays silent is a thing that looks broken.
  const sayAttr = (text) => (Speech.supported && text ? ` data-say="${esc(text)}"` : "");

  /* The Spanish a card is about, whichever side of it the Spanish is on. A
     cloze card reads the whole sentence rather than the one word, because the
     sentence is what a learner needs to hear the word inside. */
  function spanishOf(c) {
    if (!c) return "";
    if (c.band.key === "cloze") return c.revealContext;
    if (c.intro || c.band.key === "recognition") return c.word.es;
    return c.reveal;
  }

  /* The Spanish showing on the card before it is answered, if any: the word on
     a recognition or teaching card, the infinitive on a drill. Never the
     prompt of a card that asks for Spanish, which would answer it. */
  function spanishPrompt(c) {
    if (c.listen || c.grammar) return "";
    if (c.intro || c.band.key === "recognition") return c.word.es;
    if (c.drill) return c.prompt;
    return "";
  }

  /* Anything marked data-say reads itself when tapped: the buttons on the
     card, the lesson tables, the pronunciation examples. One listener for all
     of them, so a new place to hear something is one attribute. */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-say]");
    if (el) say(el.dataset.say, el.dataset.slow === "1");
  });
  /* A speaker tapped while typing must not take the focus off the box, or on a
     phone the keyboard folds away every time. Same trick as the accent keys:
     cancel the press, keep the click. */
  for (const type of ["pointerdown", "mousedown"]) {
    document.addEventListener(type, (e) => {
      if (e.target.closest(".say-btn, #listen .btn")) e.preventDefault();
    });
  }

  /* ------------------------------------------------------------------
     Tap a word

     Any word in a Spanish sentence on a card can be tapped for what it means.
     The answer comes from the bank itself, through the same index that
     decides when a sentence is ready, so it costs nothing and works offline:
     tengo is found as tener, casas as casa, bonita as bonito.

     Not on a card that is asking for the meaning: tapping the word on a
     recognition card would answer it. So the taps go where the Spanish is
     context rather than the question: the teaching card's example, a cloze
     sentence around its blank, and the answer once it is shown.
     ------------------------------------------------------------------ */

  /* The grammar words the bank treats as free. Not vocabulary to be tested,
     but a learner tapping one still wants to know what it is doing there. */
  const GRAMMAR_WORDS = {
    el: "the", la: "the", los: "the", las: "the",
    un: "a, an", una: "a, an", unos: "some", unas: "some",
    del: "of the: de and el run together", al: "to the: a and el run together",
    lo: "it, or the before an adjective: lo bueno, the good thing",
    que: "that, which, who; and than after más",
  };

  /* Which form of a verb this is, as English: tengo is "I have, present".
     Only forms the tables actually produce, and a verb ending in se is looked
     up without it, since the tables conjugate llamar, not llamarse. */
  function verbFormOf(word, token) {
    const base = /se$/.test(word.es) && word.es.length > 4 ? word.es.slice(0, -2) : word.es;
    const gloss = (word.en && word.en[0]) || "";
    for (const t of Verbs.VERBS.tenses) {
      for (const p of Verbs.VERBS.persons) {
        let form = null;
        try { form = Verbs.conjugate(base, t.id, p.id); } catch (e) { form = null; }
        if (form && Engine.wordToken(form) === token) {
          let english = null;
          try { english = Verbs.englishPhrase(gloss, p.id, t.id); } catch (e) { english = null; }
          return english ? `${english} \u00b7 ${t.name.toLowerCase()}` : `${p.label}, ${t.name.toLowerCase()}`;
        }
      }
    }
    return null;
  }

  /* What a tapped word means, or null when the bank has never heard of it,
     which is mostly names of places and people. */
  function glossFor(token) {
    const forms = Store.sentenceIndex(state).forms;
    const id = Engine.wordForToken(token, forms);
    if (!id) return null;
    if (id === Engine.FREE_TOKEN) {
      return GRAMMAR_WORDS[token] ? { es: token, en: GRAMMAR_WORDS[token], form: "", id: null } : null;
    }
    const word = words().find((w) => w.id === id);
    if (!word) return null;
    let form = "";
    if (Engine.wordToken(word.es) !== token && !word.es.includes(" ")) {
      form = word.pos === "verb"
        ? (verbFormOf(word, token) || `a form of ${word.es}`)
        : `a form of ${word.es}`;
    }
    // A word met inside a set phrase: say which phrase, so "cuesta" is not
    // explained as "how much does it cost?" with no warning.
    if (word.es.includes(" ")) form = `part of ${word.es}`;
    return { es: word.es, en: word.en.join(", "), form, id: word.id };
  }

  /* A Spanish string as markup with every word tappable. Punctuation and the
     cloze blank stay plain. `mark` is the part to pick out in bold, as the
     teaching card does with the word it is teaching. */
  function tappable(es, mark) {
    const marked = new Set(mark ? Engine.tokenise(mark) : []);
    return String(es == null ? "" : es).split(/(\s+)/).map((chunk) => {
      if (!chunk.trim()) return chunk;
      const m = chunk.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}'][\p{L}\p{N}'\-]*)([^\p{L}\p{N}]*)$/u);
      // No word in it: punctuation, or the cloze blank, which may have a full
      // stop or a question mark stuck to it.
      if (!m) return esc(chunk).replace(/_{3,}/, (b) => `<span class="blank">${b}</span>`);
      const [, before, word, after] = m;
      const token = Engine.wordToken(word);
      const inner = `<span class="tap" data-tok="${esc(token)}">${esc(word)}</span>`;
      return esc(before) + (marked.has(token) ? `<b>${inner}</b>` : inner) + esc(after);
    }).join("");
  }

  function closeGloss() {
    $("gloss").hidden = true;
    document.querySelectorAll(".tap.on").forEach((t) => t.classList.remove("on"));
  }

  /* Open under the word, not at the foot of the screen: on a phone with the
     keyboard up the foot of the screen is the keyboard. Clamped to the page
     width so it never runs off the side. */
  function openGloss(el) {
    const token = el.dataset.tok;
    const g = glossFor(token);
    const box = $("gloss");
    document.querySelectorAll(".tap.on").forEach((t) => t.classList.remove("on"));
    el.classList.add("on");
    $("gloss-es").textContent = g ? g.es : el.textContent;
    $("gloss-en").textContent = g ? g.en : "Not in the word list yet.";
    $("gloss-en").classList.toggle("muted", !g);
    $("gloss-form").textContent = g && g.form ? g.form : "";
    $("gloss-form").hidden = !(g && g.form);
    $("gloss-say").dataset.say = el.textContent;
    $("gloss-say").hidden = !Speech.supported;
    box.hidden = false;
    const r = el.getBoundingClientRect();
    const width = box.offsetWidth;
    const left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - width - 8));
    box.style.left = `${left}px`;
    box.style.top = `${r.bottom + window.scrollY + 6}px`;
    autoSay(el.textContent);
  }

  document.addEventListener("click", (e) => {
    const tap = e.target.closest(".tap");
    if (tap) { openGloss(tap); return; }
    if (!e.target.closest("#gloss")) closeGloss();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGloss(); });
  // A tap on a word while typing a cloze answer must not fold the keyboard away.
  for (const type of ["pointerdown", "mousedown"]) {
    document.addEventListener(type, (e) => { if (e.target.closest(".tap, #gloss")) e.preventDefault(); });
  }

  /* ------------------------------------------------------------------
     Menu, settings, backup
     ------------------------------------------------------------------ */

  $("btn-menu").addEventListener("click", () => {
    const m = $("menu");
    m.hidden = !m.hidden;
    if (!m.hidden) refreshMenu();
  });

  /* The pace is a setting, so it lives in the synced state, and it is applied
     to the engine on load and whenever it changes. One decision, six numbers:
     see PACES in engine.js for what each one moves. */
  const paceName = () => (Engine.PACES[state.settings.pace] ? state.settings.pace : "steady");

  function applyPace() {
    const pace = Engine.applyPace(paceName());
    document.querySelectorAll("#set-pace .pill").forEach((b) => {
      b.classList.toggle("on", b.dataset.pace === paceName());
    });
    $("pace-blurb").textContent = pace.blurb;
    /* Brisk turns the teaching card off, and the checkbox that also turns it
       off would otherwise sit there ticked and lying. */
    $("set-introduce").disabled = Engine.CONFIG.INTRODUCE_UNTIL_SEEN === 0;
  }

  $("set-pace").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    state.settings.pace = pill.dataset.pace;
    commit();
    applyPace();
    // The round in progress was built under the old numbers.
    round = null; card = null;
    resetPracticeView();
    updateStartBlurb();
    toast(`Pace: ${Engine.PACES[paceName()].label}.`);
  });

  function refreshMenu() {
    $("set-dark").checked = loadTheme() === "dark";
    $("set-typo").checked = !!state.settings.typoTolerance;
    $("set-introduce").checked = state.settings.introduceNew !== false;
    $("set-audio").checked = Speech.supported && audio.auto;
    $("set-audio").disabled = !Speech.supported;
    $("audio-blurb").textContent = !Speech.supported
      ? "this browser cannot read Spanish aloud"
      : Speech.voicesKnown() && !Speech.hasSpanishVoice()
      ? "no Spanish voice is installed, so it may sound English; on an iPhone, add one under Settings, Accessibility, Spoken Content, Voices"
      : `when Spanish appears on a card, and with each answer; this device only${Speech.voiceName() ? ` · ${Speech.voiceName()}` : ""}. No sound? Check the volume and the silent switch`;
    $("set-round").value = state.settings.roundSize;
    applyPace();
    drawSync();
    drawGoogle();
    $("saved-at").textContent = state.savedAt
      ? `Last saved ${new Date(state.savedAt).toLocaleString("en-GB")}`
      : "Nothing saved yet.";
  }

  /* Two switches for one setting: the checkbox in the menu and the speaker
     in the header. Both go through here, so they can never disagree, and the
     choice is saved at once, so it is the same after a reload, a closed app
     or an update. Off also stops anything already being read. */
  function setAudio(on) {
    audio.auto = !!on;
    saveAudio();
    drawSoundToggle();
    $("set-audio").checked = Speech.supported && audio.auto;
    if (audio.auto) say("Hola.");
    else Speech.stop();
    toast(audio.auto
      ? "Reading Spanish aloud."
      : "Reading aloud off. The speaker buttons still work.");
  }

  function drawSoundToggle() {
    const btn = $("btn-sound");
    btn.hidden = !Speech.supported;
    btn.setAttribute("aria-pressed", audio.auto ? "true" : "false");
    btn.title = audio.auto ? "Reading Spanish aloud: tap to turn off" : "Not reading aloud: tap to turn on";
  }

  $("set-audio").addEventListener("change", (e) => setAudio(e.target.checked));
  $("btn-sound").addEventListener("click", () => setAudio(!audio.auto));

  $("set-dark").addEventListener("change", (e) => {
    applyTheme(e.target.checked ? "dark" : "paper");
    toast(e.target.checked ? "Dark mode on, on this device." : "Back to paper.");
  });

  $("set-typo").addEventListener("change", (e) => {
    state.settings.typoTolerance = e.target.checked;
    commit();
    toast(e.target.checked
      ? "Typo tolerance on; a single-letter slip will now pass."
      : "Typo tolerance off.");
  });

  $("set-introduce").addEventListener("change", (e) => {
    state.settings.introduceNew = e.target.checked;
    commit();
    toast(e.target.checked
      ? "New words will be shown once before they are tested."
      : "New words go straight to being tested.");
  });

  $("set-round").addEventListener("change", (e) => {
    const n = Math.max(1, Math.min(100, Number(e.target.value) || Engine.CONFIG.ROUND_SIZE));
    state.settings.roundSize = n;
    e.target.value = n;
    commit();
    updateStartBlurb();
  });

  $("btn-export").addEventListener("click", () => {
    Store.saveNow(state);
    Store.downloadExport(state);
    writeBackupNote({ exportedAt: new Date().toISOString() });
    toast("Backup downloaded.");
  });

  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = Store.parseImport(await file.text());
      state = next;
      Store.saveNow(state);
      round = null; card = null;
      resetPracticeView();
      refreshMenu();
      updateStartBlurb();
      toast(`Imported ${Object.keys(state.progress).length} words of progress.`);
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("btn-reset").addEventListener("click", () => {
    if (!window.confirm("Reset every level, streak and count? Words and sentences you added are kept. This cannot be undone, so export a backup first if you want one. If you are signed in to Google, the copy there is reset too.")) return;
    state.progress = {};
    state.phrases = {};
    state.stats = { rounds: 0, lastRoundAt: null };
    Store.saveNow(state);
    round = null; card = null;
    resetPracticeView();
    updateStartBlurb();
    // Merged with Drive, a reset would come straight back, so it overwrites.
    // Drive keeps the day's earlier copy as the previous file regardless.
    resets += 1;
    if (gAuth.signedIn) rememberGoogle({ ...gAuth, replaceOwed: true });
    driveSync({ quiet: true });
    toast("Progress reset.");
  });

  /* ------------------------------------------------------------------
     Sync

     All of it is optional and none of it is allowed to get in the way. Every
     failure here ends in a message in the menu and an app that carries on
     working from localStorage exactly as it would with no sync at all.
     ------------------------------------------------------------------ */

  let syncCfg = Sync.loadConfig();
  let syncing = false;

  function drawSync() {
    $("sync-url").value = syncCfg.url || "";
    $("sync-code").value = syncCfg.code || "";
    const el = $("sync-state");
    el.classList.remove("on", "bad");
    if (!Sync.configured(syncCfg)) { el.textContent = "Not set up"; return; }
    if (syncing) { el.textContent = "Syncing..."; return; }
    if (syncCfg.lastError) { el.textContent = syncCfg.lastError; el.classList.add("bad"); return; }
    el.textContent = syncCfg.lastSyncedAt
      ? `Synced ${new Date(syncCfg.lastSyncedAt).toLocaleString("en-GB")}`
      : "Ready, not synced yet";
    el.classList.add("on");
  }

  const rememberSync = (next) => { syncCfg = Sync.saveConfig(next); drawSync(); };

  /* `quiet` is for the automatic syncs, on load and after a round: they say
     nothing when they fail, because a toast about the network in the middle
     of practising is no help to anybody. The button is not quiet. */
  /* Returns whether it worked, which the pairing path needs: "paired" and
     "paired and your progress is here" are different things to be told. */
  async function doSync({ quiet = false } = {}) {
    if (!Sync.configured(syncCfg) || syncing) return false;
    syncing = true;
    drawSync();
    try {
      Store.saveNow(state);
      const merged = await Sync.run(syncCfg, state, { save: (c) => { syncCfg = c; } });
      if (merged && merged !== state) {
        state = merged;
        Store.saveNow(state);
        // Whatever came back may change every screen, so redraw the lot.
        round = null; card = null;
        resetPracticeView();
        refreshMenu(); refreshTopicSelect(); refreshWordSelect(); updateStartBlurb();
        if (!quiet) toast("Synced.");
      } else if (!quiet) {
        toast("Synced.");
      }
      rememberSync({ ...syncCfg, lastError: null });
      return true;
    } catch (e) {
      rememberSync({ ...syncCfg, lastError: e.message || "sync failed" });
      if (!quiet) toast(`Could not sync: ${e.message}`, true);
      return false;
    } finally {
      syncing = false;
      drawSync();
    }
  }

  const readSyncFields = () => rememberSync({
    ...syncCfg,
    url: $("sync-url").value.trim(),
    code: $("sync-code").value.trim().toLowerCase(),
    // A different box is a different history, so the revision cannot carry over.
    rev: 0,
    lastError: null,
  });
  $("sync-url").addEventListener("change", readSyncFields);
  $("sync-code").addEventListener("change", readSyncFields);

  $("btn-sync-now").addEventListener("click", () => {
    if (!Sync.configured(syncCfg)) { toast("Set a sync URL and a code first.", true); return; }
    doSync();
  });

  $("btn-sync-new").addEventListener("click", () => {
    if (syncCfg.code && !window.confirm("Replace the current sync code? Any other device using the old one will stop syncing with this one until you give it the new code.")) return;
    rememberSync({ ...syncCfg, code: Sync.newCode(), rev: 0, lastSyncedAt: null, lastError: null });
    toast("New code made. Put it on your other device.");
  });

  $("btn-sync-link").addEventListener("click", async () => {
    if (!Sync.configured(syncCfg)) { toast("Set the URL and a code first.", true); return; }
    const link = Sync.pairingLink(syncCfg, location.href);
    try {
      await navigator.clipboard.writeText(link);
      toast("Pairing link copied. Open it on the other device.");
    } catch (e) {
      // Clipboard access is refused often enough that it needs a fallback.
      $("sync-code").select();
      toast("Copy it from the box.", true);
    }
  });

  $("btn-sync-off").addEventListener("click", () => {
    if (!window.confirm("Stop syncing on this device? Your progress here is untouched, and what is already on the server stays there.")) return;
    rememberSync({ url: "", code: "", rev: 0, lastSyncedAt: null, lastError: null });
    toast("Syncing off.");
  });

  /* ------------------------------------------------------------------
     Google Drive

     The copy of progress that is not on this device. gdrive.js does the
     talking to Google; this decides when. Syncing happens on load, after a
     round, and on coming back to the app. The sign-in lasts an hour, and
     renewing it means a quick trip through Google that reloads the page, so
     that only ever happens between rounds.
     ------------------------------------------------------------------ */

  let gAuth = Drive.loadAuth();
  let gSyncing = false;
  /* Bumped by Reset. A sync that was already under way when the reset
     happened carries the old progress, so its answer is thrown away. The
     reset itself is owed to Drive until it has been written there, and that
     debt is saved with the sign-in, so a reset made offline or with an
     expired sign-in still lands rather than being merged away later. */
  let resets = 0;
  const rememberGoogle = (next) => { gAuth = Drive.saveAuth(next); drawGoogle(); };
  const midRound = () => !!(round && round.index < round.queue.length);

  function drawGoogle() {
    $("gsync").hidden = !Drive.configured();
    const el = $("g-state");
    el.classList.remove("on", "bad");
    $("btn-g-in").hidden = gAuth.signedIn && !gAuth.needsTap;
    $("btn-g-in").textContent = gAuth.needsTap ? "Sign in again" : "Sign in with Google";
    $("btn-g-sync").hidden = !gAuth.signedIn || gAuth.needsTap;
    $("btn-g-out").hidden = !gAuth.signedIn;
    if (!gAuth.signedIn) { el.textContent = "Not signed in"; return; }
    if (gSyncing) { el.textContent = "Syncing..."; return; }
    if (gAuth.lastError) { el.textContent = gAuth.lastError; el.classList.add("bad"); return; }
    const who = gAuth.email ? `${gAuth.email}, ` : "";
    el.textContent = gAuth.lastSyncedAt
      ? `${who}synced ${new Date(gAuth.lastSyncedAt).toLocaleString("en-GB")}`
      : `${who}not synced yet`;
    el.classList.add("on");
  }

  /* Swap in a state that came back from a sync. The one it replaces is kept
     under its own key first: if a merge ever does something wrong, the
     progress from just before it is still on the device. */
  function adopt(next) {
    try {
      window.localStorage.setItem(Store.STORAGE_KEY + ".before-sync", JSON.stringify(state));
    } catch (e) { /* full or private: the sync itself still stands */ }
    state = next;
    Store.saveNow(state);
    round = null; card = null;
    resetPracticeView();
    refreshMenu(); refreshTopicSelect(); refreshWordSelect(); updateStartBlurb();
  }

  async function driveSync({ quiet = false, replace = false } = {}) {
    if (!Drive.configured() || !gAuth.signedIn || gSyncing) return false;
    if (gAuth.replaceOwed) replace = true;
    if (!Drive.tokenValid(gAuth)) {
      if (!quiet) renewGoogle({ asked: true });
      return false;
    }
    gSyncing = true;
    const gen = resets;
    drawGoogle();
    try {
      Store.saveNow(state);
      const before = JSON.stringify(state.progress) + JSON.stringify(state.phrases);
      const merged = await Drive.run(gAuth.token, state, { replace });
      // Only redraw when something actually came down; a round's end screen
      // is worth keeping if the sync changed nothing.
      if (gen === resets
          && JSON.stringify(merged.progress) + JSON.stringify(merged.phrases) !== before) adopt(merged);
      rememberGoogle({ ...gAuth, lastSyncedAt: new Date().toISOString(), lastError: null,
        // Paid only by a replace that started after the latest reset.
        replaceOwed: gAuth.replaceOwed && !(replace && gen === resets) });
      if (!quiet) toast("Synced with Google Drive.");
      return true;
    } catch (e) {
      if (e.expired) {
        rememberGoogle({ ...gAuth, token: null, expiresAt: 0 });
      } else {
        rememberGoogle({ ...gAuth, lastError: e.message || "sync failed" });
      }
      if (!quiet) toast(`Could not sync: ${e.message}`, true);
      return false;
    } finally {
      gSyncing = false;
      drawGoogle();
      if (gAuth.replaceOwed && Drive.tokenValid(gAuth)) driveSync({ quiet: true });
    }
  }

  /* Renew an expired sign-in by going through Google and back. Automatic
     renewals are held to once every ten minutes and never mid-round, so a
     Google that keeps saying no cannot put the app in a loop. */
  function renewGoogle({ asked = false } = {}) {
    if (!Drive.configured() || !gAuth.signedIn) return;
    if (!asked) {
      if (gAuth.needsTap || midRound() || !navigator.onLine) return;
      if (Date.now() - (gAuth.lastBounce || 0) < 10 * 60 * 1000) return;
    }
    Store.saveNow(state);
    rememberGoogle({ ...gAuth, lastBounce: Date.now() });
    Drive.begin({ silent: !asked || !gAuth.needsTap, hint: gAuth.email });
  }

  /* Back from Google, or an ordinary load. */
  function startGoogle() {
    const back = Drive.readReturn(location.hash);
    if (back) {
      history.replaceState(null, "", location.pathname + location.search);
      if (back.ignored) {
        if (Drive.tokenValid(gAuth)) driveSync({ quiet: true });
        return;
      }
      if (back.error) {
        // A silent renewal Google would not do: it needs a tap now.
        if (gAuth.signedIn) rememberGoogle({ ...gAuth, needsTap: true, token: null, expiresAt: 0 });
        if (!back.silent) toast("Google sign-in did not finish.", true);
        return;
      }
      rememberGoogle({
        ...gAuth, signedIn: true, needsTap: false, lastError: null, token: back.token,
        // A minute early, so a sync never starts on a token about to lapse.
        expiresAt: Date.now() + (back.expiresIn - 60) * 1000,
      });
      Drive.email(back.token).then((email) => rememberGoogle({ ...gAuth, email })).catch(() => {});
      driveSync({ quiet: true }).then((worked) => {
        if (back.silent) return;
        toast(worked
          ? "Signed in. Your progress is now kept in Google Drive."
          : "Signed in, but the first sync failed. Try Sync now from the menu.", !worked);
      });
      return;
    }
    if (Drive.tokenValid(gAuth)) driveSync({ quiet: true });
    else renewGoogle();
  }

  $("btn-g-in").addEventListener("click", () => {
    if (!navigator.onLine) { toast("You are offline. Sign in when you have signal.", true); return; }
    Store.saveNow(state);
    Drive.begin({ silent: false, hint: gAuth.email });
  });
  $("btn-g-sync").addEventListener("click", () => driveSync());
  $("btn-g-out").addEventListener("click", () => {
    if (!window.confirm("Sign out of Google on this device? Your progress here stays, and so does the copy in Google Drive.")) return;
    Drive.revoke(gAuth.token);
    rememberGoogle({ ...Drive.loadAuth(), signedIn: false, token: null, expiresAt: 0, email: "",
      lastSyncedAt: null, lastError: null, needsTap: false });
    toast("Signed out of Google.");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !gAuth.signedIn) return;
    if (Drive.tokenValid(gAuth)) {
      // Coming back to the app is when another device may have moved on.
      if (!midRound() && Date.now() - new Date(gAuth.lastSyncedAt || 0) > 5 * 60 * 1000) {
        driveSync({ quiet: true });
      }
    } else {
      renewGoogle();
    }
  });

  /* ------------------------------------------------------------------
     Nothing backing it up

     Progress that exists on one device and nowhere else is one deleted icon
     from gone. Once there is enough to lose, and at most once a week, say so.
     ------------------------------------------------------------------ */

  const BACKUP_KEY = "idioma.backup.v1";
  const readBackupNote = () => {
    try { return JSON.parse(window.localStorage.getItem(BACKUP_KEY) || "{}"); } catch (e) { return {}; }
  };
  const writeBackupNote = (patch) => {
    try { window.localStorage.setItem(BACKUP_KEY, JSON.stringify({ ...readBackupNote(), ...patch })); } catch (e) { /* private */ }
  };
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  function maybeNudgeBackup() {
    if (gAuth.signedIn || Sync.configured(syncCfg)) return;
    if (Drive.amount(state) < 10) return;
    const note = readBackupNote();
    const since = (t) => Date.now() - new Date(t || 0).getTime();
    if (since(note.exportedAt) < WEEK || since(note.nudgedAt) < WEEK) return;
    writeBackupNote({ nudgedAt: new Date().toISOString() });
    $("backup-bar").hidden = false;
  }

  $("btn-backup-fix").addEventListener("click", () => {
    $("backup-bar").hidden = true;
    if (Drive.configured()) {
      Store.saveNow(state);
      Drive.begin({ silent: false });
    } else {
      $("btn-export").click();
    }
  });
  $("btn-backup-later").addEventListener("click", () => { $("backup-bar").hidden = true; });

  /* ------------------------------------------------------------------
     Practice
     ------------------------------------------------------------------ */

  /* A word's topic: its own field if it was added here, otherwise whatever
     topics.js files it under. */
  const topicOf = (word) => {
    const w = typeof word === "string" ? words().find((x) => x.id === word) : word;
    if (!w) return null;
    // A word carries its own topic if it has one, which everything in
    // vocab.js and everything added here does. topics.js only has to file
    // the seed, which predates the field.
    if (w.topic) return w.topic;
    const t = TOPICS.find((x) => x.words.includes(w.id));
    return t ? t.id : null;
  };
  const wordsInTopic = (topicId) => words().filter((w) => topicOf(w) === topicId);

  /* The sentences that can be attempted right now, and where each one sits.
     Worked out from progress, so it answers itself as words are met. */
  function readySentences() {
    return Store.readyPhrases(state, (id) => prog(id));
  }

  function sentencePool() {
    const theme = subjectName();
    return readySentences()
      .filter((r) => theme === "all" || (r.theme || "other") === theme)
      .map((r) => ({ id: r.item.id, item: r.item, needs: r.needs, rank: r.rank }));
  }

  /* The words a round may draw on: the topic pick if there is one, then the
     kind-of-word filter on top of it. They compose, because there is no
     reason picking Food and picking Nouns should be an either-or. */
  /* What the learner asked for, in words, for a message about it. */
  function filterName() {
    const bits = [pick && pick.kind === "topic" ? pick.name : null,
                  posName() === "all" ? null : posGroup(posName()).name.toLowerCase()];
    return bits.filter(Boolean).join(", ") || "the bank";
  }

  function wordPool() {
    const base = pick && pick.kind === "topic" ? wordsInTopic(pick.id) : words();
    return base.filter(posGroup(posName()).has);
  }

  const subjectLabel = (id) => {
    const topic = (window.TOPICS || []).find((t) => t.id === id);
    return topic ? topic.name : "Other";
  };

  function updateStartBlurb() {
    if (mode() === "grammar") {
      const lesson = grammarLesson();
      $("start-picked").hidden = true;
      const count = lesson ? lesson.items.length : GRAMMAR.lessons.reduce((n, l) => n + l.items.length, 0);
      $("start-blurb").textContent = lesson
        ? `${lesson.title}: ${lesson.blurb} ${Math.min(count, Engine.CONFIG.GRAMMAR_ROUND_SIZE)} questions from ${count}, `
          + `each with the reason. New to it? Read the lesson on the Lessons screen first.`
        : `A mix of all ${GRAMMAR.lessons.length} topics, ${Engine.CONFIG.GRAMMAR_ROUND_SIZE} questions a round, `
          + `each with the reason. Pick a topic above to drill just one. Practice only: no word's level moves.`;
      return;
    }
    if (mode() === "listen") {
      const pool = listenPool();
      const n = pool.sentences.length + pool.words.length;
      $("start-picked").hidden = true;
      const voice = Speech.voicesKnown() && !Speech.hasSpanishVoice()
        ? " No Spanish voice is installed, so it may sound English: on an iPhone, add one under Settings, Accessibility, Spoken Content, Voices."
        : "";
      $("start-blurb").textContent = n
        ? `${pool.sentences.length} sentences you have the words for and ${pool.words.length} words you have met, read aloud. `
          + `Hear it, type what you heard. Practice only: nothing here moves a word's level.${voice}`
        : `Nothing to listen to yet. Listening uses words you have met and sentences you have every word for, `
          + `so practise some words first.${voice}`;
      return;
    }
    if (mode() === "sentences") {
      const pool = sentencePool();
      const met = pool.filter((x) => Store.peekPhrase(state, x.id).timesSeen > 0);
      const typing = met.filter((x) => Store.peekPhrase(state, x.id).level > Engine.CONFIG.SENTENCE_TILE_TOP);
      const total = Store.allPhrases(state).length;
      const all = readySentences().length;
      const named = subjectName() === "all" ? "" : `${subjectLabel(subjectName())}: `;
      $("start-picked").hidden = true;
      $("start-blurb").textContent = pool.length
        ? `${named}${pool.length} sentences you have the words for`
          + (subjectName() === "all" ? `, of ${total} in the bank. ` : ` of ${all} in reach. `)
          + `${met.length} started, ${typing.length} at the point of typing them out. `
          + `A sentence unlocks once you have met every word in it.`
        : all
        ? `Nothing in ${subjectLabel(subjectName())} yet. Other subjects have ${all} between them.`
        : `No sentences yet: they unlock once you have met every word in one. `
          + `Practise words for a round or two and the first ones will appear.`;
      return;
    }
    if (mode() === "verbs") {
      const built = pick && pick.kind === "drill" ? pick : starterDrill(tenseName());
      $("start-picked").hidden = !(pick && pick.kind === "drill");
      if (pick && pick.kind === "drill") $("start-picked-name").textContent = pick.name;
      const size = built.starter
        ? Math.min(state.settings.roundSize, built.items.length)
        : built.items.length;
      const of = size < built.items.length ? ` of ${built.items.length}` : "";
      $("start-blurb").textContent =
        `${built.name}. ${size}${of} forms, asked in a random order. `
        + `Drills do not move any word's level; they are practice, not assessment. `
        + `Open the Lessons screen to drill a different table.`;
      return;
    }
    const pool = wordPool();
    const enabled = pool.filter((w) => prog(w.id).enabled !== false);
    const unseen = enabled.filter((w) => !prog(w.id).lastSeen).length;

    $("start-picked").hidden = !pick;
    if (pick) $("start-picked-name").textContent = pick.name;

    const met = enabled.length - unseen;
    const settling = Engine.stillSettling(words(), (id) => prog(id));
    const allowance = Engine.newWordAllowance(words(), (id) => prog(id));

    const named = [pick && pick.kind === "topic" ? pick.name : null,
                   posName() === "all" ? null : posGroup(posName()).name.toLowerCase()]
      .filter(Boolean).join(", ");
    const where = named ? `${named}: ${enabled.length} words. ` : `${enabled.length} words. `;
    $("start-blurb").textContent = where
      + `${met} met, ${settling} still settling, ${unseen} to come. `
      + (allowance
        ? `Up to ${allowance} new ${allowance === 1 ? "word" : "words"} this round, commonest first`
          + (state.settings.introduceNew === false ? ", tested straight away." : ".")
        : `No new words until some of those settle; a word settles once you can produce it, not just recognise it.`);
  }

  $("modes").addEventListener("click", (e) => {
    const btn = e.target.closest(".mode");
    if (!btn) return;
    state.settings.mode = btn.dataset.mode;
    /* A table picked from the Lessons screen is a verb pick; it has no meaning
       in the other two modes, and leaving it set would silently drill verbs
       when the learner asked for sentences. */
    if (pick && pick.kind === "drill" && btn.dataset.mode !== "verbs") pick = null;
    // Switching mid-round abandons it. Nothing is lost: every card commits as
    // it is answered, so a round is only ever a queue.
    round = null;
    card = null;
    commit();
    drawModes();
    updateStartBlurb();
    resetPracticeView();
  });

  /* The pickers take about three hundred pixels, which is fine on the screen
     you choose from and ruinous on the one you answer questions on: on a
     phone it puts the card, and in sentence mode the Check button, below the
     fold, so every new card needs a scroll.

     So once a round is running they fold into one line saying what you picked.
     Hiding them outright would be simpler and wrong: being unable to change
     mode without finishing the round is the thing that made them a screen
     fixture in the first place. */
  let pickersOpen = false;
  const inRound = () => !!round && !$("card").hidden;

  function drawModes() {
    document.querySelectorAll("#modes .mode").forEach((b) => {
      b.classList.toggle("on", b.dataset.mode === mode());
    });
    // A long filter row expanded in one mode should not stay expanded in the
    // next; the row is about the mode you are in.
    filtersOpen = false;
    drawFilters();
    drawPickerSummary();
  }

  /* What the one line says: the mode, and the filter if it is narrowing
     anything. "Words" on its own is the whole truth when nothing is filtered,
     and "Words · all" would be noise. */
  function pickerSummaryText() {
    const label = { words: "Words", verbs: "Verb endings", sentences: "Sentences", listen: "Listen", grammar: "Grammar" }[mode()];
    let narrowed = null;
    if (mode() === "verbs") {
      narrowed = pick && pick.kind === "drill" ? pick.name
        : tenseName() === "mixed" ? "mixed tenses"
        : (Verbs.VERBS.tenses.find((t) => t.id === tenseName()) || {}).name;
    } else if (mode() === "grammar") {
      narrowed = grammarLesson() ? grammarLesson().title : null;
    } else if (mode() === "words") {
      narrowed = [pick && pick.kind === "topic" ? pick.name : null,
                  posName() === "all" ? null : posGroup(posName()).name].filter(Boolean).join(", ");
    } else {
      narrowed = subjectName() === "all" ? null : subjectLabel(subjectName());
    }
    return narrowed ? `${label} · ${narrowed}` : label;
  }

  function drawPickerSummary() {
    const folded = inRound() && !pickersOpen;
    $("picker-summary").hidden = !folded;
    $("modes").hidden = folded;
    if (folded) {
      $("filters").hidden = true;
      $("picker-summary-text").textContent = pickerSummaryText();
    }
  }

  $("picker-summary").addEventListener("click", () => {
    pickersOpen = true;
    drawModes();
  });

  /* One row of pills under the modes, meaning something different in each.

     Words narrows by what kind of word it is, verbs by tense, sentences by
     what the sentence is about. Three settings rather than one, because
     coming back to Words should not have silently rearranged what Sentences
     was going to ask; each mode remembers its own.

     Each is a plain string that also happens to be a valid setting when it is
     "all", which is why nothing here needs a null check downstream. */
  const tenseName = () => state.settings.tense || "present";
  const posName = () => state.settings.pos || "all";
  const subjectName = () => state.settings.subject || "all";
  /* Which grammar topic a round drills. Not set in a state saved before there
     was any grammar, which reads as mixed, so old progress needs nothing done
     to it. */
  const GRAMMAR = window.GRAMMAR || { lessons: [] };
  const grammarName = () => state.settings.grammar || "mixed";
  const grammarLesson = () => GRAMMAR.lessons.find((l) => l.id === grammarName()) || null;

  /* Parts of speech, grouped. The bank has twelve of them and twelve pills is
     not a choice, it is a menu; these are the distinctions a learner would
     actually make. "days" is its own part of speech in the bank, which is
     odd but harmless, and it belongs with the numbers. */
  const POS_GROUPS = [
    { id: "all", name: "All", has: () => true },
    { id: "noun", name: "Nouns", has: (w) => w.pos === "noun" },
    { id: "verb", name: "Verbs", has: (w) => w.pos === "verb" },
    { id: "describing", name: "Describing", has: (w) => w.pos === "adjective" || w.pos === "adverb" },
    { id: "phrase", name: "Phrases", has: (w) => w.pos === "phrase" || w.pos === "question" },
    { id: "glue", name: "Little words", has: (w) => ["pronoun", "preposition", "conjunction", "determiner"].includes(w.pos) },
    { id: "number", name: "Numbers and days", has: (w) => w.pos === "number" || w.pos === "days" },
  ];
  const posGroup = (id) => POS_GROUPS.find((g) => g.id === id) || POS_GROUPS[0];

  /* The themes with sentences in them right now. Which those are changes as
     words are met, so the row is built from what is actually there rather
     than from the list of topics: a pill that starts an empty round is worse
     than no pill. */
  function sentenceThemes(pool) {
    const counts = new Map();
    for (const row of pool) {
      const key = row.theme || "other";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => {
        const topic = (window.TOPICS || []).find((t) => t.id === id);
        return { id, name: topic ? topic.name : "Other", n };
      });
  }

  function drawFilters() {
    if (inRound() && !pickersOpen) { $("filters").hidden = true; return; }
    const showTense = mode() === "verbs" && !(pick && pick.kind === "drill");
    const showPos = mode() === "words" && !(pick && pick.kind === "drill");
    const showTheme = mode() === "sentences";
    const showGrammar = mode() === "grammar";
    $("filters").hidden = !(showTense || showPos || showTheme || showGrammar);
    if ($("filters").hidden) return;

    let label, options, current, attr;
    if (showTense) {
      label = "Tense";
      attr = "tense";
      current = tenseName();
      options = [{ id: "mixed", name: "Mixed" }]
        .concat(Verbs.VERBS.tenses.map((t) => ({ id: t.id, name: t.name })));
    } else if (showPos) {
      label = "Kind of word";
      attr = "pos";
      current = posName();
      const pool = pick ? wordsInTopic(pick.id) : words();
      options = POS_GROUPS
        .map((g) => ({ id: g.id, name: g.name, n: pool.filter(g.has).length }))
        .filter((o) => o.id === "all" || o.n > 0);
    } else if (showGrammar) {
      label = "Topic";
      attr = "grammar";
      current = grammarLesson() ? grammarName() : "mixed";
      options = [{ id: "mixed", name: "Mixed" }]
        .concat(GRAMMAR.lessons.map((l) => ({ id: l.id, name: l.short })));
    } else {
      label = "About";
      attr = "subject";
      current = subjectName();
      const themes = sentenceThemes(readySentences());
      options = [{ id: "all", name: "All" }].concat(themes);
    }

    /* Twelve subjects is six rows of pills on a phone, and a full bank has
       twenty-one. So the row shows the largest few and hides the rest behind
       a More, with whatever is currently chosen always among them: a pill
       that is switched on and not on screen is a thing that looks broken. */
    const LIMIT = 8;
    const long = options.length > LIMIT + 1;
    let shown = options;
    if (long && !filtersOpen) {
      shown = options.slice(0, LIMIT);
      if (!shown.some((o) => o.id === current)) {
        shown = shown.slice(0, LIMIT - 1).concat(options.find((o) => o.id === current) || []);
      }
    }

    $("filter-label").textContent = label;
    $("filter-pills").innerHTML = shown.map((o) =>
      `<button class="pill${o.id === current ? " on" : ""}" data-filter="${esc(attr)}" data-value="${esc(o.id)}">`
      + `${esc(o.name)}${o.n && o.id !== "all" ? `<i>${o.n}</i>` : ""}</button>`
    ).join("")
      + (long
        ? `<button class="pill more" data-more="1">${filtersOpen ? "Fewer" : `More (${options.length - shown.length})`}</button>`
        : "");
  }

  let filtersOpen = false;

  $("filter-pills").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    if (pill.dataset.more) { filtersOpen = !filtersOpen; drawFilters(); return; }
    state.settings[pill.dataset.filter] = pill.dataset.value;
    commit();
    // The round in progress was drawn from the old pool.
    round = null; card = null;
    drawFilters();
    updateStartBlurb();
    resetPracticeView();
  });

  /* Clearing the pick abandons whatever round is running. Nothing is lost by
     that: every card commits as it is answered, so the round is only ever a
     queue, never unsaved work. */
  $("btn-clear-pick").addEventListener("click", () => {
    pick = null;
    round = null;
    card = null;
    drawFilters();
    updateStartBlurb();
    resetPracticeView();
  });

  function resetPracticeView() {
    closeGloss();
    pickersOpen = false;
    $("card").hidden = true;
    $("round-bar").hidden = true;
    $("round-end").hidden = true;
    $("round-start").hidden = false;
    drawPickerSummary();
  }

  function startRound() {
    let picked;
    if (mode() === "sentences") return startSentenceRound();
    if (mode() === "listen") return startListenRound();
    if (mode() === "grammar") return startGrammarRound();

    /* A table picked from the Lessons screen is a standing choice and lives in
       `pick`. The starter drill is not: it is rebuilt from the tense pills on
       every round, because stashing it would mean changing the tense had no
       effect until something cleared the stash. */
    const drill = (pick && pick.kind === "drill") ? pick
      : mode() === "verbs" ? starterDrill(tenseName())
      : null;

    if (drill) {
      /* A table picked from Lessons runs end to end, because running the
         table is what was asked for. The starter set is a different thing: on
         Mixed it is two hundred forms, which is not a round by anybody's
         reckoning, so it is shuffled and cut to the length already set under
         Cards per round. */
      const shuffled = Engine.shuffle(drill.items);
      picked = drill.starter ? shuffled.slice(0, state.settings.roundSize) : shuffled;
    } else {
      picked = Engine.pickRound(wordPool(), (id) => prog(id), new Date().toISOString(),
        state.settings.roundSize, {
          rankOf: TeachingOrder.rankOf,
          /* Counted across the whole bank, not the pool: how much you have on
             the go is a fact about you, not about the topic you picked.

             The allowance applies whether or not new words are introduced
             first. Turning introductions off changes what the card looks
             like, not how many new words a round may take on; tying it to
             zero emptied the round completely on a bank where nothing had
             been met yet. */
          maxNew: Engine.newWordAllowance(words(), (id) => prog(id)),
        });
    }
    if (!picked.length) {
      /* An empty round has three quite different causes and they need three
         different answers. The one that catches people out is the third:
         asking for a kind of word you have never met while the allowance is
         spent on words you are already working on. Saying "nothing is
         enabled" there would be simply untrue. */
      const pool = drill ? [] : wordPool();
      const enabled = pool.filter((w) => prog(w.id).enabled !== false);
      const spent = enabled.length && !Engine.newWordAllowance(words(), (id) => prog(id));
      toast(drill ? `Nothing to drill in ${drill.name}.`
        : spent ? `Nothing here has been met yet, and no new words until some of the ones you are working on settle.`
        : enabled.length ? `Nothing to practise in ${filterName()} right now.`
        : `No words are enabled in ${filterName()}, so there is nothing to practise.`, true);
      return;
    }
    round = { queue: picked, index: 0, results: [], movers: [], drill: !!drill };
    pickersOpen = false;
    $("round-start").hidden = true;
    $("round-end").hidden = true;
    $("round-bar").hidden = false;
    nextCard();
  }

  /* A round of sentences. The same picker the words use, so sentences get the
     same weighting, the same pull on the ones that keep going wrong, and the
     same cap on how many new ones arrive at once. Rank comes from the hardest
     word in the sentence, so they arrive commonest-first too. */
  function startSentenceRound() {
    const pool = sentencePool();
    if (!pool.length) {
      toast(readySentences().length
        ? `No sentences about ${subjectLabel(subjectName()).toLowerCase()} are in reach yet.`
        : "No sentences are within reach yet. Practise some words first.", true);
      return;
    }
    const rankById = new Map(pool.map((x) => [x.id, x.rank]));
    const picked = Engine.pickRound(pool, (id) => Store.peekPhrase(state, id),
      new Date().toISOString(), Engine.CONFIG.SENTENCE_ROUND_SIZE, {
        maxNew: Engine.CONFIG.SENTENCE_MAX_NEW,
        rankOf: (id) => (rankById.has(id) ? rankById.get(id) : Number.MAX_SAFE_INTEGER),
      });
    round = { queue: picked, index: 0, results: [], movers: [], drill: false, sentences: true };
    pickersOpen = false;
    $("round-start").hidden = true;
    $("round-end").hidden = true;
    $("round-bar").hidden = false;
    nextCard();
  }

  /* Listening. What can be listened to is what has already been learned:
     sentences you have every word for, and words you have met. Hearing a word
     for the very first time is not a test of anything, so nothing new is
     ever read out here. */
  function listenPool() {
    const sentences = readySentences()
      .map((r) => ({ kind: "sentence", id: r.item.id, es: String(r.item.es).replace(/[{}]/g, ""), en: r.item.en }))
      .filter((x) => x.es && x.en && Engine.tokenise(x.es).length <= Engine.CONFIG.LISTEN_MAX_WORDS);
    const met = words()
      .filter((w) => prog(w.id).timesSeen > 0 && prog(w.id).enabled !== false)
      .map((w) => ({ kind: "word", id: w.id, es: w.es, en: w.en.join(", ") }));
    return { sentences, words: met };
  }

  /* Mostly sentences, because a sentence is what you will actually hear, with
     single words mixed in. Whichever runs short, the other makes up the round. */
  function startListenRound() {
    const pool = listenPool();
    const size = Engine.CONFIG.LISTEN_ROUND_SIZE;
    if (!pool.sentences.length && !pool.words.length) {
      toast("Nothing to listen to yet. Practise some words first.", true);
      return;
    }
    let want = Math.min(pool.sentences.length, Math.round(size * Engine.CONFIG.LISTEN_SENTENCE_SHARE));
    const fromWords = Math.min(pool.words.length, size - want);
    want = Math.min(pool.sentences.length, size - fromWords);
    const picked = Engine.shuffle(Engine.shuffle(pool.sentences).slice(0, want)
      .concat(Engine.shuffle(pool.words).slice(0, fromWords)));
    round = { queue: picked, index: 0, results: [], movers: [], drill: false, listen: true };
    pickersOpen = false;
    $("round-start").hidden = true;
    $("round-end").hidden = true;
    $("round-bar").hidden = false;
    nextCard();
  }

  /* Grammar. A round is one topic's questions shuffled, or for Mixed, an even
     spread across every topic so a round is not all ser and estar. */
  function startGrammarRound() {
    const size = Engine.CONFIG.GRAMMAR_ROUND_SIZE;
    const lesson = grammarLesson();
    let picked;
    if (lesson) {
      picked = Engine.shuffle(lesson.items).slice(0, size).map((item) => ({ lesson, item }));
    } else {
      const decks = Engine.shuffle(GRAMMAR.lessons).map((l) => Engine.shuffle(l.items).map((item) => ({ lesson: l, item })));
      picked = [];
      for (let i = 0; picked.length < size && decks.some((d) => d.length); i = (i + 1) % decks.length) {
        if (decks[i].length) picked.push(decks[i].shift());
      }
    }
    if (!picked.length) { toast("No grammar questions to drill.", true); return; }
    round = { queue: picked, index: 0, results: [], movers: [], drill: true, grammar: true };
    pickersOpen = false;
    $("round-start").hidden = true;
    $("round-end").hidden = true;
    $("round-bar").hidden = false;
    nextCard();
  }

  /* The sentence with the gap filled in. "—" means nothing goes there. */
  const fillGap = (es, option) => (option === "—"
    ? es.replace(/___\s?/, "")
    : es.replace("___", option));
  const optionLabel = (option) => (option === "—" ? "nothing" : option);

  /* A grammar question as a card. It counts as a drill, so it moves no level
     and is never written to saved progress; the reason for the answer rides in
     the note slot the verdict already shows. */
  function grammarCard(entry) {
    const { lesson, item } = entry;
    const full = fillGap(item.es, item.answer);
    return {
      drill: true, grammar: true, isSentence: true,
      word: { id: null, es: full, note: item.why },
      band: { key: "grammar", label: lesson.title },
      levelLabel: "",
      fellBack: false,
      prompt: item.es,
      promptHint: item.en,
      accepted: [item.answer],
      reveal: full,
      revealContext: "",
      options: Engine.shuffle(item.options),
      answer: item.answer,
    };
  }

  function drawChoices(c) {
    $("choices").hidden = !c.grammar;
    if (!c.grammar) { $("choices").innerHTML = ""; return; }
    $("choices").innerHTML = c.options.map((o, i) => {
      const label = optionLabel(o);
      return `<button class="btn choice${label.length > 14 ? " long" : ""}" type="button" data-choice="${esc(o)}"`
        + ` aria-keyshortcuts="${i + 1}">${esc(label)}</button>`;
    }).join("");
  }

  function choose(option) {
    if (!card || !card.grammar || !$("verdict").hidden) return;
    const right = option === card.answer;
    $("choices").hidden = true;
    applyAndShow({ correct: right, almost: false, matched: right ? option : null, near: false,
      reason: null, diff: null, sibling: null, equivalent: false }, option);
  }

  $("choices").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-choice]");
    if (btn) choose(btn.dataset.choice);
  });

  // On a keyboard, 1 to 4 pick the choices in the order they are shown.
  document.addEventListener("keydown", (e) => {
    if (!card || !card.grammar || !$("verdict").hidden || $("card").hidden) return;
    const n = Number(e.key);
    if (n >= 1 && n <= card.options.length) { e.preventDefault(); choose(card.options[n - 1]); }
  });

  /* A listening card, dressed like any other so the practice screen draws it
     without special cases: the answer is the Spanish that was read, and the
     English waits for the verdict. */
  function listenCard(item) {
    const n = Engine.tokenise(item.es).length;
    return {
      listen: true,
      isSentence: item.kind === "sentence",
      word: { id: item.id, es: item.es, note: "" },
      band: Engine.BANDS.listen,
      levelLabel: item.kind === "sentence" ? "a sentence" : "a word",
      fellBack: false,
      prompt: "",
      promptHint: `Type what you hear \u00b7 ${n} ${n === 1 ? "word" : "words"}`,
      accepted: [item.es],
      reveal: item.es,
      revealContext: item.en,
    };
  }

  function nextCard() {
    if (!round || round.index >= round.queue.length) return endRound();
    const item = round.queue[round.index];
    // A drill item is already a card; a word or a sentence has to be built.
    card = round.listen ? listenCard(item)
      : round.grammar ? grammarCard(item)
      : round.drill ? drillCard(item)
      : round.sentences
      ? Engine.sentenceCard(item.item, Store.peekPhrase(state, item.id), {
          distractors: Store.tileDistractors(state, item.item, item.needs,
            (id) => prog(id), Engine.CONFIG.TILE_DISTRACTORS),
        })
      : Engine.buildCard(item, prog(item.id), sentencesFor, {
          introduce: state.settings.introduceNew !== false,
        });
    lastResult = null;
    cardBefore = round.drill || round.listen ? null : JSON.parse(JSON.stringify(cardProgress(card)));
    retypes = 0;

    $("card-band").textContent = card.band.label + (card.fellBack ? " (no sentence yet)" : "");
    // A word you have not met is always at L1, so saying so tells nobody
    // anything; the level appears once it starts meaning something.
    $("card-level").textContent = round.drill || round.listen ? card.levelLabel
      : (card.intro && !card.relearn) ? ""
      : `L${cardProgress(card).level}`;
    const shown = spanishPrompt(card);
    closeGloss();
    // A cloze sentence is context around the blank, so its words can be
    // tapped; any other prompt is the question itself and cannot.
    $("card-prompt").innerHTML = (card.band.key === "cloze" || card.grammar
      ? tappable(card.prompt)
      : esc(card.prompt)) + sayButton(shown);
    $("card-prompt").hidden = !!card.listen;
    $("listen").hidden = !card.listen;
    $("card-hint").textContent = card.band.key === "cloze"
      ? card.promptHint
      : (card.promptHint ? card.promptHint : "");
    $("card-hint").hidden = !$("card-hint").textContent;

    // Three things can occupy the bottom of the card, and only ever one: the
    // teaching block, the tile tray, or the answer box.
    drawTeach(card);
    drawBuild(card);
    const building = card.band.key === "build";
    drawChoices(card);
    $("answer-form").hidden = !!card.intro || building || !!card.grammar;
    $("accents").hidden = !SPANISH_BACK.has(card.band.key);
    $("card").classList.toggle("teaching", !!card.intro);
    $("card").classList.toggle("building", building);

    $("answer").value = "";
    $("answer").disabled = false;
    $("btn-submit").disabled = false;
    $("verdict").hidden = true;
    $("card").classList.remove("correct", "almost", "wrong");
    $("card").hidden = false;
    drawPickerSummary();
    $("round-count").textContent = `${round.index + 1} / ${round.queue.length}`;
    $("round-fill").style.width = `${(round.index / round.queue.length) * 100}%`;
    (card.intro ? $("btn-got")
      : card.band.key === "build" ? $("btn-build-check")
      : card.grammar ? $("choices").querySelector(".choice")
      : $("answer")).focus();
    // A listening card is nothing without its sound, so it always plays. Any
    // other card reads its Spanish only if reading aloud is on.
    if (card.listen) say(card.reveal);
    else if (shown) autoSay(shown);
    window.__card = card;   // handy for debugging and for the UI test
  }

  /* The teaching card. Everything the learner needs in one go: the word, what
     it means, how to say it, the note, and a sentence with the word still in
     place rather than blanked out. */
  function drawTeach(c) {
    $("teach").hidden = !c.intro;
    if (!c.intro) return;

    /* A word shown for the second time needs to say why, or it looks like the
       app has forgotten you have met it. The miss count is the honest reason
       and is the whole of what the lapse counter is for. */
    const misses = c.relearn ? prog(c.word.id).lapses || 0 : 0;
    $("teach-why").textContent = c.relearn
      ? `Missed ${misses} ${misses === 1 ? "time" : "times"} in a row without coming good, so here it is again.`
      : "";
    $("teach-why").hidden = !c.relearn;

    $("teach-meaning").textContent = c.reveal;

    // Which sense, where the English alone would fit another word too.
    $("teach-sense").textContent = c.word.sense ? `The ${c.word.sense} one.` : "";
    $("teach-sense").hidden = !c.word.sense;

    $("teach-say").textContent = Pronounce.isTricky(c.word.es)
      ? `Say it: ${Pronounce.respell(c.word.es)}`
      : "";
    $("teach-say").hidden = !$("teach-say").textContent;

    $("teach-note").textContent = c.word.note || "";
    $("teach-note").hidden = !c.word.note;

    if (c.example) {
      // The word is picked out of the sentence so the eye lands on it.
      $("teach-es").innerHTML = tappable(c.example.es, c.example.target);
      $("teach-en").textContent = c.example.en;
      $("btn-say-example").dataset.say = c.example.es;
      $("btn-say-example").hidden = !Speech.supported;
      $("teach-example").hidden = false;
    } else {
      $("teach-example").hidden = true;
    }

    // Said out loud because it changes how the card is read: this is not a
    // word to nod at and forget, it is the answer to the next question.
    $("teach-then").hidden = false;
  }

  /* The tile builder. `placed` is the answer being assembled; the tray is
     everything not yet placed. Tapping moves a tile between the two, which is
     the whole interaction. */
  let placed = [];

  function drawBuild(c) {
    const on = c.band.key === "build";
    $("build").hidden = !on;
    if (!on) { placed = []; return; }
    placed = [];
    renderTiles();
  }

  function renderTiles() {
    const inUse = new Set(placed.map((t) => t.key));
    $("build-line").innerHTML = placed.length
      ? placed.map((t) => `<button class="tile placed" data-key="${esc(t.key)}">${esc(t.text)}</button>`).join("")
      : '<span class="muted small">Your answer goes here.</span>';
    $("build-tray").innerHTML = card.tiles
      .filter((t) => !inUse.has(t.key))
      .map((t) => `<button class="tile" data-key="${esc(t.key)}">${esc(t.text)}</button>`).join("");
    $("btn-build-check").disabled = !placed.length;
  }

  $("build-tray").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile || !card || card.band.key !== "build") return;
    const found = card.tiles.find((t) => t.key === tile.dataset.key);
    if (found) { placed.push(found); renderTiles(); }
  });

  $("build-line").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    placed = placed.filter((t) => t.key !== tile.dataset.key);
    renderTiles();
  });

  $("btn-build-clear").addEventListener("click", () => { placed = []; renderTiles(); });

  $("btn-build-check").addEventListener("click", () => {
    if (!card || card.band.key !== "build" || !placed.length) return;
    const typed = placed.map((t) => t.text).join(" ");
    applyAndShow(Engine.checkSequence(placed.map((t) => t.text), card.tileAnswer), typed);
  });

  /* Met, not answered: the word is marked seen so it is not introduced
     again, and nothing else about it moves.

     Then the same word goes straight back into the queue, one place along, so
     it is asked while it is still on the screen behind your eyes. Being shown
     a word and tested on it twenty cards later is two unrelated events; being
     shown it and asked immediately is the pair that makes it stick. The word
     is not removed from anywhere else, so it still comes round again later on
     its own weight, which is where the actual remembering happens. */
  $("btn-got").addEventListener("click", () => {
    if (!card || !card.intro) return;
    const id = card.word.id;
    state.progress[id] = Engine.applyResult(progWrite(id), "seen", new Date().toISOString()).progress;
    commit();
    round.results[round.index] = { id, outcome: "seen" };
    round.queue.splice(round.index + 1, 0, card.word);
    round.index += 1;
    nextCard();
  });

  /* A conjugation dressed as a card, so the practice screen does not need to
     know the difference. The answer comes straight off the table in verbs.js,
     so the drill can only ever ask what the lesson already teaches. */
  function drillCard(item) {
    /* "hablar, yo, present" is only a question if you already know what yo
       does to a verb, which is the thing being drilled. So the card asks in
       English where it can: hablar, and under it "I talk". Where it cannot,
       for the preterite and the subjunctive, it at least spells out who yo
       is rather than leaving the pronoun to speak for itself. */
    const english = item.english;
    return {
      drill: true,
      word: { id: null, es: item.answer, note: item.note || "" },
      band: { key: "drill", label: item.tenseName },
      levelLabel: `${item.personLabel} (${item.personShort})`,
      fellBack: false,
      prompt: item.infinitive,
      promptHint: english
        ? `${item.gloss} \u2014 say "${english}"`
        : `${item.gloss} \u2014 the ${item.personLabel} form (${item.personShort}), ${item.tenseName.toLowerCase()}`,
      accepted: [item.answer],
      reveal: item.answer,
      revealContext: english ? `${item.personLabel}: ${english}` : "",
    };
  }

  $("btn-listen-play").addEventListener("click", () => { if (card && card.listen) say(card.reveal); });
  $("btn-listen-slow").addEventListener("click", () => { if (card && card.listen) say(card.reveal, true); });

  /* The accent keys. Pressing one must not take focus off the box, or on a
     phone the keyboard folds away between every letter. Cancelling the press
     keeps the focus where it is; the click still arrives and does the typing.
     Both events, because not every browser takes the hint from the first. */
  for (const type of ["pointerdown", "mousedown"]) {
    $("accents").addEventListener(type, (e) => {
      if (e.target.closest(".key")) e.preventDefault();
    });
  }
  $("accents").addEventListener("click", (e) => {
    const key = e.target.closest(".key");
    const box = $("answer");
    if (!key || box.disabled) return;
    const at = box.selectionStart ?? box.value.length;
    box.setRangeText(key.dataset.ch, at, box.selectionEnd ?? at, "end");
    box.focus();
  });

  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!card || !$("verdict").hidden) return;
    // An empty box on a second go is a mis-hit Enter, not an answer.
    if (retypes && !$("answer").value.trim()) return;
    grade($("answer").value);
  });

  function grade(typed) {
    if (card.listen) {
      applyAndShow(Engine.checkHeard(typed, card.reveal, {
        typoTolerance: state.settings.typoTolerance,
      }), typed);
      return;
    }
    applyAndShow(Engine.checkAnswer(typed, card.accepted, {
      typoTolerance: state.settings.typoTolerance,
      /* The other Spanish words that answer the same English prompt. A drill
         answer comes off a conjugation table and has no word behind it, so
         there is nothing to be a sibling of. */
      siblings: card.drill || card.isSentence ? [] : Store.siblingsOf(words(), card.word.id),
    }), typed);
  }

  /* What the three verdicts are called, and the class each one puts on the
     card so the stylesheet can colour the whole block at once. */
  const VERDICT = {
    correct: { chip: "Correct", tone: "good" },
    almost: { chip: "Almost", tone: "warn" },
    wrong: { chip: "Not quite", tone: "bad" },
  };

  const WHY = {
    article: "an article apart",
    infinitive: "the infinitive apart",
    spelling: "a letter out",
    order: "the right words, the wrong way round",
    words: "the right number of words, not the right ones",
    length: "not the right number of words",
  };

  /* A sibling answer is not a misspelling and saying "a letter out" would be
     a lie about it: the word typed is a real answer to the prompt, just not
     the sense this card wanted. Both tags go in the line, because the pair is
     the thing worth learning and this is the moment it lands. */
  function whySense(res) {
    const mine = card.word && card.word.sense;
    const theirs = res.sibling && res.sibling.sense;
    if (!res.sibling) return "close";
    const left = theirs ? `${res.sibling.es} is ${theirs}` : `${res.sibling.es} means that too`;
    return mine ? `${left} · this one is ${mine}` : left;
  }

  /* The diff comes out of the engine as ops; the markup is this file's
     business. The answer's own words are shown, with what was added struck
     out, what was left out underlined, and a misspelt word carrying a mark
     on the letters to look at. */
  const DIFF = {
    same: (o) => esc(o.text),
    extra: (o) => `<s class="d-extra">${esc(o.text)}</s>`,
    missing: (o) => `<ins class="d-missing">${esc(o.text)}</ins>`,
    changed: (o) => `<span class="d-changed">${esc(o.head)}<mark>${esc(o.fix)}</mark>${esc(o.tail)}</span>`,
  };
  const renderDiff = (ops) => ops.map((o) => (DIFF[o.op] || DIFF.same)(o)).join(" ");

  function applyAndShow(res, typed) {
    const id = card.word.id;
    let outcome = res.correct ? "correct" : res.almost ? "almost" : "wrong";
    // A second go can only improve the card. Someone who stops to fix a
    // near miss should never end up worse off for having bothered.
    if (retypes && outcome === "wrong") outcome = "almost";

    /* A drill has no word behind it, so there is no level to move. Keeping
       conjugations out of the mastery model is deliberate: a word's level
       means how well that word is known, and diluting it with endings drilled
       off a table would make it mean nothing. */
    /* Listening is kept out for the same reason: hearing a word and knowing it
       are different things, and a level should only mean the second. */
    const applied = card.drill || card.listen
      ? { result: outcome, held: false, movedUp: false, movedDown: false,
          levelBefore: null, levelAfter: null, bandChanged: false }
      : (() => {
          const row = bookWrite(card)(state, id);
          Object.keys(row).forEach((k) => { delete row[k]; });
          Object.assign(row, cardBefore);
          const a = Engine.applyResult(row, outcome, new Date().toISOString());
          Object.assign(row, a.progress);
          commit();
          return a;
        })();

    lastResult = { id, outcome, applied, typed, res };
    // Keyed by position rather than pushed, so re-grading the same card
    // replaces its result instead of counting the card twice.
    round.results[round.index] = { id, outcome };
    // Same for the movers: keep only where this word ended up.
    round.movers = round.movers.filter((m) => m.id !== id);
    if (!card.drill && (applied.movedUp || applied.movedDown)) {
      round.movers.push({
        id, up: applied.movedUp, es: card.word.es,
        from: applied.levelBefore, to: applied.levelAfter,
        bandChanged: applied.bandChanged,
      });
    }

    $("verdict-chip").textContent = VERDICT[outcome].chip;
    $("verdict-chip").className = "chip " + VERDICT[outcome].tone;
    // The card carries the result as a class so the stylesheet can colour
    // the verdict block and pick the mascot's face; no other JS knows
    // anything about how the answer is drawn.
    $("card").classList.toggle("correct", outcome === "correct");
    $("card").classList.toggle("almost", outcome === "almost");
    $("card").classList.toggle("wrong", outcome === "wrong");

    let detail = "";
    /* Right, and not the word this card is teaching. Saying so is the whole
       reason for accepting it: the answer was correct and there is still
       something to learn from the card. */
    if (outcome === "correct" && res.equivalent) {
      detail = `also right \u00b7 this one is "${card.reveal}"`;
    }
    else if (outcome === "correct" && res.near) detail = "accepted with typo tolerance";
    else if (outcome === "almost") {
      detail = res.reason === "sense" ? whySense(res) : (WHY[res.reason] || "close");
    }
    else if (outcome === "wrong" && typed.trim()) detail = `you typed "${typed.trim()}"`;
    // For a choice, the choice is what was "typed", and saying so is enough.
    if (card.grammar) detail = outcome === "correct" ? "" : `you chose "${optionLabel(typed)}"`;
    // How much of it came through says more about listening than a verdict does.
    if (card.listen) {
      detail = res.of ? `${res.heard} of ${res.of} ${res.of === 1 ? "word" : "words"}` : "";
      if (res.near) detail += " · accepted with typo tolerance";
    }
    if (applied.movedUp) detail += `${detail ? " · " : ""}L${applied.levelBefore} to L${applied.levelAfter}`;
    if (applied.movedDown) detail += `${detail ? " · " : ""}dropped to L${applied.levelAfter}`;
    if (applied.held) detail += `${detail ? " · " : ""}holding at L${applied.levelAfter}`;
    if (outcome === "correct" && !applied.movedUp && Engine.isBoundaryLevel(applied.levelBefore)) {
      detail += `${detail ? " · " : ""}one more in a row to move up a band`;
    }
    $("verdict-detail").textContent = detail;

    $("verdict-diff").innerHTML = res.diff ? renderDiff(res.diff) : "";
    $("verdict-diff").hidden = !res.diff;

    // The answer is tappable when it is Spanish of more than one word: a
    // sentence, a phrase, or what a listening card read out.
    const spanishAnswer = askedFor(card) === "es" && /\s/.test(String(card.reveal).trim());
    if (spanishAnswer) $("verdict-answer").innerHTML = tappable(card.reveal);
    else $("verdict-answer").textContent = card.reveal;
    const spoken = spanishOf(card);
    $("btn-say-answer").dataset.say = spoken || "";
    $("btn-say-answer").hidden = !Speech.supported || !spoken;
    // A listening card's English was never on screen; this is where it lands.
    $("verdict-en").textContent = card.listen ? card.revealContext : "";
    $("verdict-en").hidden = !card.listen;

    /* How to say it, but only where the spelling would mislead an English
       reader. "MEH-sah" under mesa is noise; "HWEH-behs" under jueves is the
       whole point. */
    const spanish = card.band.key === "recognition" ? card.word.es : card.reveal;
    $("verdict-say").textContent = !card.isSentence && Pronounce.isTricky(spanish)
      ? `Say it: ${Pronounce.respell(spanish)}`
      : "";
    $("verdict-say").hidden = !$("verdict-say").textContent;

    if (card.band.key === "cloze") $("verdict-context").innerHTML = tappable(card.revealContext);
    else $("verdict-context").textContent = card.listen ? "" : card.revealContext || "";
    $("verdict-context").hidden = card.listen || !card.revealContext;

    const note = card.word.note;
    $("verdict-note").textContent = note || "";
    $("verdict-note").hidden = !note;

    // The override makes sense on anything short of a clean pass, and only
    // when something was actually typed.
    // Nothing to override on a drill: there is no level for it to change.
    $("btn-override").hidden = card.drill || card.listen || outcome === "correct" || !typed.trim();
    // On an amber card the second go is the point, so it takes the primary
    // button and Next steps back.
    $("btn-retry").hidden = outcome !== "almost";
    $("btn-next").classList.toggle("primary", outcome !== "almost");

    /* The box and the Check button have done their job and are now a hundred
       pixels of disabled controls between the question and the Next button.
       On a phone that is the difference between reading the verdict and
       scrolling to it. The tile tray already went this way; what you typed is
       in the verdict line anyway. Type it again puts the box back. */
    $("answer").disabled = true;
    $("btn-submit").disabled = true;
    $("answer-form").hidden = true;
    $("build").hidden = true;
    $("verdict").hidden = false;
    (outcome === "almost" ? $("btn-retry") : $("btn-next")).focus();
    /* Spanish the card has not yet read out, read now: the answer to a card
       that asked for it, or a drill's conjugated form, which is not the
       infinitive it showed. A listening card plays again with the words in
       front of you, which is how the sound gets tied to the spelling. */
    if (card.listen || spoken !== spanishPrompt(card)) autoSay(spoken);
  }

  /* Reopen the box for another go at the same card. Nothing is undone
     here: the snapshot means the next grade is applied from scratch. */
  function startRetype() {
    if (!card) return;
    retypes += 1;
    $("verdict").hidden = true;
    if (card.band.key === "build") {
      placed = [];
      $("build").hidden = false;
      renderTiles();
      $("btn-build-check").focus();
      return;
    }
    $("answer-form").hidden = false;
    $("answer").value = "";
    $("answer").disabled = false;
    $("btn-submit").disabled = false;
    $("answer").focus();
    if (card.listen) say(card.reveal);
  }

  $("btn-retry").addEventListener("click", startRetype);

  /* Mark the last answer correct after all. The snapshot makes this exact:
     it is the same as if the right answer had been typed first time. */
  /* Marking an answer right is not just a correction to this card. No list of
     synonyms will ever be complete, and being marked wrong twice for the same
     answer is what makes an app feel broken, so what was typed is remembered
     as an accepted answer for that word and never asked about again.

     Not for a drill, which has no word behind it, and not for a sentence,
     where the answer is a whole sentence and remembering one would accept it
     for that sentence for ever on the strength of one keystroke. */
  $("btn-override").addEventListener("click", () => {
    if (!lastResult || lastResult.outcome === "correct") return;
    const typed = lastResult.typed;
    const learnable = !card.drill && !card.listen && !card.isSentence && card.word && card.word.id;
    const remembered = learnable
      && Store.rememberAccepted(state, card.word.id, askedFor(card), typed);
    if (remembered) commit();
    applyAndShow({ correct: true, almost: false, near: false, reason: null,
                   diff: null, sibling: null, equivalent: false }, typed);
    toast(remembered
      ? `Marked correct, and "${typed.trim()}" will be accepted for this word from now on.`
      : "Marked correct.");
  });

  $("btn-next").addEventListener("click", () => {
    round.index += 1;
    nextCard();
  });

  function endRound() {
    $("card").hidden = true;
    $("round-bar").hidden = true;
    $("round-fill").style.width = "100%";
    // The round is over, so the pickers are the point of the screen again.
    pickersOpen = false;
    drawPickerSummary();

    // results is keyed by card position, so a skipped card leaves a hole.
    const answered = round.results.filter(Boolean);
    const count = (outcome) => answered.filter((r) => r.outcome === outcome).length;
    // An introduction was not answered, so it is not in the accuracy.
    const n = answered.length - count("seen");
    const right = count("correct");
    const pct = n ? Math.round((right / n) * 100) : 0;

    if (!round.drill && !round.listen) {
      state.stats.rounds += 1;
      state.stats.lastRoundAt = new Date().toISOString();
      Store.saveNow(state);
    }

    // A round of nothing but introductions has no accuracy to report, and
    // "0/0 correct" is worse than saying nothing.
    $("end-stats").innerHTML = [
      ...(count("seen") ? [stat(count("seen"), "new words met")] : []),
      ...(n ? [
        stat(pct + "%", "accuracy"),
        stat(`${right}/${n}`, "correct"),
        stat(count("almost"), "almost"),
      ] : []),
      // Levels are a word thing, so a drill does not report them.
      ...(round.drill || round.listen || !n ? [] : [
        stat(round.movers.filter((m) => m.up).length, "levelled up"),
        stat(round.movers.filter((m) => !m.up).length, "dropped"),
      ]),
    ].join("");

    $("end-movers").innerHTML = round.drill
      ? '<p class="muted small">A drill is practice, not assessment, so no word has moved.</p>'
      : round.listen
      ? '<p class="muted small">Listening is practice, not assessment, so no word has moved.</p>'
      : !n
        ? '<p class="muted small">All new words this round, so nothing was tested. They will come back to be asked.</p>'
        : round.movers.length
        ? round.movers.map((m) => `
            <div class="mover ${m.up ? "up" : "down"}">
              <span class="arrow">${m.up ? "&#9650;" : "&#9660;"}</span>
              <span>${esc(m.es)}</span>
              ${m.bandChanged ? '<span class="flag">new band</span>' : ""}
              <span class="lv">L${m.from} to L${m.to}</span>
            </div>`).join("")
        : '<p class="muted small">No level changes this round.</p>';

    $("round-end").hidden = false;
    updateStartBlurb();
    // The end of a round is the moment worth pushing: the most progress has
    // just been made and nobody is mid-card.
    doSync({ quiet: true });
    driveSync({ quiet: true });
  }

  const stat = (value, label) => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;

  $("btn-start").addEventListener("click", startRound);
  $("btn-again").addEventListener("click", startRound);

  /* ------------------------------------------------------------------
     Topics
     ------------------------------------------------------------------ */

  /* Every topic as a pane: how far through it you are, a button that
     practises only those words, and the list itself with the sounds on it. */
  function renderTopics() {
    const known = new Set(TOPICS.map((t) => t.id));
    const extras = new Set(words().map((w) => topicOf(w)).filter((t) => t && !known.has(t)));
    const all = TOPICS.concat([...extras].map((id) => ({ id, name: id, blurb: "Added here.", words: [] })));

    $("topic-list").innerHTML = all.map((t) => {
      const pool = wordsInTopic(t.id);
      if (!pool.length) return "";
      const bands = { recognition: 0, production: 0, cloze: 0 };
      let seen = 0;
      for (const w of pool) {
        const pr = prog(w.id);
        bands[Engine.bandForLevel(pr.level).key] += 1;
        if (pr.timesSeen) seen += 1;
      }
      const rows = pool
        .slice()
        .sort((a, b) => a.es.localeCompare(b.es, "es"))
        .map((w) => {
          const say = Pronounce.isTricky(w.es) ? Pronounce.respell(w.es) : "";
          return `<tr>
            <td class="es">${esc(w.es)}</td>
            <td class="small">${esc(w.en.join(", "))}</td>
            <td class="say-cell small">${esc(say)}</td>
            <td class="lvl">${prog(w.id).level}</td>
          </tr>`;
        }).join("");

      return `
        <div class="pane topic" data-topic="${esc(t.id)}">
          <div class="pane-head">
            <h2>${esc(t.name)}</h2>
            <span class="count-chip">${seen} / ${pool.length} seen</span>
            <button class="btn primary" data-act="practise-topic">Practise</button>
          </div>
          <p class="muted small blurb">${esc(t.blurb)}</p>
          <div class="topic-bar" title="${bands.recognition} recognition, ${bands.production} production, ${bands.cloze} cloze">
            <i class="b1" style="width:${(bands.recognition / pool.length) * 100}%"></i>
            <i class="b2" style="width:${(bands.production / pool.length) * 100}%"></i>
            <i class="b3" style="width:${(bands.cloze / pool.length) * 100}%"></i>
          </div>
          <details class="lesson">
            <summary>The ${pool.length} words<span class="muted small">${
              bands.production + bands.cloze} past recognition</span></summary>
            <div class="table-wrap">
              <table class="bank"><tbody>${rows}</tbody></table>
            </div>
          </details>
        </div>`;
    }).join("");
  }

  $("topic-list").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="practise-topic"]');
    if (!btn) return;
    const id = btn.closest(".topic").dataset.topic;
    const t = TOPICS.find((x) => x.id === id);
    pick = { kind: "topic", id, name: t ? t.name : id };
    // Picking a topic is asking for words from it, whatever mode was last set.
    state.settings.mode = "words";
    commit();
    drawModes();
    showScreen("practice");
    updateStartBlurb();
    resetPracticeView();
    startRound();
  });

  /* ------------------------------------------------------------------
     Lessons
     ------------------------------------------------------------------ */

  const PERSONS = Verbs.VERBS.persons;
  const FAMILIES = Verbs.VERBS.families;

  /* One table of a tense across the three families, filled from the real
     example verbs rather than shown as bare endings, because -ar -as -a is
     hard to hold on to and hablo hablas habla is not. */
  function tenseTable(tense) {
    const head = FAMILIES.map((f) =>
      `<th>${esc(f.name)}<div class="muted small">${esc(f.example)}</div></th>`).join("");
    const rows = PERSONS.map((p) => `
      <tr>
        <th>${esc(p.label)}<div class="muted small">${esc(p.gloss)}</div></th>
        ${FAMILIES.map((f) => {
          const form = Verbs.conjugate(f.example, tense.id, p.id);
          const ending = tense.endings[f.id][p.id];
          const stem = form.slice(0, form.length - ending.length);
          return `<td${sayAttr(form)}><span class="stem">${esc(stem)}</span><b>${esc(ending)}</b></td>`;
        }).join("")}
      </tr>`).join("");
    return `<div class="table-wrap"><table class="conj">
      <thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function irregularTable(verb) {
    const tenses = Verbs.VERBS.tenses.filter((t) => verb.forms[t.id]);
    const head = tenses.map((t) => `<th>${esc(t.name)}</th>`).join("");
    const rows = PERSONS.map((p) => `
      <tr>
        <th>${esc(p.label)}</th>
        ${tenses.map((t) => {
          const form = Verbs.conjugate(verb.infinitive, t.id, p.id) || "";
          return `<td${sayAttr(form)}><b>${esc(form)}</b></td>`;
        }).join("")}
      </tr>`).join("");
    return `<div class="table-wrap"><table class="conj">
      <thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderGrammarLessons() {
    $("grammar-lessons").innerHTML = GRAMMAR.lessons.map((l) => `
      <details class="lesson" data-grammar="${esc(l.id)}">
        <summary>${esc(l.title)}<span class="muted small">${esc(l.blurb)}</span></summary>
        <div class="lesson-body">${l.explain.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        <div class="examples">
          ${l.examples.map(([es, en]) => `
            <div class="example">
              <span>${tappable(es)}${sayButton(es)}</span>
              <span class="muted small">${esc(en)}</span>
            </div>`).join("")}
        </div>
        ${l.mistake ? `<p class="mistake"><s>${esc(l.mistake[0])}</s><b>${tappable(l.mistake[1])}</b>`
          + `<span class="muted small">${esc(l.mistake[2])}</span></p>` : ""}
        <button class="btn" data-act="grammar">Practise this</button>
      </details>`).join("");
  }

  $("grammar-lessons").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="grammar"]');
    if (!btn) return;
    state.settings.mode = "grammar";
    state.settings.grammar = btn.closest("[data-grammar]").dataset.grammar;
    commit();
    round = null; card = null;
    drawModes();
    showScreen("practice");
    updateStartBlurb();
    resetPracticeView();
    startRound();
  });

  function renderLessons() {
    renderGrammarLessons();
    $("verb-tenses").innerHTML = Verbs.VERBS.tenses.map((t) => `
      <details class="lesson" data-drill="tense:${esc(t.id)}">
        <summary>${esc(t.name)}<span class="muted small">${esc(t.blurb)}</span></summary>
        ${tenseTable(t)}
        ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
        <button class="btn" data-act="drill">Practise this table</button>
      </details>`).join("");

    $("verb-irregulars").innerHTML = Verbs.VERBS.irregulars.map((v) => `
      <details class="lesson" data-drill="verb:${esc(v.infinitive)}">
        <summary>${esc(v.infinitive)}<span class="muted small">${esc(v.gloss)}
          &middot; ${esc(Pronounce.respell(v.infinitive))}</span></summary>
        ${irregularTable(v)}
        ${v.note ? `<p class="note">${esc(v.note)}</p>` : ""}
        <button class="btn" data-act="drill">Practise this verb</button>
      </details>`).join("");

    $("verb-notes").innerHTML = Verbs.VERBS.notes.map((n) => `
      <details class="lesson">
        <summary>${esc(n.title)}</summary>
        <p class="lesson-body">${esc(n.body)}</p>
      </details>`).join("");

    $("pron-rules").innerHTML = Pronounce.RULES.map((r) => `
      <details class="lesson">
        <summary>${esc(r.letters)}<span class="muted small">says ${esc(r.says)}</span></summary>
        <div class="examples">
          ${r.examples.map(([es, en]) => `
            <div class="example">
              <b${sayAttr(es)}>${esc(es)}</b>
              <span class="say-cell">${esc(Pronounce.respell(es))}</span>
              <span class="muted small">${esc(en)}</span>
            </div>`).join("")}
        </div>
        ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
      </details>`).join("")
      + `<details class="lesson">
           <summary>${esc(Pronounce.STRESS_NOTE.title)}</summary>
           <p class="lesson-body">${esc(Pronounce.STRESS_NOTE.body)}</p>
         </details>`;
  }

  /* Turn a table into cards. Every item's answer is read out of verbs.js, so
     a drill cannot ask for a form the lesson does not show. */
  /* The Verb endings mode, with no table picked: the present tense of the
     three regular families and the five verbs you cannot get through a
     sentence without. Deliberately small. Every tense of every irregular is
     sixty-odd cards and a reason to stop, and the Lessons screen is still
     there for anyone who wants a particular table. */
  const STARTER_VERBS = ["ser", "estar", "tener", "ir", "hacer"];

  function starterDrill(tenseId) {
    const wanted = tenseId && tenseId !== "mixed"
      ? Verbs.VERBS.tenses.filter((t) => t.id === tenseId)
      : Verbs.VERBS.tenses;
    const items = [];
    const add = (infinitive, gloss, note, tense) => {
      // Only forms the tables can vouch for; the rest would be invented.
      if (!Verbs.isVouchedFor(infinitive, tense.id)) return;
      for (const p of PERSONS) {
        const answer = Verbs.conjugate(infinitive, tense.id, p.id);
        if (!answer) continue;
        items.push({ infinitive, gloss, answer, note,
          tenseName: tense.name, personLabel: p.label, personShort: p.short,
          english: Verbs.englishPhrase(gloss, p.id, tense.id) });
      }
    };
    for (const tense of wanted) {
      for (const f of FAMILIES) add(f.example, f.gloss, tense.note, tense);
      for (const id of STARTER_VERBS) {
        const verb = Verbs.VERBS.irregulars.find((v) => v.infinitive === id);
        if (verb) add(verb.infinitive, verb.gloss, verb.note, tense);
      }
    }
    const name = wanted.length === 1
      ? `${wanted[0].name}, the verbs you need first`
      : "Every tense mixed together, the verbs you need first";
    return { name, items, starter: true };
  }

  function drillItems(spec) {
    const [kind, key] = spec.split(":");
    const items = [];
    const push = (infinitive, gloss, tense, person, note) => {
      const answer = Verbs.conjugate(infinitive, tense.id, person.id);
      if (answer) {
        items.push({ infinitive, gloss, answer, note,
          tenseName: tense.name, personLabel: person.label,
          personShort: person.short,
          english: Verbs.englishPhrase(gloss, person.id, tense.id) });
      }
    };

    if (kind === "tense") {
      const tense = Verbs.VERBS.tenses.find((t) => t.id === key);
      for (const f of FAMILIES) for (const p of PERSONS) push(f.example, f.gloss, tense, p, tense.note);
      return { name: `${tense.name}, regular verbs`, items };
    }
    const verb = Verbs.VERBS.irregulars.find((v) => v.infinitive === key);
    for (const t of Verbs.VERBS.tenses) {
      if (!verb.forms[t.id]) continue;
      for (const p of PERSONS) push(verb.infinitive, verb.gloss, t, p, verb.note);
    }
    return { name: `${verb.infinitive}, ${verb.gloss}`, items };
  }

  $("screen-lessons").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="drill"]');
    if (!btn) return;
    const spec = btn.closest("[data-drill]").dataset.drill;
    const built = drillItems(spec);
    if (!built.items.length) { toast("Nothing to drill in that table.", true); return; }
    pick = { kind: "drill", id: spec, name: built.name, items: built.items };
    state.settings.mode = "verbs";
    commit();
    drawModes();
    showScreen("practice");
    updateStartBlurb();
    resetPracticeView();
    startRound();
  });

  /* ------------------------------------------------------------------
     Manage
     ------------------------------------------------------------------ */

  let bankFilter = "all";
  let editingId = null;

  $("quick-filters").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    bankFilter = pill.dataset.filter;
    document.querySelectorAll("#quick-filters .pill").forEach((p) => p.classList.toggle("on", p === pill));
    renderBank();
  });

  $("filter").addEventListener("input", renderBank);

  function renderBank() {
    const q = Engine.normalise($("filter").value);
    const withSentence = new Set(sentences().map((s) => s.wordId));
    const rows = words().filter((w) => {
      const p = prog(w.id);
      const band = Engine.bandForLevel(p.level);
      if (bankFilter === "disabled" && p.enabled !== false) return false;
      if (bankFilter !== "disabled" && bankFilter !== "all" && p.enabled === false) return false;
      if (bankFilter === "recognition" && band.key !== "recognition") return false;
      if (bankFilter === "production" && band.key !== "production") return false;
      if (bankFilter === "cloze" && band.key !== "cloze") return false;
      if (bankFilter === "nosentence" && !(band.key === "cloze" && !withSentence.has(w.id))) return false;
      if (q) {
        const hay = Engine.normalise([w.es, ...(w.es_alt || []), ...w.en, w.note || ""].join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => prog(b.id).level - prog(a.id).level || a.es.localeCompare(b.es, "es"));

    $("bank-body").innerHTML = rows.map((w) => {
      const p = prog(w.id);
      const band = Engine.bandForLevel(p.level);
      const needsSentence = band.key === "cloze" && !withSentence.has(w.id);
      const acc = accuracy(p);
      if (editingId === w.id) return editRow(w);
      return `
        <tr class="${p.enabled === false ? "off" : ""}" data-id="${esc(w.id)}">
          <td class="es">${esc(w.es)}${needsSentence ? '<span class="flag">needs a sentence</span>' : ""}
            ${(w.es_alt || []).length ? `<div class="muted small">${esc(w.es_alt.join(", "))}</div>` : ""}</td>
          <td>${esc(w.en.join(", "))}
            ${w.note ? `<div class="muted small">${esc(w.note)}</div>` : ""}</td>
          <td class="lvl">${p.level}</td>
          <td class="small">${esc(band.label)}</td>
          <td class="mono small">${p.timesSeen}</td>
          <td class="mono small">${p.totalCorrect}</td>
          <td class="mono small">${p.totalWrong}${acc === null ? "" : `<div class="muted">${acc}%</div>`}</td>
          <td><div class="row-actions">
            <button class="btn" data-act="edit">Edit</button>
            <button class="btn" data-act="toggle">${p.enabled === false ? "Enable" : "Disable"}</button>
          </div></td>
        </tr>`;
    }).join("") || '<tr><td colspan="8" class="muted small">Nothing matches that filter.</td></tr>';
  }

  function editRow(w) {
    return `
      <tr class="edit-row" data-id="${esc(w.id)}"><td colspan="8">
        <div class="edit-grid">
          <label class="field"><span>Spanish</span><input data-f="es" value="${esc(w.es)}"></label>
          <label class="field"><span>Other accepted Spanish</span><input data-f="es_alt" value="${esc((w.es_alt || []).join(", "))}"></label>
          <label class="field"><span>English</span><input data-f="en" value="${esc(w.en.join(", "))}"></label>
          <label class="field"><span>Part of speech</span><input data-f="pos" value="${esc(w.pos || "")}"></label>
          <label class="field"><span>Note</span><input data-f="note" value="${esc(w.note || "")}"></label>
          <label class="field"><span>Level</span><input data-f="level" type="number" min="1" max="${Engine.CONFIG.LEVEL_CEILING}" value="${prog(w.id).level}"></label>
        </div>
        <div class="row-actions" style="margin-top:10px">
          <button class="btn primary" data-act="save">Save</button>
          <button class="btn" data-act="cancel">Cancel</button>
        </div>
      </td></tr>`;
  }

  $("bank-body").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr.dataset.id;

    if (btn.dataset.act === "toggle") {
      const p = progWrite(id);
      p.enabled = p.enabled === false;
      // Stamped so sync can tell a disable happened after the last answer.
      // Without this, disabling a word here would be quietly switched back on
      // by another device that had merely practised it more recently.
      p.changedAt = new Date().toISOString();
      commit(); renderBank(); updateStartBlurb();
      return;
    }
    if (btn.dataset.act === "edit") { editingId = id; renderBank(); return; }
    if (btn.dataset.act === "cancel") { editingId = null; renderBank(); return; }

    if (btn.dataset.act === "save") {
      const get = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
      const es = get("es");
      const en = get("en").split(",").map((s) => s.trim()).filter(Boolean);
      if (!es || !en.length) { toast("A word needs Spanish and at least one English answer.", true); return; }
      state.editedWords[id] = {
        es,
        es_alt: get("es_alt").split(",").map((s) => s.trim()).filter(Boolean),
        en,
        pos: get("pos"),
        note: get("note"),
      };
      const lvl = Number(get("level"));
      if (Number.isFinite(lvl)) {
        progWrite(id).level = Math.max(Engine.CONFIG.LEVEL_MIN, Math.min(Engine.CONFIG.LEVEL_CEILING, Math.round(lvl)));
      }
      editingId = null;
      commit(); renderBank(); refreshWordSelect();
      toast("Saved.");
    }
  });

  $("add-word").addEventListener("submit", (e) => {
    e.preventDefault();
    const es = $("nw-es").value.trim();
    const en = $("nw-en").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!es || !en.length) { toast("A word needs Spanish and at least one English answer.", true); return; }
    const clash = words().find((w) => Engine.normalise(w.es) === Engine.normalise(es));
    if (clash && !window.confirm(`"${clash.es}" is already in the bank. Add it again anyway?`)) return;

    state.customWords.push({
      id: makeWordId(es),
      es,
      es_alt: $("nw-alt").value.split(",").map((s) => s.trim()).filter(Boolean),
      en,
      pos: $("nw-pos").value.trim(),
      // A word added here carries its own topic; topics.js only files the seed.
      topic: $("nw-topic").value,
      note: $("nw-note").value.trim(),
    });
    commit();
    e.target.reset();
    renderBank(); refreshTopicSelect(); refreshWordSelect(); updateStartBlurb();
    toast(`Added "${es}".`);
  });

  function refreshTopicSelect() {
    const sel = $("nw-topic");
    const keep = sel.value;
    sel.innerHTML = '<option value="">(none)</option>'
      + TOPICS.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
    if (keep) sel.value = keep;
  }

  function refreshWordSelect() {
    const sel = $("ns-word");
    const keep = sel.value;
    const withSentence = new Set(sentences().map((s) => s.wordId));
    const list = words().slice().sort((a, b) => {
      // Words with no sentence first; those are the ones blocking cloze.
      const an = withSentence.has(a.id) ? 1 : 0;
      const bn = withSentence.has(b.id) ? 1 : 0;
      return an - bn || a.es.localeCompare(b.es, "es");
    });
    sel.innerHTML = list.map((w) =>
      `<option value="${esc(w.id)}">${esc(w.es)}${withSentence.has(w.id) ? "" : "  (no sentence yet)"}</option>`).join("");
    if (keep) sel.value = keep;
  }

  $("add-sentence").addEventListener("submit", (e) => {
    e.preventDefault();
    const es = $("ns-es").value.trim();
    const en = $("ns-en").value.trim();
    const wordId = $("ns-word").value;
    const m = es.match(/\{([^}]+)\}/);
    if (!m) { toast("Wrap the target form in curly braces, for example {comemos}.", true); return; }
    if (!en) { toast("Give the sentence an English translation.", true); return; }
    state.customSentences.push({ id: makeSentenceId(), wordId, es, answer: m[1].trim(), en });
    commit();
    e.target.reset();
    refreshWordSelect(); renderBank();
    toast(`Sentence added for "${(words().find((w) => w.id === wordId) || {}).es || wordId}".`);
  });

  /* ------------------------------------------------------------------
     Progress
     ------------------------------------------------------------------ */

  function renderProgress() {
    const all = words();
    const counts = { recognition: 0, production: 0, cloze: 0 };
    let seen = 0, right = 0, wrong = 0, almost = 0, atCeiling = 0;
    for (const w of all) {
      const p = prog(w.id);
      counts[Engine.bandForLevel(p.level).key] += 1;
      if (p.timesSeen) seen += 1;
      right += p.totalCorrect;
      wrong += p.totalWrong;
      almost += p.totalAlmost || 0;
      if (p.level >= Engine.CONFIG.BAND_CLOZE_TOP) atCeiling += 1;
    }
    const total = all.length || 1;

    $("band-bars").innerHTML = [
      ["Recognition", "L1 to L3", counts.recognition, ""],
      ["Production", "L4 to L7", counts.production, "b2"],
      ["Cloze", "L8 and up", counts.cloze, "b3"],
    ].map(([name, range, n, cls]) => `
      <div class="band-row">
        <div class="band-name">${name}<div class="muted small">${range}</div></div>
        <div class="band-track"><i class="${cls}" style="width:${(n / total) * 100}%"></i></div>
        <div class="band-count">${n}</div>
      </div>`).join("");

    const answered = right + wrong;
    $("progress-stats").innerHTML = [
      stat(all.length, "words in bank"),
      stat(seen, "words seen"),
      stat(atCeiling, "at level 10 or above"),
      stat(answered ? Math.round((right / answered) * 100) + "%" : "-", "lifetime accuracy"),
      stat(answered, "cards answered"),
      stat(almost, "near misses"),
      stat(state.stats.rounds, "rounds done"),
    ].join("");

    /* The words that are not going in. Sorted by how many misses are standing
       against them, so the worst of it is at the top, and capped at a dozen
       because a list of fifty is a reason to give up rather than a thing to
       work on. */
    const sticking = all
      .map((w) => ({ w, p: prog(w.id) }))
      .filter((x) => Engine.isSticking(x.p))
      .sort((a, b) => (b.p.lapses || 0) - (a.p.lapses || 0) || a.p.level - b.p.level)
      .slice(0, 12);

    $("sticking-body").innerHTML = sticking.length
      ? sticking.map(({ w, p }) => `
          <tr>
            <td class="es">${esc(w.es)}</td>
            <td>${esc(w.en.join(", "))}</td>
            <td class="lvl">${p.level}</td>
            <td class="mono">${p.lapses}</td>
            <td class="mono small">${accuracy(p) === null ? "-" : accuracy(p) + "%"}</td>
          </tr>`).join("")
      : '<tr><td colspan="5" class="muted small">Nothing sticking yet. Long may it last.</td></tr>';

    const streaks = all
      .map((w) => ({ w, p: prog(w.id) }))
      .filter((x) => x.p.correctStreak > 0)
      .sort((a, b) => b.p.correctStreak - a.p.correctStreak || b.p.level - a.p.level)
      .slice(0, 12);

    $("streak-body").innerHTML = streaks.length
      ? streaks.map(({ w, p }) => `
          <tr>
            <td class="es">${esc(w.es)}</td>
            <td>${esc(w.en.join(", "))}</td>
            <td class="lvl">${p.level}</td>
            <td class="mono">${p.correctStreak}</td>
            <td class="mono small">${accuracy(p) === null ? "-" : accuracy(p) + "%"}</td>
          </tr>`).join("")
      : '<tr><td colspan="5" class="muted small">No streaks yet; answer a few cards.</td></tr>';
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  if (loaded.warning) toast(loaded.warning, true);
  // The head script has already set the attribute; this keeps the meta colour
  // and the stored value in step with it.
  applyTheme(loadTheme());
  /* No voice, no Listen mode and no "tap to hear" hints. Everything else
     works as it did before there was any sound. */
  document.body.classList.toggle("no-speech", !Speech.supported);
  document.querySelector('#modes [data-mode="listen"]').hidden = !Speech.supported;
  drawSoundToggle();
  drawSync();
  /* A pairing link opened on the second device. Taken before the first sync,
     so the very next thing that happens is a pull from the box the link
     names, and the hash is cleared straight afterwards: leaving the code in
     the address bar puts it in the history and in anything that reads a
     shared screen. Not quiet, because the whole point is to know it worked. */
  if (Sync.readPairingLink(location.hash)) {
    const paired = Sync.readPairingLink(location.hash);
    rememberSync(paired);
    history.replaceState(null, "", location.pathname + location.search);
    /* One message, after the first sync rather than before it: "paired" and
       "paired and your progress is actually here" are different things to be
       told, and only the second is the one worth celebrating. */
    doSync({ quiet: true }).then((worked) => {
      toast(worked
        ? "Paired with your other device, and your progress is here."
        : "Paired, but the first sync failed. Try Sync now from the menu.", !worked);
    });
  } else {
    // On load, not blocking it: the app is already usable by the time this runs.
    doSync({ quiet: true });
  }
  startGoogle();
  maybeNudgeBackup();
  /* Ask the browser to treat this site's storage as something to keep, not
     a cache to clear when space runs short. Chrome mostly says yes; Safari
     promises nothing, which is why Google Drive exists. */
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  refreshMenu();
  applyPace();
  drawModes();
  refreshTopicSelect();
  refreshWordSelect();
  updateStartBlurb();
  resetPracticeView();

  // Enter moves on from the verdict as well as submitting the answer, so a
  // round can be done without touching the mouse.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if ($("card").hidden) return;
    // On an introduction the only action is Got it.
    if (card && card.intro) { e.preventDefault(); $("btn-got").click(); return; }
    // On a tile card Enter checks what has been placed so far.
    if (card && card.band.key === "build" && $("verdict").hidden) {
      e.preventDefault(); $("btn-build-check").click(); return;
    }
    if ($("verdict").hidden) return;
    e.preventDefault();
    // Enter takes the primary action, which on an amber card is the second
    // go. Only the first one, though: past that, Enter has to mean Next, or
    // a card you cannot spell becomes a card you cannot leave.
    const retryOffered = !$("btn-retry").hidden && retypes === 0;
    (retryOffered ? $("btn-retry") : $("btn-next")).click();
  });

  window.addEventListener("beforeunload", () => Store.saveNow(state));

  // Handy in the console while extending the bank by hand.
  window.Idioma = { get state() { return state; }, get round() { return round; }, Engine, Store, toast, glossFor, tappable };
})();
