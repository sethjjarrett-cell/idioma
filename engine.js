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

  /* Sticking points. Some words simply will not go in, and the level on its
     own does not say which: a word at level 2 because it is new and a word at
     level 2 because it has been missed four times look identical, and only
     one of them needs the explanation again.

     So wrong answers are counted. Not for ever: the count is the current run
     of trouble, and three right answers in a row clears it, because a word
     you can now do is not a word you keep getting wrong. Past the threshold
     a word comes up about twice as often and is taught again rather than
     merely asked, which is the only sensible answer to not knowing it.

     Two numbers per word, one of them usually zero. There is no separate
     store and nothing to schedule. */
  STICKY_LAPSES: 3,
  STICKY_WEIGHT: 2,
  RELEARN_STREAK: 3,

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

  /* Sentence work. A sentence is offered once every bank word in it has been
     met at least once, which is a lower bar than knowing them: the point of
     the sentence is to put words you half-know into an order, and waiting for
     mastery would mean never getting there. TILE_TOP is where tapping words
     into place gives way to typing the thing out. */
  SENTENCE_TILE_TOP: 2,
  SENTENCE_ROUND_SIZE: 10,
  SENTENCE_MAX_NEW: 3,
  TILE_DISTRACTORS: 3,

  /* Grammar no sentence can do without, and that nobody needs tested as
     vocabulary: the articles, the two contractions, and the que that joins
     two clauses. The bank has ¿qué? the question word, which is a different
     word that happens to share its letters. Tokens in this list never make a
     sentence unready. */
  FREE_TOKENS: ["el", "la", "los", "las", "un", "una", "unos", "unas",
                "del", "al", "lo", "que"],

  /* Articles on the English side are a different matter: "a glass of
     water" and "glass of water" are not the same Spanish, so they are
     flagged amber rather than waved through. Same for the infinitive
     "to", which the bank writes but a learner often does not. */
  FLAGGED_ARTICLES: ["a", "an", "the"],
  FLAGGED_PREFIXES: ["to"],
};

const BANDS = {
  intro: { key: "intro", label: "New word", blurb: "Shown, not asked" },
  relearn: { key: "relearn", label: "Worth another look", blurb: "Missed too often, so shown again" },
  recognition: { key: "recognition", label: "Recognition", blurb: "Spanish shown, type the English" },
  production: { key: "production", label: "Production", blurb: "English shown, type the Spanish" },
  cloze: { key: "cloze", label: "Cloze", blurb: "Sentence shown, type the missing word" },
  build: { key: "build", label: "Build it", blurb: "English shown, tap the words into order" },
  translate: { key: "translate", label: "Translate", blurb: "English shown, type the Spanish" },
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
    lapses: 0,
    enabled: true,
  };
}

/* A word the learner keeps missing, as against one they simply have not met
   yet. The count is the current run of trouble, not a lifetime tally, so this
   goes false again as soon as the word comes good. */
