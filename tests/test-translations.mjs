/* Sentences, checked for the faults a machine can actually see.

   All 1010 pairs have been read by hand once. This is what guards them
   afterwards, and it can only catch shapes, not meaning: no test can tell you
   that "vino rojo" is not what anybody calls red wine. What it can do is point
   at the sentences most likely to be wrong and refuse to let a new one appear
   without somebody looking at it.

   The fault worth catching is the wrong-sense homograph. Spanish is full of
   nouns that are also a verb form of something else, and an importer matching
   on spelling cannot tell them apart. "Sal ahora mismo" was filed under sal,
   the salt, and is the imperative of salir. "No entre usted" was filed under
   entre, between, and is the subjunctive of entrar. A learner meeting either
   one learns the wrong thing and has no way of knowing.

   Every flagged sentence has to be listed below as reviewed, with the sense it
   is actually using. A new one fails, which is the point: it cannot be waved
   through, only read and then listed.
*/
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = { window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console, Math, Date, JSON, Blob: class {}, URL };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'topics.js', 'senses.js', 'verbs.js',
                 'order.js', 'phrases.js', 'engine.js', 'store.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const E = ctx.window.Engine;
const Store = ctx.window.Store;
const state = Store.defaultState();
const words = Store.allWords(state);
const byId = new Map(words.map((w) => [w.id, w]));
const sentences = Store.allSentences(state);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

/* Reviewed and correct: the sentence uses the noun, and the fact that the
   same spelling is also a verb form is a coincidence of Spanish rather than a
   mistake in the bank. Keyed by word and answer, so changing the sentence
   under one of these still asks for a fresh look. */
const REVIEWED = new Set([
  'como:como',        // how, not "I eat"
  'cocina:cocina',    // the kitchen, not "she cooks"
  'jugo:jugo',        // juice, not "I play"
  'viaje:viaje',      // the trip, not the subjunctive of viajar
  'trabajo:trabajo',  // the work, not "I work"
  'pregunta:pregunta',// the question, not "he asks"
  'cambio:cambio',    // change, not "I change"
  'camino:camino',    // the road, not "I walk"
  'se:se',            // the reflexive pronoun, not "I know"
  'bebe:bebe',        // the baby, not the subjunctive of beber
]);

const verbForm = new Map();
for (const w of words) {
  if (w.pos !== 'verb') continue;
  for (const form of Store.verbForms(w.es)) {
    const t = E.wordToken(form);
    if (t && !verbForm.has(t)) verbForm.set(t, w.id);
  }
}

console.log('--- the answer is a form of a different word ---');
const flagged = [];
for (const s of sentences) {
  const token = E.wordToken(s.answer);
  const owner = verbForm.get(token);
  if (owner && owner !== s.wordId) {
    const key = `${s.wordId}:${token}`;
    if (!REVIEWED.has(key)) {
      flagged.push(`${key} ("${s.answer}" is also a form of ${owner}): ${s.es} | ${s.en}`);
    }
  }
}
ok(`every one is reviewed (${REVIEWED.size} known, ${flagged.length} new)`,
  flagged.length === 0,
  '\n    ' + flagged.join('\n    ')
  + '\n    Read the sentence. If it uses the sense it is filed under, add it to'
  + ' REVIEWED. If not, the sentence teaches the wrong word and has to go.');

console.log('--- the answer really is in the sentence ---');
const missing = sentences.filter((s) => {
  const inside = String(s.es).match(/\{([^}]*)\}/);
  return !inside || inside[1].trim() !== String(s.answer).trim();
});
ok('the braced form and the answer are the same string', missing.length === 0,
  missing.slice(0, 5).map((s) => s.id).join(', '));

console.log('--- both halves are actually there ---');
const empty = sentences.filter((s) => !String(s.es).trim() || !String(s.en).trim());
ok('no sentence is missing its Spanish or its English', empty.length === 0,
  empty.map((s) => s.id).join(', '));

const untranslated = sentences.filter((s) => E.fold(s.es.replace(/[{}]/g, '')) === E.fold(s.en));
ok('and the English is not just the Spanish again', untranslated.length === 0,
  untranslated.map((s) => s.id).join(', '));

