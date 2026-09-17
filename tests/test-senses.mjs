/* The sense tags, and the grading that goes with them.

   The bank has fifty-odd English prompts with more than one right Spanish
   answer. That is not a bug in the bank; "to be" really is both ser and
   estar. It is a bug in the card if the card shows "to be" and accepts only
   one of them without saying which. These tests hold the line: no word may
   share an English sense with another without a tag that tells them apart,
   and the tag may not give the answer away.
*/
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = {
  window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console, Math, Date, JSON, Blob: class {}, URL,
};
vm.createContext(ctx);
/* In a browser `window.VOCAB = ...` is also a global, and store.js reads it as
   one. A vm context is not so generous, so each file's exports are copied up
   to the top level as it loads. */
for (const f of ['seed.js', 'vocab.js', 'senses.js', 'engine.js', 'store.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const SEED = vm.runInContext('SEED', ctx);
const SENSES = ctx.window.SENSES;
const E = ctx.window.Engine;
const Store = ctx.window.Store;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const state = ctx.window.Store.defaultState();
const words = Store.allWords(state);
const byId = new Map(words.map((w) => [w.id, w]));

/* The groups, worked out here rather than read from store.js, so that a bug
   in the grouping shows up as a disagreement instead of being agreed with. */
const groups = new Map();
for (const w of words) {
  for (const en of w.en) {
    const k = E.fold(en);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(w);
  }
}
const collided = [...groups.entries()].filter(([, ws]) => ws.length > 1);
const needTag = new Set();
collided.forEach(([, ws]) => ws.forEach((w) => needTag.add(w.id)));

console.log('--- coverage ---');
console.log(`  ${collided.length} ambiguous prompts, ${needTag.size} words in them`);
ok('every word sharing an English sense carries a tag',
  [...needTag].every((id) => byId.get(id).sense),
  [...needTag].filter((id) => !byId.get(id).sense).join(', '));

ok('no tag is filed against a word that is not in the bank',
  Object.keys(SENSES).every((id) => byId.has(id)),
  Object.keys(SENSES).filter((id) => !byId.has(id)).join(', '));

ok('no tag is filed against a word that has no ambiguity to clear up',
  Object.keys(SENSES).every((id) => needTag.has(id)),
  Object.keys(SENSES).filter((id) => !needTag.has(id)).join(', '));

console.log('--- the tags tell the words apart ---');
for (const [en, ws] of collided) {
  const tags = ws.map((w) => (w.sense || '').toLowerCase());
  ok(`"${en}": ${ws.length} answers, ${new Set(tags).size} distinct tags`,
    new Set(tags).size === ws.length, tags.join(' / '));
}

console.log('--- a tag never gives the answer away ---');
const giveaways = words.filter((w) => w.sense
  && E.fold(w.sense).split(/\s+/).includes(E.fold(w.es)));
ok('no tag contains its own Spanish word', giveaways.length === 0,
  giveaways.map((w) => `${w.es}: ${w.sense}`).join(', '));

const echoes = words.filter((w) => w.sense
  && w.en.some((en) => E.fold(w.sense) === E.fold(en)));
ok('no tag is just the prompt again', echoes.length === 0,
  echoes.map((w) => `${w.es}: ${w.sense}`).join(', '));

const tooLong = words.filter((w) => w.sense && w.sense.length > 40);
ok('no tag is longer than the card can show', tooLong.length === 0,
  tooLong.map((w) => `${w.es}: ${w.sense}`).join(', '));

console.log('--- siblings ---');
const serSibs = Store.siblingsOf(words, 'ser');
ok('ser knows about estar', serSibs.some((s) => s.es === 'estar'), JSON.stringify(serSibs));
ok('a sibling carries its own tag', serSibs.every((s) => s.sense));
ok('a word with a unique meaning has no siblings',
  Store.siblingsOf(words, 'perro').length === 0);
ok('siblings are symmetric',
  Store.siblingsOf(words, 'estar').some((s) => s.es === 'ser'));
ok('a three-way group gives two siblings',
  Store.siblingsOf(words, 'camino').length === 2,
  JSON.stringify(Store.siblingsOf(words, 'camino')));
ok('the same word is never its own sibling',
  words.every((w) => Store.siblingsOf(words, w.id).every((s) => s.es !== w.es)
    || w.en.length === 0));

console.log('--- grading a sibling answer ---');
const sibs = (id) => Store.siblingsOf(words, id);
let r = E.checkAnswer('estar', ['ser'], { siblings: sibs('ser') });
ok('estar for ser is amber, not wrong', r.almost && !r.correct);
ok('and the reason is the sense, not the spelling', r.reason === 'sense', r.reason);
ok('and it names the word that was typed', r.sibling && r.sibling.es === 'estar');

r = E.checkAnswer('su', ['tu'], { siblings: sibs('tu') });
ok('su for tu is a sense miss, not a letter out', r.reason === 'sense', r.reason);

r = E.checkAnswer('ser', ['ser'], { siblings: sibs('ser') });
ok('the right answer is still simply right', r.correct && r.reason === null);

r = E.checkAnswer('serr', ['ser'], { siblings: sibs('ser') });
ok('a genuine typo is still a spelling miss', r.almost && r.reason === 'spelling', r.reason);

r = E.checkAnswer('comer', ['ser'], { siblings: sibs('ser') });
ok('an unrelated word is still wrong', !r.correct && !r.almost);

/* The point of checking siblings first: tu and su are one edit apart, so the
   spelling rule would happily claim them and say the wrong thing. */
const noSibs = E.checkAnswer('su', ['tu'], {});
ok('without the sibling list the same answer reads as a typo',
  noSibs.reason === 'spelling');

console.log('--- the sense reaches the card ---');
const card = E.buildCard(byId.get('ser'), { ...E.freshProgress(), level: 5, timesSeen: 3 }, () => []);
ok('a production card shows the tag in the hint',
  card.promptHint.includes('identity'), card.promptHint);
ok('and does not put it in the prompt', card.prompt === 'to be', card.prompt);
const plain = E.buildCard(byId.get('perro'), { ...E.freshProgress(), level: 5, timesSeen: 3 }, () => []);
ok('a word with no tag keeps the plain hint', plain.promptHint === 'noun', plain.promptHint);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
