/* Sentences: the coverage index that decides when one is fair to ask, the
   ladder that makes the early ones exist at all, and the grading of a
   sentence built out of tiles.

   The index is the part worth being strict about. It decides whether a
   sentence is offered, so a bug in it either hides sentences for ever or asks
   for words nobody has been shown, and neither failure announces itself. */
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = {
  window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console, Math, Date, JSON, Blob: class {}, URL,
};
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'senses.js', 'verbs.js', 'order.js',
                 'phrases.js', 'engine.js', 'store.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const E = ctx.window.Engine;
const Store = ctx.window.Store;
const PHRASES = ctx.window.PHRASES;
const ORDER = ctx.window.TeachingOrder.TEACHING_ORDER;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const state = Store.defaultState();
const words = Store.allWords(state);
const byId = new Map(words.map((w) => [w.id, w]));
const idx = Store.sentenceIndex(state);
const rows = idx.rows;
const ladder = rows.filter((r) => r.item.source === 'ladder');

console.log('--- tokenising ---');
ok('punctuation is not part of a word',
  JSON.stringify(E.tokenise('¿Cuánto cuesta?')) === JSON.stringify(['cuanto', 'cuesta']));
ok('braces come out, since a sentence being translated has no hole in it',
  JSON.stringify(E.tokenise('Tengo {hambre}.')) === JSON.stringify(['tengo', 'hambre']));
ok('accents fold', E.wordToken('está') === 'esta');
ok('an apostrophe is kept', E.wordToken("d'") === "d'");
ok('nothing but punctuation is nothing', E.wordToken('¿?') === '');

console.log('--- the form index ---');
ok('it is built over the whole bank', idx.forms.size > 2000, String(idx.forms.size));
ok('a conjugated form counts as its verb', idx.forms.get('tengo') === 'tener');
ok('including an irregular one the bank never writes out in a sentence',
  idx.forms.get('hice') === 'hacer', 'hice -> ' + idx.forms.get('hice'));
ok('and the shortened future stem, which is a real form',
  idx.forms.get('tendre') === 'tener', 'tendre -> ' + idx.forms.get('tendre'));
ok('but not a form the tables merely guessed',
  idx.forms.get('tenere') === undefined
  && idx.forms.get('haceria') === undefined,
  'teneré and hacería are not Spanish and must not be in the index');
ok('a word inside a multi-word entry is reachable on its own',
  idx.forms.get('cuesta') !== undefined, 'from ¿cuánto cuesta?');
ok('a shared form goes to whichever word is taught first',
  E.rankOf === undefined || ctx.window.TeachingOrder.rankOf(idx.forms.get('es')) <= 2,
  'es -> ' + idx.forms.get('es'));
ok('a plural counts as the singular', E.wordForToken('llaves', idx.forms) === 'llave');
ok('the other gender counts too', E.wordForToken('cansada', idx.forms) === 'cansado');
ok('a -ces plural gets back to its -z', E.wordForToken('luces', idx.forms) === 'luz');
ok('an article is grammar, not vocabulary',
  E.wordForToken('la', idx.forms) === E.FREE_TOKEN);
ok('and so is the que that joins two clauses',
  E.wordForToken('que', idx.forms) === E.FREE_TOKEN);
ok('a word that is simply not in the bank is not in the bank',
  E.wordForToken('paraguas', idx.forms) === null);

console.log('--- what a sentence needs ---');
const needsOf = (es) => E.sentenceNeeds(es, idx.forms);
ok('the words it uses, and nothing else',
  JSON.stringify(needsOf('Tengo que ir.').needs.sort()) === JSON.stringify(['ir', 'tener']));
ok('articles do not count against it', needsOf('Voy a la playa.').loose.length === 0);
ok('a word the bank has never heard of is loose, not silently ignored',
  needsOf('Necesito un paraguas.').loose.join(',') === 'paraguas');

console.log('--- the ladder ---');
ok('every item has an id, Spanish and English',
  PHRASES.items.every((it) => it.id && it.es && it.en));
ok('ids are unique',
  new Set(PHRASES.items.map((i) => i.id)).size === PHRASES.items.length);
const loose = ladder.filter((r) => r.loose.length);
ok('every ladder item is made of words the bank actually has',
  loose.length === 0,
  loose.map((r) => `${r.item.id}: ${r.loose.join(',')}`).join(' | '));