console.log('--- the calques that keep creeping in ---');
/* English idioms translated word for word. Each of these was in the bank and
   is not something a Spanish speaker says. */
const CALQUES = [
  [/\bno hay punto en\b/i, 'no hay punto en X', 'no tiene sentido X'],
  [/\bqué hay de mal\s+(?!en\b)/i, 'qué hay de mal X', 'qué hay de malo en X'],
  [/\bvino rojo\b/i, 'vino rojo', 'vino tinto'],
  [/\bmuy\s+\w+\s+como para\b/i, 'muy X como para', 'demasiado X como para'],
  [/\bcambió de mano\b(?!s)/i, 'cambió de mano', 'cambió de manos'],
];
const calqued = [];
for (const s of sentences) {
  for (const [re, was, want] of CALQUES) {
    if (re.test(s.es)) calqued.push(`${s.id}: "${was}" should be "${want}" in ${s.es}`);
  }
}
ok('none of them is back', calqued.length === 0, calqued.join(' | '));

console.log('--- Spain and Mexico, in a Colombian bank ---');
const REGIONAL = [
  [/\bcómo de (grande|alto|lejos|grave)\b/i, 'cómo de X', 'qué tan X, in Latin America'],
  [/\b¿a poco\b/i, 'a poco', 'Mexican'],
  [/\bme pilló\b/i, 'pillar', 'peninsular; Colombia says coger'],
  [/\bno casa con\b/i, 'casar con', 'peninsular; combinar is what is said here'],
  [/\bvosotros\b|\b\w+áis\b|\b\w+éis\b/i, 'vosotros', 'Spain only; this bank uses ustedes'],
];
const regional = [];
for (const s of sentences) {
  for (const [re, was, why] of REGIONAL) {
    if (re.test(s.es)) regional.push(`${s.id}: ${was} (${why}): ${s.es}`);
  }
}
ok('none of those either', regional.length === 0, regional.join(' | '));

console.log('--- the English side ---');
/* Contractions are fine in speech and wrong here: the bank is written out in
   full everywhere else, and a learner typing "do not" for "don't" would be
   marked wrong on a translate card. */
const contractions = sentences.filter((s) => /\b(don't|doesn't|isn't|aren't|won't|can't|didn't|wasn't|weren't|there's|it's|I'm|you're|we're|they're|he's|she's|I've|there're)\b/i.test(s.en));
console.log(`  ${contractions.length} sentences use a contraction in the English`);
ok('the generated bank is written out in full',
  contractions.every((s) => !String(s.id).startsWith('g')),
  contractions.filter((s) => String(s.id).startsWith('g')).slice(0, 6).map((s) => `${s.id}: ${s.en}`).join(' | '));

/* There was a check here for two-word English sides, on the theory that they
   were fragments. They are not: "Turn left." and "He laughed." are complete
   sentences, and "No way." is the idiom. The real fault it was aimed at, an
   infinitive rendered as an imperative ("Llegar a casa" as "Arrive home"),
   needs a reader rather than a rule, and both cases are fixed. */

console.log('--- the ladder ---');
const PHRASES = ctx.window.PHRASES.items;
ok('every ladder item has both halves',
  PHRASES.every((it) => it.es.trim() && it.en.trim()));
ok('every question opens with an upside-down mark',
  PHRASES.filter((it) => it.es.trim().endsWith('?')).every((it) => it.es.includes('¿')),
  PHRASES.filter((it) => it.es.trim().endsWith('?') && !it.es.includes('¿')).map((i) => i.id).join(', '));
ok('and so does every exclamation',
  PHRASES.filter((it) => it.es.trim().endsWith('!')).every((it) => it.es.includes('¡')));

console.log('--- and the bank does too ---');
const noOpener = sentences.filter((s) => {
  const es = s.es.replace(/[{}]/g, '').trim();
  return (es.endsWith('?') && !es.includes('¿')) || (es.endsWith('!') && !es.includes('¡'));
});
ok('every question and exclamation is opened properly', noOpener.length === 0,
  noOpener.slice(0, 8).map((s) => `${s.id}: ${s.es}`).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
