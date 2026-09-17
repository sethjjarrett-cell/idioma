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

  /* A word you have never met cannot be tested, only guessed at, so the
     first time it comes up it is shown rather than asked: the word, what it
     means, how to say it, and a sentence with it still in place. Testing
     starts the time after.

     The cap stops a round becoming all teaching. Five new words and ten you
     have already met is a round you can actually do; fifteen words you have
     never seen is a vocabulary list. On a fresh bank there is nothing seen
     to fill up with, so the cap gives way rather than shortening the round. */
  INTRODUCE_UNTIL_SEEN: 1,
  MAX_NEW_PER_ROUND: 5,

  /* How many words may be on the go at once. A word counts as settled once
     it is out of the recognition band, which is to say you can produce it
     and not merely recognise it. While more than LEARNING_CAP are short of
     that, no new word is introduced at all.

     This is the whole of the progression rule: new words arrive at up to
     five a round until twenty are unsettled, and then they stop until some
     of those come good. It keeps the first session to five words rather
     than fifteen, and it keeps a bank of hundreds from ever presenting more
     than twenty unfamiliar words at once, without putting a schedule or a
     calendar anywhere near it. */
  SETTLED_LEVEL: 4,
  LEARNING_CAP: 20,

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
     slip, a swapped pair of letters included, since the distance below
     counts a transposition as one edit; distance 2 starts accepting
     genuinely different words. With it
     on, a slip passes outright; with it off, the same slip lands in the
     amber band below rather than being called wrong. */
  TYPO_DISTANCE: 1,

  /* The amber band. A slip of one character is forgiven on any answer; a
     second is only forgiven once the answer is long enough that two
     characters are a smaller share of it, which keeps short answers, where
     two characters are most of a different word, honest. */
  NEAR_DISTANCE: 1,
  NEAR_DISTANCE_LONG: 2,
  NEAR_LONG_FROM: 12,

  /* Articles a Spanish answer may carry or omit without being wrong. The
     bank is not consistent about them and the article is not the form
     being tested. */
  OPTIONAL_ARTICLES: ["el", "la", "los", "las", "un", "una", "unos", "unas"],

  /* Articles on the English side are a different matter: "a glass of
     water" and "glass of water" are not the same Spanish, so they are
     flagged amber rather than waved through. Same for the infinitive
     "to", which the bank writes but a learner often does not. */
  FLAGGED_ARTICLES: ["a", "an", "the"],
  FLAGGED_PREFIXES: ["to"],
};

const BANDS = {
  intro: { key: "intro", label: "New word", blurb: "Shown, not asked" },
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
    totalAlmost: 0,
    lastSeen: null,
    timesSeen: 0,
    enabled: true,
  };
}

/* Apply one result and return the updated progress plus what changed, so
   the round summary can report levelled up and dropped without having to
   diff two snapshots itself.

   The outcome is "correct", "almost" or "wrong". true and false are still
   accepted and mean the first and the last, because that is what every
   caller said before the amber band existed. */