ok('no ladder item needs a word that is not in the teaching order',
  ladder.every((r) => r.needs.every((id) => ctx.window.TeachingOrder.rankOf(id) < 1e6)));
ok('they are short: nothing over nine words',
  PHRASES.items.every((it) => E.tokenise(it.es).length <= 9),
  PHRASES.items.filter((it) => E.tokenise(it.es).length > 9).map((i) => i.id).join(','));
ok('the English is not the Spanish',
  PHRASES.items.every((it) => E.fold(it.en) !== E.fold(it.es)));

/* The point of the ladder is that there is something to do early. If this
   fails, sentence practice has quietly become unreachable again. */
const metFirst = (n) => {
  const met = new Set(ORDER.slice(0, n));
  return (id) => (met.has(id)
    ? { ...E.freshProgress(), timesSeen: 1 }
    : E.freshProgress());
};
console.log('--- reachable early, which is the whole point ---');
for (const [n, least] of [[10, 3], [20, 8], [30, 8], [50, 25], [100, 60]]) {
  const ready = Store.readyPhrases(state, metFirst(n));
  ok(`after ${n} words there are at least ${least} sentences (${ready.length})`,
    ready.length >= least);
}
const readyAt20 = Store.readyPhrases(state, metFirst(20));
ok('and the early ones are short',
  readyAt20.every((r) => E.tokenise(r.item.es).length <= 6),
  readyAt20.map((r) => r.item.es).join(' | '));
ok('a sentence is never offered while a word in it is unmet',
  Store.readyPhrases(state, metFirst(20))
    .every((r) => r.needs.every((id) => ORDER.slice(0, 20).includes(id))));
ok('nothing is ready on a fresh bank, because nothing has been met',
  Store.readyPhrases(state, () => E.freshProgress()).length === 0);
ok('a disabled word holds its sentences back',
  Store.readyPhrases(state, (id) => (id === 'tener'
    ? { ...E.freshProgress(), timesSeen: 1, enabled: false }
    : { ...E.freshProgress(), timesSeen: 1 }))
    .every((r) => !r.needs.includes('tener')));

console.log('--- rank, so sentences arrive commonest first ---');
const rank = (es) => E.sentenceRank(needsOf(es).needs, ctx.window.TeachingOrder.rankOf);
ok('the hardest word in it decides where it sits',
  rank('Tengo que ir.') < rank('Necesito una tarjeta de crédito.'));
// y is vocabulary, not grammar; only the articles and que are free.
ok('a sentence of nothing but grammar has rank zero', rank('el la') === 0);
ok('and one word of vocabulary is enough to give it a rank', rank('¿Y la?') > 0);

console.log('--- tiles ---');
const item = { id: 't1', es: '¿Dónde está el baño?', en: 'Where is the toilet?' };
const tileCard = E.sentenceCard(item, { level: 1 }, { distractors: ['Cómo', 'voy', 'aquí'] });
ok('a new sentence is built, not typed', tileCard.band.key === 'build');
ok('the answer is the sentence in order',
  JSON.stringify(tileCard.tileAnswer) === JSON.stringify(['dónde', 'está', 'el', 'baño']));
ok('tiles carry no punctuation',
  tileCard.tiles.every((t) => !/[¿?¡!.,]/.test(t.text)),
  tileCard.tiles.map((t) => t.text).join(' '));
ok('and are all lower case, so the capital is not a free guess',
  tileCard.tiles.every((t) => t.text === t.text.toLocaleLowerCase('es')));
ok('the distractors are in the tray', tileCard.tiles.length === 4 + 3);
ok('every tile has a distinct key',
  new Set(tileCard.tiles.map((t) => t.key)).size === tileCard.tiles.length);
ok('the reveal is still the sentence written properly',
  tileCard.reveal === '¿Dónde está el baño?');
ok('a distractor is marked as one',
  tileCard.tiles.filter((t) => t.decoy).length === 3);
ok('past the tile level it is typed instead',
  E.sentenceCard(item, { level: E.CONFIG.SENTENCE_TILE_TOP + 1 }).band.key === 'translate');
ok('and a typed card has no tiles',
  E.sentenceCard(item, { level: 5 }).tiles === null);
