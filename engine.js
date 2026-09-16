/* Mastery engine: levels, bands, card selection and answer checking.

   No DOM in here, so the rules can be read, reasoned about and tested on
   their own. Every number the brief called out is a named constant in
   CONFIG below; nothing numeric is buried in the logic.
*/

const CONFIG = {
  /* Levels. A word never drops to zero, and may climb past 10 internally
     so that a word which keeps being right keeps getting rarer. */
  LEVEL_MIN: 1,
  LEVEL_CEILING: 15,

  /* Band boundaries. L1 to L3 recognition, L4 to L7 production,
     L8 and up cloze. */
  BAND_RECOGNITION_TOP: 3,
  BAND_PRODUCTION_TOP: 7,
  BAND_CLOZE_TOP: 10,

  /* Crossing out of a band takes two right answers in a row, so a single
     lucky guess cannot promote a word into a harder format. */
  BOUNDARY_STREAK: 2,

  ROUND_SIZE: 15,

  /* Selection weight = level part + recency part, floored.

     The level part gives a struggling word up to ten times the pull of a
     mastered one. The recency part climbs with time since the word was
     last seen, so a high-level word surfaces again eventually rather than
     disappearing for good. The floor keeps even a mastered word that was
     just seen in the draw, which is what stops the round becoming the
     same dozen words.

     The two parts are deliberately not equal. Level is worth up to 10 and
     recency up to 5, so a word you keep getting wrong stays ahead of a
     mastered word however long that one has been sitting; recency decides
     the order within a level, and pulls old words back into view, rather
     than overturning level altogether. A week is the point at which the
     recency part is fully paid, which suits a trainer picked up most days
     without punishing a few days off. */
  WEIGHT_LEVEL_BASE: 11,
  WEIGHT_RECENCY_MAX: 5,
  RECENCY_FULL_HOURS: 168,
  WEIGHT_FLOOR: 0.5,

  /* Optional typo tolerance, off by default. Distance 1 catches a single
     slip; distance 2 starts accepting genuinely different words. */
  TYPO_DISTANCE: 1,

  /* Articles a Spanish answer may carry or omit without being wrong. */
  OPTIONAL_ARTICLES: ["el", "la", "los", "las", "un", "una", "unos", "unas"],
};

const BANDS = {
  recognition: { key: "recognition", label: "Recognition", blurb: "Spanish shown, type the English" },
  production: { key: "production", label: "Production", blurb: "English shown, type the Spanish" },
  cloze: { key: "cloze", label: "Cloze", blurb: "Sentence shown, type the missing word" },
};

function bandForLevel(level) {
  if (level <= CONFIG.BAND_RECOGNITION_TOP) return BANDS.recognition;
  if (level <= CONFIG.BAND_PRODUCTION_TOP) return BANDS.production;
  return BANDS.cloze;
}

/* True when moving up from this level would change band, which is the
   case that needs a streak behind it. */
function isBoundaryLevel(level) {
  return level === CONFIG.BAND_RECOGNITION_TOP || level === CONFIG.BAND_PRODUCTION_TOP;
}

function freshProgress() {
  return {
    level: CONFIG.LEVEL_MIN,
    correctStreak: 0,
    totalCorrect: 0,
    totalWrong: 0,
    lastSeen: null,
    timesSeen: 0,
    enabled: true,
  };
}

/* Apply one result and return the updated progress plus what changed, so
   the round summary can report levelled up and dropped without having to
   diff two snapshots itself. */
function applyResult(progress, wasCorrect, now) {
  const p = { ...progress };
  const before = p.level;
  p.timesSeen += 1;
  p.lastSeen = now;

  if (wasCorrect) {
    p.correctStreak += 1;
    p.totalCorrect += 1;
    // A boundary only opens once the streak is long enough; below that the
    // word stays put and keeps its streak, so the next right answer moves it.
    const heldAtBoundary = isBoundaryLevel(p.level) && p.correctStreak < CONFIG.BOUNDARY_STREAK;
    if (!heldAtBoundary) p.level = Math.min(CONFIG.LEVEL_CEILING, p.level + 1);
  } else {
    p.correctStreak = 0;
    p.totalWrong += 1;
    p.level = Math.max(CONFIG.LEVEL_MIN, p.level - 1);
  }

  return {
    progress: p,
    levelBefore: before,
    levelAfter: p.level,
    movedUp: p.level > before,
    movedDown: p.level < before,
    bandChanged: bandForLevel(before).key !== bandForLevel(p.level).key,
  };
}

/* ---------------------------------------------------------------
   Selection
   --------------------------------------------------------------- */

function hoursSince(iso, now) {
  if (!iso) return Infinity;            // never seen, treat as maximally overdue
  const ms = new Date(now) - new Date(iso);
  return ms <= 0 ? 0 : ms / 3600000;
}