function applyResult(progress, outcome, now) {
  const result = outcome === true ? "correct"
    : outcome === false ? "wrong"
    : String(outcome);
  const p = { ...progress };
  const before = p.level;
  p.timesSeen += 1;
  p.lastSeen = now;

  if (result === "correct") {
    p.correctStreak += 1;
    p.totalCorrect += 1;
    // A boundary only opens once the streak is long enough; below that the
    // word stays put and keeps its streak, so the next right answer moves it.
    const heldAtBoundary = isBoundaryLevel(p.level) && p.correctStreak < CONFIG.BOUNDARY_STREAK;
    if (!heldAtBoundary) p.level = Math.min(CONFIG.LEVEL_CEILING, p.level + 1);
  } else if (result === "seen") {
    // An introduction is not an answer. It marks the word met, so it is not
    // introduced again, and touches nothing else.
  } else if (result === "almost") {
    // An answer one slip from the mark should not cost a level, and should
    // not buy one either: the word holds exactly where it was. The streak
    // stands rather than breaking, so a near miss the learner then fixes
    // can still carry a word across a band boundary.
    p.totalAlmost = (p.totalAlmost || 0) + 1;
  } else {
    p.correctStreak = 0;
    p.totalWrong += 1;
    p.level = Math.max(CONFIG.LEVEL_MIN, p.level - 1);
  }

  return {
    progress: p,
    result,
    held: result === "almost",
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

/* Draw `count` distinct words by weight, without replacement so that one
   heavily weighted word cannot fill the round on its own. */
function drawFrom(pool, count) {
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

/* How many words are part-learned: met, but not yet out of recognition. */
function stillSettling(words, progressFor) {
  return words.filter((w) => {
    const p = progressFor(w.id);
    return p.enabled !== false && p.timesSeen && p.level < CONFIG.SETTLED_LEVEL;
  }).length;
}

/* How many new words this round may introduce. Falls to zero while the
   learner already has a capful on the go, and climbs back as they settle. */
function newWordAllowance(words, progressFor) {
  return Math.max(0, Math.min(CONFIG.MAX_NEW_PER_ROUND,
    CONFIG.LEARNING_CAP - stillSettling(words, progressFor)));
}

/* A round: the new words the allowance permits, then the ones already met.

   The new words are taken in teaching order rather than by weight, because
   among words you have never seen there is nothing to weigh; what matters is
   which is worth knowing first. `options.rankOf` supplies that order, and
   without it they come in bank order.

   Nothing tops the round back up to full length from the new pile. That is
   the point: on a fresh bank the first round is five words, not fifteen
   words nobody has met, and it grows as there is something to grow with. */
function pickRound(words, progressFor, now, count = CONFIG.ROUND_SIZE, options = {}) {
  const maxNew = options.maxNew === undefined
    ? newWordAllowance(words, progressFor)
    : options.maxNew;
  const rankOf = options.rankOf || (() => 0);
  const entry = (w) => ({ word: w, weight: selectionWeight(progressFor(w.id), now) });
  const enabled = words.filter((w) => progressFor(w.id).enabled !== false);
  const isNew = (w) => !progressFor(w.id).timesSeen;

  const fresh = enabled.filter(isNew)
    .sort((a, b) => rankOf(a.id) - rankOf(b.id))
    .slice(0, Math.max(0, Math.min(maxNew, count)));
  const met = enabled.filter((w) => !isNew(w)).map(entry);

  return fresh.concat(drawFrom(met, count - fresh.length));
}

/* ---------------------------------------------------------------
   Building a card
   --------------------------------------------------------------- */

/* Decide what to ask for a word at its current level. A cloze word with
   no sentence falls back to production and says so, which is what the
   Manage screen flags. */
function buildCard(word, progress, sentencesForWord, options = {}) {
  // A word not yet met is shown rather than asked, whatever level it is at.
  if (options.introduce !== false && progress.timesSeen < CONFIG.INTRODUCE_UNTIL_SEEN) {
    return introCard(word, sentencesForWord);
  }
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

/* The teaching card: everything about the word at once, and nothing to type.
   The sentence keeps the word in place rather than blanking it, because the
   point here is to show the word working, not to test whether it is known. */
function introCard(word, sentencesForWord) {
  const pool = sentencesForWord(word.id);
  const s = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  return {
    word, band: BANDS.intro, intro: true, fellBack: false, sentence: s,
    prompt: word.es,
    promptHint: word.pos,
    accepted: [],                       // there is nothing to answer
    reveal: word.en.join(", "),
    revealContext: "",
    example: s ? { es: s.es.replace(/\{([^}]*)\}/, "$1"), en: s.en, target: s.answer } : null,
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

/* Levenshtein, kept because it is the plain definition and the one the
   distance thresholds were set against. */
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

/* The same, but a swapped pair of letters costs one edit rather than two.
   Typing "hunegr" for "hunger" is one slip of the fingers and should be
   judged as one; plain Levenshtein calls it two and sends it to the wrong
   side of the amber threshold. This is the optimal string alignment form,
   which does not allow a substring to be edited twice; that restriction
   does not matter at the distances used here. */
function damerau(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let twoBack = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], twoBack[j - 2] + 1);
      }
    }
    twoBack = prev;
    prev = row;
  }
  return prev[b.length];
}

/* Case and accents folded away, but nothing added or removed, so an index
   into the folded string still points at the same character of the
   original. normalise() makes no such promise, because it also drops
   punctuation and collapses runs of space; the char-level highlight below
   needs the promise. */