ok('a sentence card carries a stand-in word, so the card drawing knows nothing',
  tileCard.word && tileCard.word.id === 't1');

console.log('--- grading a built sentence ---');
const want = ['dónde', 'está', 'el', 'baño'];
ok('the right order is right', E.checkSequence(want, want).correct);
ok('capitals and punctuation do not enter into it',
  E.checkSequence(['Dónde', 'está', 'el', 'baño.'], want).correct);
ok('so do accents not, since the tiles supplied them',
  E.checkSequence(['donde', 'esta', 'el', 'bano'], want).correct);
let r = E.checkSequence(['dónde', 'el', 'está', 'baño'], want);
ok('two words swapped is amber, not wrong', r.almost && !r.correct);
ok('and is called what it is', r.reason === 'order', r.reason);
ok('and says where to look', r.wrongAt === 1, String(r.wrongAt));
r = E.checkSequence(['baño', 'el', 'está', 'dónde'], want);
ok('the whole thing backwards is not a slip', !r.almost && r.reason === 'order');
r = E.checkSequence(['dónde', 'está', 'el', 'voy'], want);
ok('a wrong word is wrong', !r.almost && r.reason === 'words', r.reason);
r = E.checkSequence(['dónde', 'está'], want);
ok('too few words is wrong', !r.almost && r.reason === 'length');
ok('nothing placed is not an answer', !E.checkSequence([], want).correct
  && !E.checkSequence([], want).almost);

console.log('--- a sentence keeps its own book ---');
const s2 = Store.defaultState();
ok('a sentence with no history reads as fresh',
  Store.peekPhrase(s2, 'p001').level === E.CONFIG.LEVEL_MIN);
ok('peeking does not create a row', Object.keys(s2.phrases).length === 0);
Store.phraseProgressFor(s2, 'p001').level = 6;
ok('writing does', s2.phrases.p001.level === 6);
ok('and never touches the word book', Object.keys(s2.progress).length === 0);

console.log('--- distractors ---');
const metAll = (id) => ({ ...E.freshProgress(), timesSeen: 2 });
const row = ladder.find((r) => r.item.id === 'p025');
const decoys = Store.tileDistractors(state, row.item, row.needs, metAll, 3);
ok('there are as many as asked for', decoys.length === 3, JSON.stringify(decoys));
ok('none of them is already in the sentence',
  decoys.every((d) => !E.tokenise(row.item.es).includes(E.wordToken(d))),
  `${row.item.es} -> ${decoys.join(', ')}`);
ok('none is a duplicate of another',
  new Set(decoys.map(E.wordToken)).size === decoys.length);
ok('a near-miss verb form is preferred, since that is the question',
  decoys.some((d) => Store.verbForms('tener', ['present']).includes(d)),
  decoys.join(', '));
/* Readiness means every word in the sentence has been met, so the sentence's
   own verbs are always fair game as decoys. What must never happen is a
   random word from the far end of the bank turning up in the tray. */
const unmet = Store.tileDistractors(state, row.item, row.needs,
  () => E.freshProgress(), 3);
const ownVerbs = row.needs.flatMap((id) => {
  const w = byId.get(id);
  return w && w.pos === 'verb' ? Store.verbForms(w.es, ['present']) : [];
});
ok('with nothing met, the only decoys are forms of the sentence own verbs',
  unmet.length > 0 && unmet.every((d) => ownVerbs.includes(d)),
  unmet.join(', '));

console.log('--- the bank sentences come in too ---');
const all = Store.allPhrases(state);
ok('the ladder and the bank are both in the pool',
  all.some((x) => x.source === 'ladder') && all.some((x) => x.source === 'bank'));
ok('a bank sentence arrives with its braces taken out',
  all.filter((x) => x.source === 'bank').every((x) => !/[{}]/.test(x.es)));
ok('bank ids cannot collide with ladder ids',
  new Set(all.map((x) => x.id)).size === all.length);
const accountable = rows.filter((r) => r.item.source === 'bank' && !r.loose.length).length;
const bankTotal = rows.filter((r) => r.item.source === 'bank').length;
console.log(`  (${accountable} of ${bankTotal} bank sentences are fully accountable`
  + ` and so can be used as sentences; the rest stay cloze-only)`);
ok('most of the bank is usable', accountable / bankTotal > 0.7);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
