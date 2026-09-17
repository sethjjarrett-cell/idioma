/* Persistence: one localStorage key, and the Export/Import that lets the
   whole thing be backed up or hand-edited.

   Shape of the saved state:
     {
       version, savedAt,
       settings: { typoTolerance, introduceNew, roundSize },
       progress: { [wordId]: { level, correctStreak, totalCorrect,
                               totalWrong, lastSeen, timesSeen, enabled } },
       customWords: [ ...same shape as a seed word ],
       customSentences: [ ...same shape as a seed sentence ],
       editedWords: { [wordId]: { ...fields overridden by hand } },
       stats: { rounds, lastRoundAt }
     }

   Words added or edited in the app are kept separately from the bank
   rather than copied over it, so a later edit to seed.js or vocab.js still
   shows through and an Export stays small and readable.
*/

const STORAGE_KEY = "idioma.state.v1";
const STATE_VERSION = 1;

function defaultState() {
  return {
    version: STATE_VERSION,
    savedAt: null,
    settings: {
      typoTolerance: false,          // off by default, as the brief asks
      introduceNew: true,            // a word you have not met is shown first
      roundSize: Engine.CONFIG.ROUND_SIZE,
    },
    progress: {},
    customWords: [],
    customSentences: [],
    editedWords: {},
    stats: { rounds: 0, lastRoundAt: null },
  };
}

/* A bad or half-written value in storage must not cost the user their
   progress silently, so a failed parse keeps the raw text aside under a
   second key and the caller is told. */
function load() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return { state: defaultState(), warning: "This browser is blocking local storage, so progress will not survive a reload." };
  }
  if (!raw) return { state: defaultState(), warning: null };
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...defaultState(), ...parsed };
    merged.settings = { ...defaultState().settings, ...(parsed.settings || {}) };
    merged.stats = { ...defaultState().stats, ...(parsed.stats || {}) };
    return { state: merged, warning: null };
  } catch (e) {
    try { window.localStorage.setItem(STORAGE_KEY + ".broken", raw); } catch (e2) { /* nothing more to do */ }
    return {
      state: defaultState(),
      warning: "Saved progress could not be read and has been set aside under idioma.state.v1.broken; starting fresh.",
    };
  }
}

let saveTimer = null;
function save(state) {
  state.savedAt = new Date().toISOString();
  // Writing on every keystroke is wasteful; a short debounce keeps the
  // page responsive while still saving well inside a reload.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save state:", e);
    }
  }, 150);
}

function saveNow(state) {
  clearTimeout(saveTimer);
  state.savedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

/* The bank the app actually works from: seed, with hand edits applied and
   custom additions appended. */
function allWords(state) {
  const edits = state.editedWords || {};
  const senses = window.SENSES || {};
  /* A hand edit wins over the sense tag, so a tag can be overridden or
     cleared from the Manage screen like anything else about a word. */
  const apply = (w) => {
    const sense = senses[w.id];
    const base = sense ? { ...w, sense } : w;
    return edits[w.id] ? { ...base, ...edits[w.id] } : base;
  };
  // Three sources, in the order they were written: the supplied seed, the
  // generated bank, then anything added here. A hand edit applies to all of
  // them, which is why it is keyed by id rather than kept per source.
  return SEED.vocabulary.map(apply)
    .concat(VOCAB.vocabulary.map(apply))
    .concat((state.customWords || []).map(apply));
}

/* Which other words could honestly be typed for this one.

   Two words are siblings when they share an English sense: both are a right
   answer to the prompt the learner was shown, so typing the other is a
   reasonable answer to an ambiguous question rather than a mistake. The card
   uses this to say which sense it wanted instead of calling the answer wrong.

   Built once per bank and cached, because it is O(words) and the round asks
   for it on every card. The cache key is the word count, which is enough:
   the only thing that changes the bank mid-session is adding or removing a
   word through the Manage screen. */
let siblingCache = null;

function senseGroups(words) {
  if (siblingCache && siblingCache.size === words.length) return siblingCache.map;
  const byEnglish = new Map();
  for (const w of words) {
    for (const en of w.en || []) {
      const key = Engine.fold(en);
      if (!key) continue;
      if (!byEnglish.has(key)) byEnglish.set(key, []);
      byEnglish.get(key).push(w);
    }
  }
  const map = new Map();
  for (const group of byEnglish.values()) {
    if (group.length < 2) continue;
    for (const w of group) {
      if (!map.has(w.id)) map.set(w.id, new Map());
      for (const other of group) {
        if (other.id === w.id) continue;
        map.get(w.id).set(other.id, { es: other.es, sense: other.sense || "" });
      }
    }
  }
  siblingCache = { size: words.length, map };
  return map;
}

function siblingsOf(words, wordId) {
  const found = senseGroups(words).get(wordId);
  return found ? [...found.values()] : [];
}

function allSentences(state) {
  return SEED.sentences.concat(VOCAB.sentences, state.customSentences || []);
}

/* Read-only: returns defaults for a word that has never been answered,
   without writing anything. Rendering the bank asks about every word, and
   creating a row for each would fill the backup file with 130 identical
   default blocks and make "words seen" meaningless. */
function peekProgress(state, wordId) {
  return state.progress[wordId] || Engine.freshProgress();
}

/* Write path: call this only when a word is actually being changed. */
function progressFor(state, wordId) {
  if (!state.progress[wordId]) state.progress[wordId] = Engine.freshProgress();
  return state.progress[wordId];
}

/* ---------------------------------------------------------------
   Export and import
   --------------------------------------------------------------- */

function exportBlob(state) {
  const payload = { ...state, exportedAt: new Date().toISOString() };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function downloadExport(state) {
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(exportBlob(state));
  const a = document.createElement("a");
  a.href = url;
  a.download = `idioma-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Import replaces the lot. It validates first and throws with something
   readable, because the whole point of the file is that it can be
   hand-edited, and a hand-edited file is a file that can be wrong. */
function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("That file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("That file does not contain an object.");
  if (!parsed.progress || typeof parsed.progress !== "object") {
    throw new Error("That file has no progress section, so it is not an Idioma backup.");
  }
  const merged = { ...defaultState(), ...parsed };
  merged.settings = { ...defaultState().settings, ...(parsed.settings || {}) };
  merged.stats = { ...defaultState().stats, ...(parsed.stats || {}) };
  merged.customWords = Array.isArray(parsed.customWords) ? parsed.customWords : [];
  merged.customSentences = Array.isArray(parsed.customSentences) ? parsed.customSentences : [];
  merged.editedWords = parsed.editedWords && typeof parsed.editedWords === "object" ? parsed.editedWords : {};
  // Fill any gaps so a partially hand-written progress block still loads.
  for (const [id, p] of Object.entries(merged.progress)) {
    merged.progress[id] = { ...Engine.freshProgress(), ...p };
  }
  return merged;
}

window.Store = {
  STORAGE_KEY, STATE_VERSION, defaultState, load, save, saveNow,
  allWords, allSentences, siblingsOf, peekProgress, progressFor, downloadExport, parseImport,
};
