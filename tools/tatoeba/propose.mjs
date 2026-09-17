/* Propose additions to the bank from Tatoeba and Wiktionary.

   Writes nothing into the repo. It prints, and it writes a batch file to the
   cache for a person to read, edit and only then copy into tools/bank. A
   corpus can say a word is common and a sentence is short; it cannot say
   either is a good thing to teach.

   Usage:
     node tools/tatoeba/propose.mjs sentences   extra examples for words we have
     node tools/tatoeba/propose.mjs words [n]   n new words, commonest first
*/
import { readFileSync, writeFileSync } from 'fs';
import vm from 'vm';
import { CACHE, loadPairs, judge, norm, surfaceForms, lookupGlosses, tidyGloss } from './lib.mjs';

const REPO = new URL('../../', import.meta.url).pathname;

/* The bank as the app sees it. */
function bank() {
  const ctx = { window: {}, console, Math, Date, JSON };
  vm.createContext(ctx);
  for (const f of ['seed.js', 'vocab.js', 'order.js', 'engine.js']) {
    vm.runInContext(readFileSync(REPO + f, 'utf8'), ctx);
  }
  const SEED = vm.runInContext('SEED', ctx);
  return {
    words: SEED.vocabulary.concat(ctx.window.VOCAB.vocabulary),
    sentences: SEED.sentences.concat(ctx.window.VOCAB.sentences),
    rankOf: ctx.window.TeachingOrder.rankOf,
  };
}

const pairs = loadPairs().filter((p) => judge(p).ok);
const { words, sentences } = bank();
const have = new Set(words.map((w) => norm(w.es)));
const haveFirstWord = new Set(words.map((w) => norm(w.es).split(' ')[0]));

/* Every sentence indexed by the words in it, so a lookup is a map hit rather
   than a scan of two hundred thousand strings per word. */
const index = new Map();
for (const p of pairs) {
  for (const t of new Set(norm(p[0]).split(' '))) {
    if (!index.has(t)) index.set(t, []);
    index.get(t).push(p);
  }
}

/* A sentence is worth more when the learner can already read the rest of it.
   Counting how many of its other words are in the bank is a rough stand-in
   for that, and it is the difference between an example that teaches and one
   that introduces four new problems at once. */
function readability(es, target) {
  const toks = norm(es).split(' ').filter((t) => t && t !== target);
  if (!toks.length) return 0;
  return toks.filter((t) => haveFirstWord.has(t)).length / toks.length;
}

function bestFor(es, pos, limit) {
  const forms = surfaceForms(es, pos);
  const seen = new Set();
  const out = [];
  for (const form of forms) {
    for (const [s, en] of index.get(norm(form)) || []) {
      if (seen.has(s)) continue;
      seen.add(s);
      // The braced form has to be the word as the sentence actually spells
      // it, so the answer the learner types is the answer on the card.
      const m = s.match(new RegExp(`(^|[\\s¿¡])(${form})([\\s.,!?]|$)`, 'i'));
      if (!m) continue;
      /* Spanish is full of words that are a noun and a verb form at once:
         baño is both a bathroom and I bathe. A reflexive pronoun in front of
         the target means the sentence is using the verb, and illustrating a
         noun with a sentence that does not contain it is worse than having no
         example at all. */
      if (pos !== 'verb' && new RegExp(`\\b(me|te|se|nos|le|les)\\s+${form}\\b`, 'i').test(s)) continue;
      out.push({ es: s, en, target: m[2], score: readability(s, norm(form)) });
    }
  }
  return out.sort((a, b) => b.score - a.score
    || a.es.split(/\s+/).length - b.es.split(/\s+/).length).slice(0, limit);
}

const brace = (s, target) =>
  s.replace(new RegExp(`(^|[\\s¿¡])(${target})([\\s.,!?]|$)`), (_, a, w, z) => `${a}{${w}}${z}`);

const mode = process.argv[2] || 'sentences';

/* ------------------------------------------------------------------ */
if (mode === 'sentences') {
  const already = new Set(sentences.map((s) => norm(s.es)));
  const rows = [];
  let covered = 0;
  for (const w of words) {
    const picks = bestFor(w.es, w.pos, 3).filter((p) => !already.has(norm(p.es)));
    if (picks.length) covered++;
    for (const p of picks.slice(0, 1)) {
      rows.push({ sentenceOnly: true, wordId: w.id,
        sent: { es: brace(p.es, p.target), en: p.en } });
    }
  }
  const out = `${CACHE}/proposed-sentences.jsonl`;
  writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${rows.length} extra sentences for ${covered} of ${words.length} words`);
  console.log(`written to ${out}`);
  console.log('\na few, to judge the quality:');
  for (const r of rows.slice(0, 8)) console.log(`  ${r.wordId.padEnd(14)} ${r.sent.es}\n  ${''.padEnd(14)} ${r.sent.en}`);
}

/* ------------------------------------------------------------------ */
if (mode === 'words') {
  const target = Number(process.argv[3] || 200);

  /* Frequency over Tatoeba's Spanish. Counted with the accents left on,
     because stripping them conflates real pairs: inglés with ingles, tenía
     with tenia, and a lookup on the stripped form then returns the wrong
     word's dictionary entry. */
  const freq = new Map();
  for (const [es] of pairs) {
    for (const raw of es.split(/\s+/)) {
      const t = raw.toLowerCase().replace(/[¿¡?!.,;:"'()«»—–]/g, '');
      if (t.length < 4) continue;                 // shorter than this is nearly all grammar
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }
  const candidates = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([t]) => !have.has(norm(t)) && !haveFirstWord.has(norm(t)))
    .slice(0, target * 25)
    .map(([t, n]) => ({ token: t, n }));

  console.log(`looking up ${candidates.length} candidates in Wiktionary...`);
  const glossed = lookupGlosses(candidates.map((c) => c.token));

  const POS = { noun: 'noun', adj: 'adjective', adv: 'adverb' };
  const rows = [];
  for (const c of candidates) {
    if (rows.length >= target) break;
    const g = glossed.get(c.token);
    if (!g || !POS[g.pos]) continue;                 // not a headword we want
    /* Wiktionary has an entry for every inflected form as well as every
       headword, glossed "plural of casa" or "feminine of uno". Those are not
       words to teach, they are the same word again, and they dominate a
       frequency list. */
    if (g.glosses.some((x) => /\b(plural|singular|feminine|masculine|form|forms|inflection|misspelling|alternative|past participle|gerund|first-person|second-person|third-person) of\b/i.test(x))) {
      continue;
    }
    const en = [...new Set(g.glosses.map(tidyGloss).filter((x) => x && x.length < 30))].slice(0, 3);
    if (!en.length) continue;
    const picks = bestFor(c.token, POS[g.pos], 1);
    if (!picks.length) continue;                     // no example, no card
    rows.push({
      id: c.token.replace(/[^a-z0-9]+/g, '_'),
      es: g.word, en, pos: POS[g.pos], topic: 'REVIEW',
      note: g.gender, freq: c.n,
      sent: { es: brace(picks[0].es, picks[0].target), en: picks[0].en },
    });
  }
  const out = `${CACHE}/proposed-words.jsonl`;
  writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${rows.length} candidate words written to ${out}`);
  console.log('every one needs a topic and a read before it goes near the bank.\n');
  for (const r of rows.slice(0, 25)) {
    console.log(`  ${String(r.freq).padStart(5)}  ${r.es.padEnd(14)} ${r.note.padEnd(3)} ${r.en.join(', ').padEnd(34)} ${r.sent.es}`);
  }
}