function selectionWeight(progress, now) {
  const level = Math.min(progress.level, CONFIG.BAND_CLOZE_TOP);
  const levelPart = CONFIG.WEIGHT_LEVEL_BASE - level;
  const hrs = hoursSince(progress.lastSeen, now);
  const recencyPart = CONFIG.WEIGHT_RECENCY_MAX
    * Math.min(1, hrs / CONFIG.RECENCY_FULL_HOURS);
  return Math.max(CONFIG.WEIGHT_FLOOR, levelPart + recencyPart);
}

/* Draw `count` distinct words by weight. Drawing without replacement
   stops one heavily weighted word filling the round on its own. */
function pickRound(words, progressFor, now, count = CONFIG.ROUND_SIZE) {
  const pool = words
    .filter((w) => progressFor(w.id).enabled !== false)
    .map((w) => ({ word: w, weight: selectionWeight(progressFor(w.id), now) }));
  const picked = [];
  const remaining = pool.slice();
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const total = remaining.reduce((a, c) => a + c.weight, 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let idx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    picked.push(remaining[idx].word);
    remaining.splice(idx, 1);
  }
  return picked;
}

/* ---------------------------------------------------------------
   Building a card
   --------------------------------------------------------------- */

/* Decide what to ask for a word at its current level. A cloze word with
   no sentence falls back to production and says so, which is what the
   Manage screen flags. */
function buildCard(word, progress, sentencesForWord) {
  const band = bandForLevel(progress.level);

  if (band.key === BANDS.cloze.key) {
    const pool = sentencesForWord(word.id);
    if (pool.length) {
      const s = pool[Math.floor(Math.random() * pool.length)];
      return {
        word, band: BANDS.cloze, fellBack: false, sentence: s,
        prompt: s.es.replace(/\{[^}]*\}/, "_____"),
        promptHint: s.en,
        accepted: [s.answer],
        reveal: s.answer,
        revealContext: s.es.replace(/\{([^}]*)\}/, "$1"),
      };
    }
    return {
      ...productionCard(word), fellBack: true,
    };
  }

  if (band.key === BANDS.production.key) return productionCard(word);

  return {
    word, band: BANDS.recognition, fellBack: false, sentence: null,
    prompt: word.es,
    promptHint: word.pos,
    accepted: word.en.slice(),
    reveal: word.en.join(", "),
    revealContext: word.es,
  };
}

function productionCard(word) {
  return {
    word, band: BANDS.production, fellBack: false, sentence: null,
    prompt: word.en.join(", "),
    promptHint: word.pos,
    accepted: [word.es, ...(word.es_alt || [])],
    reveal: word.es,
    revealContext: (word.es_alt || []).length
      ? `also accepted: ${word.es_alt.join(", ")}`
      : "",
  };
}

/* ---------------------------------------------------------------
   Answer checking
   --------------------------------------------------------------- */

/* Fold a typed answer down to something comparable: no case, no accents,
   no punctuation. Typing on a phone keyboard without accents still
   passes; the accented form is always what gets shown back on reveal. */
function normalise(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // strip the combining accents NFD exposed
    .toLowerCase()
    .replace(/[¿¡?!.,;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* The same string with a leading article removed, or null when it has
   none. Lets "la mesa" and "mesa" match each other in both directions. */
function withoutArticle(normalised) {
  const m = normalised.match(/^(\S+)\s+(.+)$/);
  if (m && CONFIG.OPTIONAL_ARTICLES.includes(m[1])) return m[2];
  return null;
}

function variants(normalised) {
  const out = [normalised];
  const bare = withoutArticle(normalised);
  if (bare) out.push(bare);
  return out;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/* Returns { correct, matched, near } where `near` marks a pass that only
   happened because typo tolerance was on, so the UI can say so rather
   than quietly letting a misspelling through. */
function checkAnswer(typed, accepted, options = {}) {
  const typoOn = !!options.typoTolerance;
  const given = variants(normalise(typed));
  if (!given[0]) return { correct: false, matched: null, near: false };

  for (const candidate of accepted) {
    const want = variants(normalise(candidate));
    for (const g of given) {
      for (const w of want) {
        if (g === w) return { correct: true, matched: candidate, near: false };
      }
    }
  }
  if (typoOn) {
    for (const candidate of accepted) {
      const want = variants(normalise(candidate));
      for (const g of given) {
        for (const w of want) {
          if (levenshtein(g, w) <= CONFIG.TYPO_DISTANCE) {
            return { correct: true, matched: candidate, near: true };
          }
        }
      }
    }
  }
  return { correct: false, matched: null, near: false };
}

/* Exported for the browser through the global scope; there is no build
   step and no module loader, which is the point. */
window.Engine = {
  CONFIG, BANDS, bandForLevel, isBoundaryLevel, freshProgress, applyResult,
  selectionWeight, pickRound, buildCard, normalise, checkAnswer, levenshtein,
};