function fold(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/* The string with its first word removed, when that word is in the list.
   Used in both directions, so it does not matter which side carried the
   article. */
function stripLeading(normalised, words) {
  const m = normalised.match(/^(\S+)\s+(.+)$/);
  return m && words.includes(m[1]) ? m[2] : normalised;
}

/* Why a typed answer misses, or null when it is too far off to be worth
   flagging rather than failing. Both arguments are already normalised. */
function nearMiss(given, want) {
  const ga = stripLeading(given, CONFIG.FLAGGED_ARTICLES);
  const wa = stripLeading(want, CONFIG.FLAGGED_ARTICLES);
  if (ga === wa) return "article";
  if (stripLeading(ga, CONFIG.FLAGGED_PREFIXES) === stripLeading(wa, CONFIG.FLAGGED_PREFIXES)) {
    return "infinitive";
  }
  const allowance = want.length >= CONFIG.NEAR_LONG_FROM
    ? CONFIG.NEAR_DISTANCE_LONG
    : CONFIG.NEAR_DISTANCE;
  if (damerau(given, want) <= allowance) return "spelling";
  return null;
}

/* Where one word went wrong, as the answer's own letters: the part that
   was right, the part to look at, and the rest. Falls back to marking the
   whole word when folding changed its length, which would put the slice
   indices out by one and highlight the wrong letters. */
function charParts(typedWord, expectedWord) {
  const t = fold(typedWord);
  const e = fold(expectedWord);
  if (e.length !== expectedWord.length) return { head: "", fix: expectedWord, tail: "" };
  let head = 0;
  while (head < t.length && head < e.length && t[head] === e[head]) head++;
  let tail = 0;
  while (tail < e.length - head && tail < t.length - head
         && t[t.length - 1 - tail] === e[e.length - 1 - tail]) tail++;
  return {
    head: expectedWord.slice(0, head),
    fix: expectedWord.slice(head, expectedWord.length - tail),
    tail: expectedWord.slice(expectedWord.length - tail),
  };
}

/* A word-level diff of what was typed against the answer, returned as data
   rather than markup so that app.js keeps sole charge of what the card
   looks like. Words are matched folded, but every op carries the original
   spelling, so the card can show the accents back.

   Ops are "same", "extra" (typed but not in the answer), "missing" (in the
   answer but not typed) and "changed" (one word for another close enough
   to be the same word misspelled, which carries the letter-level parts). */
function diffAnswer(typed, expected) {
  const a = String(typed).trim().split(/\s+/).filter(Boolean);
  const b = String(expected).trim().split(/\s+/).filter(Boolean);
  const same = (x, y) => normalise(x) === normalise(y);

  // Longest common subsequence of the two word lists, from the back, so
  // the walk forwards below can always take the branch that keeps more.
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = same(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) { ops.push({ op: "same", text: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ op: "extra", text: a[i] }); i++; }
    else { ops.push({ op: "missing", text: b[j] }); j++; }
  }
  while (i < a.length) ops.push({ op: "extra", text: a[i++] });
  while (j < b.length) ops.push({ op: "missing", text: b[j++] });

  // An extra next to a missing is usually not two edits but one word typed
  // wrong, and reads far better said that way.
  const out = [];
  for (let k = 0; k < ops.length; k++) {
    const x = ops[k], y = ops[k + 1];
    const pair = y && ((x.op === "extra" && y.op === "missing") || (x.op === "missing" && y.op === "extra"));
    if (pair) {
      const typedWord = x.op === "extra" ? x.text : y.text;
      const wantWord = x.op === "missing" ? x.text : y.text;
      if (damerau(normalise(typedWord), normalise(wantWord)) <= CONFIG.NEAR_DISTANCE_LONG) {
        out.push({ op: "changed", text: wantWord, typed: typedWord, ...charParts(typedWord, wantWord) });
        k++;
        continue;
      }
    }
    out.push(x);
  }
  return out;
}

/* Returns { correct, almost, matched, near, reason, diff }.

   `correct` is a clean pass, with `near` marking one that only happened
   because typo tolerance was on, so the UI can say so rather than quietly
   letting a misspelling through. `almost` is the amber band: close enough
   that calling it wrong would be a lie, far enough that waving it through
   would be a different one. `reason` says which rule caught it and `diff`
   says where, for the card to draw. */
function checkAnswer(typed, accepted, options = {}) {
  const typoOn = !!options.typoTolerance;
  const given = variants(normalise(typed));
  const miss = { correct: false, almost: false, matched: null, near: false, reason: null, diff: null };
  if (!given[0]) return miss;

  for (const candidate of accepted) {
    const want = variants(normalise(candidate));
    for (const g of given) {
      for (const w of want) {
        if (g === w) return { ...miss, correct: true, matched: candidate };
      }
    }
  }
  if (typoOn) {
    for (const candidate of accepted) {
      const want = variants(normalise(candidate));
      for (const g of given) {
        for (const w of want) {
          if (damerau(g, w) <= CONFIG.TYPO_DISTANCE) {
            return { ...miss, correct: true, matched: candidate, near: true };
          }
        }
      }
    }
  }

  // Nothing passed, so find the closest answer worth flagging. Closest by
  // edit distance rather than first listed, so a word with several English
  // glosses is judged against the one actually being reached for.
  let best = null;
  for (const candidate of accepted) {
    const w = normalise(candidate);
    for (const g of given) {
      const reason = nearMiss(g, w);
      if (!reason) continue;
      const distance = damerau(g, w);
      if (!best || distance < best.distance) best = { candidate, reason, distance };
    }
  }
  if (!best) return miss;
  return {
    ...miss,
    almost: true,
    matched: best.candidate,
    reason: best.reason,
    diff: diffAnswer(typed, best.candidate),
  };
}

/* Exported for the browser through the global scope; there is no build
   step and no module loader, which is the point. */
window.Engine = {
  CONFIG, BANDS, bandForLevel, isBoundaryLevel, freshProgress, applyResult,
  selectionWeight, pickRound, stillSettling, newWordAllowance, buildCard, introCard, normalise, fold, checkAnswer,
  levenshtein, damerau, nearMiss, diffAnswer,
};
