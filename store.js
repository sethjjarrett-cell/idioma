/* Persistence: one localStorage key, and the Export/Import that lets the
   whole thing be backed up or hand-edited.

   Shape of the saved state:
     {
       version, savedAt,
       settings: { typoTolerance, introduceNew, roundSize },
       progress: { [wordId]: { level, correctStreak, totalCorrect,
                               totalWrong, lastSeen, timesSeen, lapses,
                               enabled } },
       phrases:  { [sentenceId]: ...the same shape },
       customWords: [ ...same shape as a seed word ],
       customSentences: [ ...same shape as a seed sentence ],
       editedWords: { [wordId]: { ...fields overridden by hand } },
       stats: { rounds, lastRoundAt, todayLast, todayStreak },
       grammar: { [lessonId|question]: { n, r, last, streak, at } },
       hooks: { [wordId]: { text, at } }
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
      pace: "steady",                // gentle, steady or brisk; see PACES
      mode: "words",                 // words, verbs or sentences
      tense: "present",              // which tense the verb drill asks about
      pos: "all",                    // which kind of word a words round draws
      subject: "all",                // what a sentences round is about
    },
    progress: {},
    /* Sentences keep their own book. Same shape, same level machinery, but a
       separate map: a sentence's level says how well you can say that
       sentence, and mixing it in with the words would make both mean less.
       Ids cannot collide either way, which is a happy accident rather than
       something to rely on. */
    phrases: {},
    /* Answers the learner said were right after all, per word and per side.
       Kept apart from editedWords, which is the Manage screen's, so that
       editing a word by hand does not silently throw these away. */
    accepted: {},
    customWords: [],
    customSentences: [],
    editedWords: {},
    /* todayLast is the local date (YYYY-MM-DD) the daily session was last
       finished, and todayStreak how many days running that has happened. */
    stats: { rounds: 0, lastRoundAt: null, todayLast: null, todayStreak: 0 },
    /* How each grammar question has gone, keyed by topic and sentence, so the
       drills can lean on the ones you get wrong. Separate from progress: a
       grammar question is not a word and has no level. A state saved before
       this existed simply has none yet, and starts empty. */
    grammar: {},
    /* Memory hooks the learner wrote for words that would not stick, keyed by
       word id: { text, at }. An emptied hook keeps its row with no text, so a
       deletion syncs like an edit instead of coming back from the other
       device. A state saved before hooks existed has none, and starts empty. */
    hooks: {},
  };
}

/* Same caution as the grammar record: only rows with a text string and a
   time survive, so a hand-edited backup cannot break the card. */
function cleanHooks(h) {
  if (!h || typeof h !== "object" || Array.isArray(h)) return {};
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (v && typeof v === "object" && typeof v.text === "string") {
      out[k] = { text: v.text.slice(0, 500), at: typeof v.at === "string" ? v.at : null };
    }
  }
  return out;
}

/* A word's hook, or "" when it has none. */
function hookFor(state, id) {
  const h = (state.hooks || {})[id];
  return h && h.text ? h.text : "";
}

function setHook(state, id, text) {
  if (!state.hooks) state.hooks = {};
  state.hooks[id] = { text: String(text || "").trim().slice(0, 500), at: new Date().toISOString() };
}

/* What a grammar record must look like to be kept: an object of plain
   objects. Anything else, from a hand-edited backup or a newer version,
   is dropped rather than allowed to break the drills. */
function cleanGrammar(g) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return {};
  const out = {};
  for (const [k, v] of Object.entries(g)) {
    if (v && typeof v === "object" && Number.isFinite(v.n)) out[k] = v;
  }
  return out;
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
    merged.grammar = cleanGrammar(parsed.grammar);
    merged.hooks = cleanHooks(parsed.hooks);
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
/* Everything a card will accept for one word beyond the word itself: the
   curated list, and whatever the learner has said they were right about.

   Kept out of `es` and `en` on purpose. Those two are what the card shows, and
   a prompt reading "pretty, nice, lovely, beautiful, good looking" answers
   itself from the other direction. Accepted and not shown is the whole point. */
function alternatives(state, id, side) {
  const curated = (window.EQUIVALENTS || {})[id] || {};
  const learned = (state.accepted || {})[id] || {};
  const out = [];
  for (const v of (curated[side] || []).concat(learned[side] || [])) {
    // normalise, not fold: fold leaves the punctuation on, so "cómo estás"
    // and "¿cómo estás?" would read as two different alternatives.
    const key = Engine.normalise(v);
    if (key && !out.some((have) => Engine.normalise(have) === key)) out.push(v);
  }
  return out;
}

