/* The three data files, checked on their own: every word has a topic, every
   conjugation in the tables is the form a Spanish speaker would use, and the
   respeller says what a Colombian would say. No DOM, no browser. */
import { readFileSync } from 'fs';
import vm from 'vm';
const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'topics.js', 'verbs.js', 'pronounce.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
}
const SEED = vm.runInContext('SEED', ctx);
const TOPICS = ctx.window.TOPICS;
const { VERBS, conjugate } = ctx.window.Verbs;
const P = ctx.window.Pronounce;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

console.log('--- topics ---');
const seeded = SEED.vocabulary.map(w => w.id);
const filed = TOPICS.flatMap(t => t.words);
ok('every seed word has a topic',
  seeded.every(id => filed.includes(id)),
  seeded.filter(id => !filed.includes(id)).join(', '));
ok('no word is filed twice',
  new Set(filed).size === filed.length,
  filed.filter((id, i) => filed.indexOf(id) !== i).join(', '));
ok('no topic lists a word that is not in the bank',
  filed.every(id => seeded.includes(id)),
  filed.filter(id => !seeded.includes(id)).join(', '));
ok('topic ids are unique', new Set(TOPICS.map(t => t.id)).size === TOPICS.length);
ok('every topic has a name and a blurb', TOPICS.every(t => t.name && t.blurb));
ok('no topic is empty', TOPICS.every(t => t.words.length > 0));

console.log('--- regular verb endings ---');
const reg = [
  ['hablar', 'present', 'yo', 'hablo'], ['hablar', 'present', 'nosotros', 'hablamos'],
  ['comer', 'present', 'nosotros', 'comemos'], ['vivir', 'present', 'nosotros', 'vivimos'],
  ['hablar', 'preterite', 'el', 'habló'], ['comer', 'preterite', 'el', 'comió'],
  ['vivir', 'preterite', 'ellos', 'vivieron'],
  ['hablar', 'imperfect', 'nosotros', 'hablábamos'], ['comer', 'imperfect', 'yo', 'comía'],
  ['hablar', 'future', 'yo', 'hablaré'], ['vivir', 'future', 'ellos', 'vivirán'],
  ['comer', 'conditional', 'nosotros', 'comeríamos'],
  ['hablar', 'subjunctive', 'yo', 'hable'], ['comer', 'subjunctive', 'yo', 'coma'],
  ['vivir', 'subjunctive', 'ellos', 'vivan'],
];
for (const [v, t, p, want] of reg) {
  ok(`${v} ${t} ${p} = ${want}`, conjugate(v, t, p) === want, 'got ' + conjugate(v, t, p));
}
ok('future and conditional keep the whole infinitive',
  conjugate('vivir', 'future', 'yo') === 'viviré' && conjugate('vivir', 'conditional', 'yo') === 'viviría');

console.log('--- irregulars beat the rule ---');
const irr = [
  ['ser', 'present', 'yo', 'soy'], ['ser', 'imperfect', 'nosotros', 'éramos'],
  ['ir', 'preterite', 'el', 'fue'], ['ir', 'imperfect', 'yo', 'iba'],
  ['tener', 'present', 'yo', 'tengo'], ['tener', 'preterite', 'el', 'tuvo'],
  ['hacer', 'preterite', 'el', 'hizo'], ['decir', 'preterite', 'ellos', 'dijeron'],
  ['traer', 'preterite', 'ellos', 'trajeron'], ['saber', 'present', 'yo', 'sé'],
  ['dormir', 'preterite', 'el', 'durmió'], ['pedir', 'preterite', 'el', 'pidió'],
  ['conseguir', 'present', 'yo', 'consigo'], ['dar', 'preterite', 'el', 'dio'],
  ['poder', 'present', 'yo', 'puedo'], ['encontrar', 'present', 'tu', 'encuentras'],
];
for (const [v, t, p, want] of irr) {
  ok(`${v} ${t} ${p} = ${want}`, conjugate(v, t, p) === want, 'got ' + conjugate(v, t, p));
}
ok('an irregular falls back to the rule where it does not list a form',
  conjugate('salir', 'preterite', 'yo') === 'salí');
ok('every listed irregular form is a non-empty string',
  VERBS.irregulars.every(v => Object.values(v.forms).every(t => Object.values(t).every(f => typeof f === 'string' && f))));
ok('every irregular names a family the tables know',
  VERBS.irregulars.every(v => VERBS.tenses[0].endings[v.family]));
ok('every tense has endings for all three families and all five persons',
  VERBS.tenses.every(t => ['ar', 'er', 'ir'].every(f =>
    VERBS.persons.every(p => typeof t.endings[f][p.id] === 'string'))));
ok('an unknown tense or person conjugates to nothing rather than nonsense',
  conjugate('hablar', 'pluperfect', 'yo') === null && conjugate('hablar', 'present', 'vosotros') === null);

console.log('--- pronunciation ---');
const said = {
  'mesa': 'MEH-sah', 'baño': 'BAH-nyoh', 'jueves': 'HWEH-behs', 'llegar': 'yeh-GAHR',
  'habitación': 'ah-bee-tah-SYOHN', 'cerrado': 'seh-RRAH-doh', 'agua': 'AH-gwah',
  'izquierda': 'ees-KYEHR-dah', 'conseguir': 'kohn-seh-GEER', 'alguna': 'ahl-GOO-nah',
  'vivir': 'bee-BEER', 'hacer': 'ah-SEHR', 'vez': 'behs', 'día': 'DEE-ah',
  'efectivo': 'eh-fehk-TEE-boh', 'español': 'ehs-pah-NYOHL', 'hay': 'eye',
  'trabajar': 'trah-bah-HAHR', 'siguiente': 'see-GYEHN-teh', 'peor': 'peh-OHR',
};
for (const [w, want] of Object.entries(said)) {
  ok(`${w} is ${want}`, P.respell(w) === want, 'got ' + P.respell(w));
}
ok('h is silent', !P.respell('hambre').includes('h') || P.respell('hambre') === 'AHM-breh');
ok('stress falls on the second last syllable of a word ending in a vowel',
  P.stressedIndex(P.syllables('mesa')) === 0);
ok('and on the last of a word ending in a consonant',
  P.stressedIndex(P.syllables('hablar')) === 1);
ok('a written accent overrides both',
  P.stressedIndex(P.syllables('habitación')) === 3 && P.stressedIndex(P.syllables('sábado')) === 0);
ok('a one-syllable word is not shouted', P.respell('por') === 'pohr');
ok('a phrase keeps its spaces', P.respell('de nada') === 'deh NAH-dah');
ok('words that read as they look are not flagged',
  !P.isTricky('mesa') && !P.isTricky('tinto') && !P.isTricky('plato'));
ok('words that do not, are',
  P.isTricky('jueves') && P.isTricky('baño') && P.isTricky('llegar') && P.isTricky('vez'));
ok('every word in the bank respells to something',
  SEED.vocabulary.every(w => P.respell(w.es).length > 0));
ok('and none comes out with a capital inside a syllable',
  !SEED.vocabulary.some(w => /[a-z][A-Z]/.test(P.respell(w.es))),
  SEED.vocabulary.filter(w => /[a-z][A-Z]/.test(P.respell(w.es))).map(w => w.es).join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
