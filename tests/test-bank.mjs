/* The generated bank, checked against the seed it sits beside and the rest
   of the app that has to read it. Structure only: these assertions cannot
   tell you whether a translation is right, and say so in the README. */
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'topics.js', 'pronounce.js', 'engine.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
}
// store.js reads these as browser globals; in here they have to be handed over.
ctx.SEED = vm.runInContext('SEED', ctx);
ctx.VOCAB = ctx.window.VOCAB;
ctx.Engine = ctx.window.Engine;
vm.runInContext(readFileSync(new URL('../store.js', import.meta.url), 'utf8'), ctx);

const { SEED, VOCAB } = ctx;
const TOPICS = ctx.window.TOPICS;
const Store = ctx.window.Store;
const P = ctx.window.Pronounce;
const E = ctx.window.Engine;
const state = Store.defaultState();
const words = Store.allWords(state);
const sentences = Store.allSentences(state);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };
const norm = (s) => E.normalise(s);

console.log('--- the bank as a whole ---');
console.log(`  ${SEED.vocabulary.length} seeded + ${VOCAB.vocabulary.length} generated = ${words.length} words`);
console.log(`  ${SEED.sentences.length} seeded + ${VOCAB.sentences.length} generated = ${sentences.length} sentences`);
ok('the generated bank is loaded alongside the seed',
  words.length === SEED.vocabulary.length + VOCAB.vocabulary.length);
const ids = words.map(w => w.id);
ok('no id is used twice across both banks',
  new Set(ids).size === ids.length,
  ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
const surface = words.map(w => norm(w.es));
ok('no Spanish word appears in both banks',
  new Set(surface).size === surface.length,
  surface.filter((x, i) => surface.indexOf(x) !== i).join(', '));

console.log('--- every generated word is complete ---');
ok('all have Spanish, at least one English, a part of speech and a topic',
  VOCAB.vocabulary.every(w => w.es && w.en.length && w.pos && w.topic),
  VOCAB.vocabulary.filter(w => !(w.es && w.en.length && w.pos && w.topic)).map(w => w.id).join(', '));
ok('no English answer is blank',
  VOCAB.vocabulary.every(w => w.en.every(e => e && e.trim())));
ok('every topic named exists in topics.js',
  VOCAB.vocabulary.every(w => TOPICS.some(t => t.id === w.topic)),
  [...new Set(VOCAB.vocabulary.map(w => w.topic).filter(t => !TOPICS.some(x => x.id === t)))].join(', '));
ok('ids are slugs: lower case, no accents, no spaces',
  VOCAB.vocabulary.every(w => /^[a-z0-9_-]+$/.test(w.id)),
  VOCAB.vocabulary.filter(w => !/^[a-z0-9_-]+$/.test(w.id)).map(w => w.id).join(', '));

console.log('--- every generated word has a usable sentence ---');
const byWord = new Map();
for (const s of VOCAB.sentences) byWord.set(s.wordId, s);
ok('one sentence per word', VOCAB.vocabulary.every(w => byWord.has(w.id)),
  VOCAB.vocabulary.filter(w => !byWord.has(w.id)).map(w => w.id).join(', '));
ok('every sentence points at a word that exists',
  VOCAB.sentences.every(s => words.some(w => w.id === s.wordId)));
ok('every sentence wraps exactly one form in braces',
  VOCAB.sentences.every(s => (s.es.match(/\{[^}]+\}/g) || []).length === 1),
  VOCAB.sentences.filter(s => (s.es.match(/\{[^}]+\}/g) || []).length !== 1).map(s => s.id).join(', '));
ok('the stored answer is the form inside the braces',
  VOCAB.sentences.every(s => s.es.includes('{' + s.answer + '}')),
  VOCAB.sentences.filter(s => !s.es.includes('{' + s.answer + '}')).map(s => s.id).join(', '));
ok('every sentence has an English translation', VOCAB.sentences.every(s => s.en && s.en.trim()));
ok('no sentence id collides with a seeded one',
  !VOCAB.sentences.some(s => SEED.sentences.some(x => x.id === s.id)));

console.log('--- the app can build a card from any of it ---');
const sentencesFor = (id) => sentences.filter(s => s.wordId === id);
let built = 0;
for (const w of words) {
  for (const level of [1, 5, 9]) {
    const card = E.buildCard(w, { ...E.freshProgress(), level }, sentencesFor);
    if (!card.prompt || !card.accepted.length || !card.accepted[0]) {
      ok(`card for ${w.es} at L${level}`, false, JSON.stringify(card).slice(0, 120));
      built = -1e9;
    }
    built++;
  }
}
ok(`every word builds a card in all three bands (${built} cards)`, built === words.length * 3);
ok('a cloze card blanks the target out',
  E.buildCard(words.find(w => sentencesFor(w.id).length), { ...E.freshProgress(), level: 9 }, sentencesFor)
    .prompt.includes('_____'));
ok('typing the sentence form back answers the cloze card',
  VOCAB.sentences.every(s => E.checkAnswer(s.answer, [s.answer]).correct));

console.log('--- and can say all of it ---');
ok('every word respells to something', words.every(w => P.respell(w.es).length > 0),
  words.filter(w => !P.respell(w.es).length).map(w => w.es).join(', '));
ok('no respelling has a capital inside a syllable',
  !words.some(w => /[a-z][A-Z]/.test(P.respell(w.es))),
  words.filter(w => /[a-z][A-Z]/.test(P.respell(w.es))).map(w => w.es).join(', '));

console.log('--- topics cover it ---');
const topicOf = (w) => w.topic || (TOPICS.find(t => t.words.includes(w.id)) || {}).id || null;
ok('every word in the bank has a topic', words.every(topicOf),
  words.filter(w => !topicOf(w)).map(w => w.es).join(', '));
const counts = {};
for (const w of words) counts[topicOf(w)] = (counts[topicOf(w)] || 0) + 1;
ok('no topic is left empty', TOPICS.every(t => counts[t.id] > 0),
  TOPICS.filter(t => !counts[t.id]).map(t => t.id).join(', '));
console.log('  ' + Object.entries(counts).sort((a, b) => b[1] - a[1])
  .map(([t, c]) => `${t} ${c}`).join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