function allWords(state) {
  const edits = state.editedWords || {};
  const senses = window.SENSES || {};
  /* A hand edit wins over the sense tag and the alternatives, so any of them
     can be overridden or cleared from the Manage screen like anything else
     about a word. */
  const apply = (w) => {
    let base = w;
    const sense = senses[w.id];
    if (sense) base = { ...base, sense };
    const es = alternatives(state, w.id, "es").filter((v) =>
      Engine.fold(v) !== Engine.fold(w.es));
    const en = alternatives(state, w.id, "en").filter((v) =>
      !w.en.some((have) => Engine.fold(have) === Engine.fold(v)));
    if (es.length) base = { ...base, es_alt: (base.es_alt || []).concat(es) };
    if (en.length) base = { ...base, en_alt: (base.en_alt || []).concat(en) };
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

/* ---------------------------------------------------------------
   Sentences
   --------------------------------------------------------------- */

/* Everything that can be practised as a whole sentence, from two sources.

   `phrases.js` is the ladder: short things to say, written outwards from the
   earliest words so that there is something to do in the first session. The
   bank's own sentences are the long tail, and they come in with their braces
   taken out, because a sentence being translated is not a sentence with a
   hole in it.

   A bank sentence and a ladder item can say the same thing. That is not worth
   de-duplicating: they are drawn by weight, and a repeat costs one card. */
function allPhrases(state) {
  const ladder = ((window.PHRASES && window.PHRASES.items) || [])
    .map((it) => ({ ...it, source: "ladder" }));
  const fromBank = allSentences(state).map((s) => ({
    id: "s:" + s.id,
    es: String(s.es).replace(/[{}]/g, ""),
    en: s.en,
    source: "bank",
    wordId: s.wordId,
  }));
  return ladder.concat(fromBank);
}

/* Which topic a word belongs to, from whichever of the two places says so.

   A generated word carries its own topic. A seed word does not, because
   seed.js is the bank as it was supplied and topics.js was written alongside
   it to file exactly those words. Neither source is wrong; a caller just has
   to ask both, so it asks this instead. */
let topicCache = null;

function topicOf(state, word) {
  if (word.topic) return word.topic;
  if (!topicCache) {
    topicCache = new Map();
    for (const t of (window.TOPICS || [])) {
      for (const id of t.words) topicCache.set(id, t.id);
    }
  }
  return topicCache.get(word.id) || null;
}

/* Every conjugated form of one verb the tables can build. Handed to the
   engine so that "tengo" in a sentence counts as knowing tener, without the
   engine having to know what a verb is. */
function verbForms(infinitive, tenses) {
  const out = [];
  if (!window.Verbs) return out;
  for (const t of window.Verbs.VERBS.tenses) {
    if (tenses && !tenses.includes(t.id)) continue;
    /* Only the forms the tables can vouch for. Asking for every tense of
       every verb is how you end up claiming "tenería" is Spanish. */
    if (!window.Verbs.isVouchedFor(infinitive, t.id)) continue;
    for (const person of ["yo", "tu", "el", "nosotros", "ellos"]) {
      const f = window.Verbs.conjugate(infinitive, t.id, person);
      if (f) out.push(f);
    }
  }
  return out;
}

/* The form index and the per-sentence word lists, worked out once. Both are
   pure functions of the bank, so the only thing that invalidates them is a
   word or a sentence being added, which the count catches. */
let sentenceCache = null;

function sentenceIndex(state) {
  const words = allWords(state);
  const items = allPhrases(state);
  const key = words.length + ":" + items.length;
  if (sentenceCache && sentenceCache.key === key) return sentenceCache;

  const sentences = allSentences(state);
  const forWord = new Map();
  for (const s of sentences) {
    if (!forWord.has(s.wordId)) forWord.set(s.wordId, []);
    forWord.get(s.wordId).push(s);
  }
  /* A chunk is bank Spanish like a sentence, so the form it braces counts
     too: "me duele" teaches duele, which the verb tables cannot build. */
  for (const [id, chunk] of Object.entries(window.CHUNKS || {})) {
    const m = /\{([^}]+)\}/.exec(chunk[0]);
    if (!m) continue;
    if (!forWord.has(id)) forWord.set(id, []);
    forWord.get(id).push({ answer: m[1] });
  }
  const rankOf = window.TeachingOrder ? window.TeachingOrder.rankOf : () => 0;
  const forms = Engine.buildFormIndex(words, (id) => forWord.get(id) || [],
    { conjugate: verbForms, rankOf });

  /* A sentence's theme is the topic of the least common word in it.

     "Quiero ir a la playa" needs querer, ir and playa; what it is about is
     the beach, not the wanting, and the rarest word is reliably the one
     carrying the subject. Counting topics and taking the winner sounds more
     careful and is worse: every sentence has two or three glue words in it,
     so glue would win nearly all of them. */
  const byId = new Map(words.map((w) => [w.id, w]));
  const rows = items.map((item) => {
    const { needs, loose } = Engine.sentenceNeeds(item.es, forms);
    let theme = null, worst = -1;
    for (const id of needs) {
      const r = rankOf(id);
      const w = byId.get(id);
      if (w && r >= worst) { worst = r; theme = topicOf(state, w) || theme; }
    }
    return { item, needs, loose, theme,
             rank: Engine.sentenceRank(needs, rankOf) };
  });
  sentenceCache = { key, forms, rows };
  return sentenceCache;
}

/* The sentences the learner could attempt right now: every word in them met,
   and no token the bank cannot account for. */
function readyPhrases(state, progressFor) {
  return sentenceIndex(state).rows
    .filter((r) => !r.loose.length && Engine.sentenceReady(r.needs, progressFor));
}

/* Plausible wrong tiles. Words the learner has met, so they are recognisable
   rather than noise, and never a word already in the sentence.

   A near-miss form of a verb already in the sentence is the useful decoy, so
   those go first: offering tengo, tienes and tiene is a question about the
   ending, which is the thing being learned. */
function tileDistractors(state, item, needs, progressFor, count) {
  const inSentence = new Set(Engine.tokenise(item.es));
  const out = [];
  const push = (form) => {
    const t = Engine.wordToken(form);
    if (!t || inSentence.has(t) || out.some((o) => Engine.wordToken(o) === t)) return;
    out.push(form);
  };
  const byId = new Map(allWords(state).map((w) => [w.id, w]));
  for (const id of needs) {
    const w = byId.get(id);
    if (w && w.pos === "verb") for (const f of verbForms(w.es, ["present"])) push(f);
  }
  const met = allWords(state)
    .filter((w) => progressFor(w.id).timesSeen > 0 && !String(w.es).includes(" "));
  for (const w of Engine.shuffle(met)) {
    if (out.length >= count * 3) break;
    push(w.es);
  }
  return Engine.shuffle(out).slice(0, count);
}

/* Remember that an answer was right after all.

   No curated list of synonyms will ever be complete, and being marked wrong
   twice for the same answer is what makes an app feel broken. So the override
   is not just a correction to one card: it is the learner telling the app a
   word it did not know, and the app is expected to remember.

   Side is "es" or "en" depending on which way the card was asking. Stored
   folded-unique so pressing it twice does not stack up duplicates. */
function rememberAccepted(state, wordId, side, answer) {
  const text = String(answer == null ? "" : answer).trim();
  if (!wordId || !text || (side !== "es" && side !== "en")) return false;
  if (!state.accepted) state.accepted = {};
  if (!state.accepted[wordId]) state.accepted[wordId] = {};
  const list = state.accepted[wordId][side] || [];

  /* Whether this would already pass is the grader's question, not ours: it
     strips punctuation and optional articles, so comparing strings here would
     remember "cómo estás" as new when "¿cómo estás?" is already accepted. */
  const word = allWords(state).find((w) => w.id === wordId);
  const already = !word ? list
    : side === "es" ? [word.es].concat(word.es_alt || [])
    : word.en.concat(word.en_alt || []);
  if (already.length && Engine.checkAnswer(text, already).correct) return false;

  state.accepted[wordId][side] = list.concat(text);
  return true;
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

/* The same pair again for the sentence book. Kept as separate functions
   rather than a parameter, so that a call site cannot quietly write a
   sentence's level into a word's row. */
function peekPhrase(state, id) {
  return (state.phrases || {})[id] || Engine.freshProgress();
}

function phraseProgressFor(state, id) {
  if (!state.phrases) state.phrases = {};
  if (!state.phrases[id]) state.phrases[id] = Engine.freshProgress();
  return state.phrases[id];
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
  merged.accepted = merged.accepted && typeof merged.accepted === "object" ? merged.accepted : {};
  merged.phrases = merged.phrases && typeof merged.phrases === "object" ? merged.phrases : {};
  for (const [id, p] of Object.entries(merged.phrases)) {
    merged.phrases[id] = { ...Engine.freshProgress(), ...p };
  }
  merged.grammar = cleanGrammar(parsed.grammar);
  merged.hooks = cleanHooks(parsed.hooks);
  return merged;
}

window.Store = {
  STORAGE_KEY, STATE_VERSION, defaultState, load, save, saveNow, hookFor, setHook,
  allWords, allSentences, siblingsOf, peekProgress, progressFor, alternatives, rememberAccepted,
  allPhrases, sentenceIndex, readyPhrases, tileDistractors, verbForms, topicOf,
  peekPhrase, phraseProgressFor, downloadExport, parseImport,
};
