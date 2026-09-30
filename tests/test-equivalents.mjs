/* The other ways of saying the same thing.

   The complaint this answers: typing "cómo estás" for a card whose answer is
   "¿qué tal?" and being told Not quite. The answer was right; the app only
   knew one string. Every entry here is a string a card will now accept
   without showing it, so the checks are about what it accepts and what it
   still refuses.

   The list will never be complete, which is why the override remembers. Both
   halves are tested: the curated list and the remembering.
*/
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = { window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console, Math, Date, JSON, Blob: class {}, URL };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'topics.js', 'senses.js', 'equivalents.js',
                 'verbs.js', 'order.js', 'phrases.js', 'engine.js', 'store.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const E = ctx.window.Engine;
const Store = ctx.window.Store;
const EQUIV = ctx.window.EQUIVALENTS;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const state = Store.defaultState();
const words = Store.allWords(state);
const byId = new Map(words.map((w) => [w.id, w]));
const met = { ...E.freshProgress(), timesSeen: 9 };
const production = (id) => E.buildCard(byId.get(id), { ...met, level: 6 }, () => []);
const recognition = (id) => E.buildCard(byId.get(id), { ...met, level: 2 }, () => []);
const accepts = (card, typed) => E.checkAnswer(typed, card.accepted).correct;

console.log('--- the list itself ---');
const unknown = Object.keys(EQUIV).filter((id) => !byId.has(id));
ok('every entry names a word that is in the bank', unknown.length === 0, unknown.join(', '));
const empty = Object.entries(EQUIV).filter(([, v]) =>
  !(v.es || []).length && !(v.en || []).length);
ok('no entry is empty', empty.length === 0, empty.map(([k]) => k).join(', '));
const badSide = Object.entries(EQUIV).filter(([, v]) =>
  Object.keys(v).some((k) => k !== 'es' && k !== 'en'));
ok('every entry uses only es and en', badSide.length === 0, badSide.map(([k]) => k).join(', '));

/* An alternative that is already the word itself, or already one of its
   glosses, is dead weight that makes the list look bigger than it is. */
const redundant = [];
for (const [id, v] of Object.entries(EQUIV)) {
  const w = byId.get(id);
  if (!w) continue;
  for (const alt of v.es || []) {
    if (E.normalise(alt) === E.normalise(w.es)) redundant.push(`${id}: es "${alt}" is the word`);
  }
  for (const alt of v.en || []) {
    if (w.en.some((g) => E.normalise(g) === E.normalise(alt))) redundant.push(`${id}: en "${alt}" is already a gloss`);
  }
}
ok('nothing in it is already accepted anyway', redundant.length === 0, redundant.join(' | '));

/* An alternative may be another word in the bank: mamá is its own entry and
   is still a right answer to "mother". What it may not be is a word that
   shares an English gloss with this one, because that is precisely the case
   the sense rule exists for. The card tells you which of the two senses it
   wants, so typing the other is answering a different question, and a plain
   Correct here would undo the distinction the tags are there to teach. */
const collides = [];
for (const [id, v] of Object.entries(EQUIV)) {
  const w = byId.get(id);
  if (!w) continue;
  for (const alt of v.es || []) {
    const other = words.find((x) => x.id !== id && E.normalise(x.es) === E.normalise(alt));
    if (!other) continue;
    const shared = w.en.filter((g) => other.en.some((h) => E.fold(g) === E.fold(h)));
    if (shared.length) {
      collides.push(`${id} lists "${alt}" (${other.id}), and they share the gloss "${shared[0]}"`);
    }
  }
}
ok('no alternative is a word the sense rule already tells apart',
  collides.length === 0, collides.join(' | '));

console.log('--- the complaint that started it ---');
const quetal = production('que-tal');
ok('the card still teaches ¿qué tal?', quetal.reveal === '¿qué tal?');
ok('and "cómo estás" is now right', accepts(quetal, 'como estas'));
ok('so is "qué más"', accepts(quetal, 'que mas'));
ok('so is "cómo está"', accepts(quetal, 'como esta'));
const r = E.checkAnswer('como estas', quetal.accepted);
ok('and it is marked as the other way of saying it', r.equivalent === true);
ok('while the word the card teaches is not', E.checkAnswer('que tal', quetal.accepted).equivalent === false);
ok('something that does not mean it is still wrong', !accepts(quetal, 'buenas noches'));

console.log('--- both directions ---');
ok('empezar takes comenzar', accepts(production('empezar'), 'comenzar'));
ok('madre takes mamá', accepts(production('madre'), 'mama'));
ok('carro takes coche, which is correct Spanish somewhere else',
  accepts(production('carro'), 'coche'));
ok('bonito takes beautiful on the English side', accepts(recognition('bonito'), 'beautiful'));
ok('nino takes kid', accepts(recognition('nino'), 'kid'));
ok('and the reveal still shows only the real glosses',
  recognition('bonito').reveal === byId.get('bonito').en.join(', '),
  recognition('bonito').reveal);
ok('the prompt is not given away by the alternatives either',
  production('bonito').prompt === byId.get('bonito').en.join(', '),
  production('bonito').prompt);

console.log('--- the override remembers ---');
const s2 = Store.defaultState();
ok('a new answer is remembered', Store.rememberAccepted(s2, 'que-tal', 'es', 'qué hubo'));
ok('the same one twice is not', !Store.rememberAccepted(s2, 'que-tal', 'es', 'qué hubo'));
ok('nor is one the card already accepted',
  !Store.rememberAccepted(s2, 'que-tal', 'es', 'cómo estás'),
  'punctuation and case are the grader\'s business, not a string compare');
ok('nor is the word itself', !Store.rememberAccepted(s2, 'que-tal', 'es', '¿qué tal?'));
ok('and the card takes it from then on',
  E.checkAnswer('qué hubo', E.buildCard(Store.allWords(s2).find((w) => w.id === 'que-tal'),
    { ...met, level: 6 }, () => []).accepted).correct);
ok('the two sides are kept apart',
  Store.rememberAccepted(s2, 'que-tal', 'en', 'how goes it')
  && s2.accepted['que-tal'].es.length === 1 && s2.accepted['que-tal'].en.length === 1);
ok('an empty answer is not remembered', !Store.rememberAccepted(s2, 'que-tal', 'es', '   '));
ok('nor is one for a word that is not there', !Store.rememberAccepted(s2, '', 'es', 'x'));
ok('nor one with no side to put it on', !Store.rememberAccepted(s2, 'que-tal', 'both', 'x'));

console.log('--- what it must not do ---');
/* Accepting a synonym is not the same as accepting a near miss. The amber
   band still has to catch a genuine misspelling rather than waving it
   through because the word now has alternatives. */
const empezar = production('empezar');
const slip = E.checkAnswer('comenzarr', empezar.accepted);
ok('a typo in an alternative is still not a clean pass', !slip.correct);
ok('and lands in the amber band', slip.almost === true);
ok('a word that means something else is still wrong',
  !accepts(production('madre'), 'hermana'));
ok('and the sense rule is untouched by any of it',
  E.checkAnswer('plata', production('dinero').accepted,
    { siblings: Store.siblingsOf(words, 'dinero') }).reason === 'sense');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