function isSticking(progress) {
  return (progress.lapses || 0) >= CONFIG.STICKY_LAPSES;
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
    // Got right enough times running to call the trouble over. The count goes
    // back to zero rather than down by one: the run has ended, and a word
    // three-for-three is not still a sticking point.
    if (p.correctStreak >= CONFIG.RELEARN_STREAK) p.lapses = 0;
  } else if (result === "seen") {
    // An introduction is not an answer. It marks the word met, so it is not
    // introduced again, and clears the standing request to teach it, which
    // this was the answer to.
    p.needsTeaching = false;
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
    p.lapses = (p.lapses || 0) + 1;
    // Past the threshold, asking again is not the answer; the word gets
    // shown again first. Set on every miss while it is sticking, so a word
    // that keeps going wrong keeps being explained.
    if (isSticking(p)) p.needsTeaching = true;
  }

  return {
    progress: p,
    sticking: isSticking(p),
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
  // A word you keep missing is pulled forward on top of whatever its level
  // says, because the level alone cannot tell "new" from "not going in".
  const sticky = isSticking(progress) ? CONFIG.STICKY_WEIGHT : 1;
  return Math.max(CONFIG.WEIGHT_FLOOR, (levelPart + recencyPart) * sticky);
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
  // A word not yet met is shown rather than asked, whatever level it is at,
  // and so is one that has been missed often enough to have earned the
  // explanation a second time.
  const unmet = progress.timesSeen < CONFIG.INTRODUCE_UNTIL_SEEN;
  if (options.introduce !== false && (unmet || progress.needsTeaching)) {
    return introCard(word, sentencesForWord, { relearn: !unmet });
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
function introCard(word, sentencesForWord, options = {}) {
  const pool = sentencesForWord(word.id);
  const s = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  return {
    word, band: options.relearn ? BANDS.relearn : BANDS.intro,
    intro: true, relearn: !!options.relearn, fellBack: false, sentence: s,
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
    /* The hint slot earns its keep here. Several Spanish words can answer
       one English prompt, and "to be" with nothing else said is not a
       question anyone can answer; the sense tag says which of them is
       wanted without giving away a letter of it. */
    promptHint: word.sense ? `${word.pos} · ${word.sense}` : word.pos,
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
  const miss = { correct: false, almost: false, matched: null, near: false, reason: null, diff: null, sibling: null };
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

  /* Before spelling: another Spanish word that also means what the prompt
     said. ser and estar are both "to be", and typing the other one is not a
     typo and not ignorance of the word; it is the one thing about the pair
     nobody gets right first time. Amber, and named for what it is, so the
     card can say which sense this one wanted instead of "a letter out".

     Checked ahead of the spelling rules on purpose: tu and su are one edit
     apart, and calling that a misspelling is the wrong answer to it. */
  for (const sib of options.siblings || []) {
    const want = variants(normalise(sib.es));
    for (const g of given) {
      for (const w of want) {
        if (g === w) {
          return { ...miss, almost: true, reason: "sense", sibling: sib };
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

/* ---------------------------------------------------------------
   Sentences: what a sentence needs, and what to do with it
   --------------------------------------------------------------- */

/* Marks a token as grammar rather than vocabulary. Not a word id, and cannot
   collide with one, because no bank id has a space in it. */
const FREE_TOKEN = "free token";

/* One Spanish word, folded down to something comparable. Punctuation goes,
   which matters more than it sounds: without it "cuesta?" and "cuesta" are
   different tokens, and a sentence made entirely of words in the bank reads
   as one full of words that are not. */
function wordToken(text) {
  return fold(text).replace(/[^\p{L}\p{N}']/gu, "");
}

function tokenise(es) {
  return String(es == null ? "" : es).replace(/[{}]/g, "").split(/\s+/)
    .map(wordToken).filter(Boolean);
}

/* The surface forms of one word: everything a learner who knows the word
   could reasonably be expected to recognise in a sentence.

   The headword and its alternatives, each word of a multi-word entry on its
   own (the entry for how much does it cost teaches "cuesta"), every inflected
   form the bank itself puts in a sentence for it, and for a verb every form
   the tables can build. `conjugate` is handed in rather than reached for,
   because the engine is not allowed to know that Spanish has verbs. */
function formsOfWord(word, sentencesForWord, conjugate) {
  const out = new Set();
  const add = (v) => { const t = wordToken(v); if (t) out.add(t); };
  add(word.es);
  for (const alt of word.es_alt || []) add(alt);
  for (const part of String(word.es).split(/\s+/)) add(part);
  for (const s of sentencesForWord(word.id) || []) add(s.answer);
  if (conjugate && word.pos === "verb") for (const form of conjugate(word.es)) add(form);
  return [...out];
}

/* An index from surface form to word id, built once over the whole bank.
   A form two words share goes to whichever is taught first, so "es" counts as
   ser rather than as some later homograph. */
function buildFormIndex(words, sentencesForWord, options = {}) {
  const conjugate = options.conjugate || null;
  const rankOf = options.rankOf || (() => 0);
  const index = new Map();
  for (const w of words) {
    for (const form of formsOfWord(w, sentencesForWord, conjugate)) {
      const held = index.get(form);
      if (held === undefined || rankOf(w.id) < rankOf(held)) index.set(form, w.id);
    }
  }
  return index;
}

/* Which word a token belongs to, or null.

   Beyond a straight hit, a token counts as the word it is plainly a form of:
   a plural, or the other gender of an adjective. Deliberately no cleverer
   than that. Anything more starts claiming the learner knows forms nobody has
   put in front of them, and a sentence offered on that basis is a sentence
   they cannot do. */
function wordForToken(token, index) {
  if (!token) return null;
  if (CONFIG.FREE_TOKENS.includes(token)) return FREE_TOKEN;
  if (index.has(token)) return index.get(token);
  const tries = [];
  if (token.endsWith("es")) tries.push(token.slice(0, -2), token.slice(0, -2) + "z");
  if (token.endsWith("s")) tries.push(token.slice(0, -1));
  if (/[ao]$/.test(token)) tries.push(token.slice(0, -1) + (token.endsWith("a") ? "o" : "a"));
  if (/[ao]s$/.test(token)) tries.push(token.slice(0, -2) + "o", token.slice(0, -2) + "a");
  for (const t of tries) if (index.has(t)) return index.get(t);
  return null;
}

/* What a sentence asks of the learner: the bank words it uses, and the tokens
   the bank cannot account for at all. A sentence with loose tokens is never
   offered, because there is no honest moment at which it becomes fair. */
function sentenceNeeds(es, index) {
  const needs = new Set();
  const loose = [];
  for (const t of tokenise(es)) {
    const id = wordForToken(t, index);
    if (id === FREE_TOKEN) continue;
    if (id) needs.add(id);
    else loose.push(t);
  }
  return { needs: [...needs], loose };
}

/* Ready when every word in it has been met. Not mastered: met. The sentence
   is the exercise that turns half-known words into something you can say, so
   requiring mastery of each one first would put it permanently out of reach. */
function sentenceReady(needs, progressFor) {
  return needs.every((id) => {
    const p = progressFor(id);
    return p.enabled !== false && p.timesSeen > 0;
  });
}

/* The hardest word in a sentence decides where the sentence sits, so a round
   of sentences can be drawn commonest-first the way a round of words is. */
function sentenceRank(needs, rankOf) {
  return needs.reduce((worst, id) => Math.max(worst, rankOf(id)), 0);
}

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const held = out[i]; out[i] = out[j]; out[j] = held;
  }
  return out;
}

/* A sentence card. At or below TILE_TOP the words are given and the job is
   the order; above it, the whole thing is typed. A wrong answer drops the
   level like any other card, so failing a typed sentence hands the tiles back
   rather than leaving the learner at a wall.

   Distractor tiles come from `options.distractors`, filled by the caller,
   because a plausible wrong word is a fact about Spanish and the engine holds
   no Spanish. */
function sentenceCard(item, progress, options = {}) {
  const level = progress.level || CONFIG.LEVEL_MIN;
  const answer = String(item.es).replace(/[{}]/g, "");
  /* A stand-in word, the same trick the conjugation drill uses: the practice
     screen then draws a sentence card without knowing it is one, and only the
     places that must care (which progress book to write to) ask. */
  const base = {
    isSentence: true, item, sentence: null,
    word: { id: item.id, es: answer, note: item.note || "" },
    prompt: item.en,
    promptHint: "",
    accepted: [answer],
    reveal: answer,
    revealContext: "",
    note: item.note || "",
    fellBack: false,
  };
  if (level > CONFIG.SENTENCE_TILE_TOP) {
    return { ...base, band: BANDS.translate, tiles: null, tileAnswer: null };
  }
  /* Tiles carry bare words. The punctuation belongs to the sentence, not to
     any one word in it, and a tile reading "ir." or the opening upside-down
     question mark is a tile that looks like a mistake. The reveal still shows
     the sentence written properly. */
  const parts = answer.split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  const extra = (options.distractors || []).slice(0, CONFIG.TILE_DISTRACTORS);
  /* Tiles are lower case, all of them. Spanish capitalises almost nothing, so
     the one capital in the tray is the first word of the answer and a free
     guess; the reveal still shows the sentence written properly. */
  const lower = (t) => String(t).toLocaleLowerCase("es");
  const tiles = shuffle(parts.map((text, i) => ({ text: lower(text), key: "w" + i }))
    .concat(extra.map((text, i) => ({ text: lower(text), key: "x" + i, decoy: true }))));
  return { ...base, band: BANDS.build, tiles, tileAnswer: parts.map(lower) };
}

/* Grading a built sentence. The tiles carry the words, so spelling cannot be
   wrong and the only question is the order; comparing folded tokens keeps
   capitals and punctuation out of it.

   Two words swapped is amber rather than wrong, for the same reason one
   letter is: it is a slip in something otherwise right. Wrong words, or the
   wrong number of them, is not a slip. `wrongAt` is the first position that
   does not match, which is where the card draws the eye. */
function checkSequence(picked, want) {
  const got = picked.map(wordToken).filter(Boolean);
  const target = (want || []).map(wordToken).filter(Boolean);
  const miss = { correct: false, almost: false, matched: null, near: false,
                 reason: null, diff: null, sibling: null, wrongAt: -1 };
  if (!got.length) return miss;
  if (got.length === target.length && got.every((t, i) => t === target[i])) {
    return { ...miss, correct: true, matched: want.join(" ") };
  }
  const sameWords = got.length === target.length
    && got.slice().sort().join("|") === target.slice().sort().join("|");
  const outOfPlace = got.filter((t, i) => t !== target[i]).length;
  const swapped = sameWords && outOfPlace === 2;
  const wrongAt = got.findIndex((t, i) => t !== target[i]);
  return {
    ...miss,
    almost: swapped,
    matched: swapped ? want.join(" ") : null,
    reason: swapped ? "order" : sameWords ? "order" : got.length === target.length ? "words" : "length",
    wrongAt: wrongAt < 0 ? Math.min(got.length, target.length) : wrongAt,
  };
}

/* Exported for the browser through the global scope; there is no build
   step and no module loader, which is the point. */
window.Engine = {
  CONFIG, BANDS, bandForLevel, isBoundaryLevel, freshProgress, applyResult, isSticking,
  selectionWeight, pickRound, stillSettling, newWordAllowance, buildCard, introCard, normalise, fold, checkAnswer,
  levenshtein, damerau, nearMiss, diffAnswer,
  wordToken, tokenise, buildFormIndex, wordForToken, sentenceNeeds, sentenceReady,
  sentenceRank, sentenceCard, checkSequence, shuffle, FREE_TOKEN,
};
