/* The verb tables beyond the hand-listed irregulars.

   The tables used to treat every verb they had no entry for as regular, so
   they built "conoco", "dole" and "cerran". Nothing on screen drilled those,
   because the drills only use verbs listed by hand, but the form index
   behind tap-a-word and sentence unlocking did, and so would anything new.

   So: a table of forms checked by hand, one or more per pattern, then a
   sweep of every verb in the bank for the shapes a missed pattern leaves
   behind. No browser needed. */
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'verbs.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const V = ctx.window.Verbs;
const SEED = vm.runInContext('SEED', ctx);
const VOCAB = vm.runInContext('VOCAB', ctx);

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};
const P = ['yo', 'tu', 'el', 'nosotros', 'ellos'];
const row = (v, t) => P.map((p) => V.conjugate(v, t, p)).join(' ');

console.log('patterns, checked by hand');
const EXPECT = [
  ['pensar', 'present', 'pienso piensas piensa pensamos piensan', 'e to ie, not in nosotros'],
  ['cerrar', 'subjunctive', 'cierre cierres cierre cerremos cierren', 'and the same in the subjunctive'],
  ['doler', 'present', 'duelo dueles duele dolemos duelen', 'o to ue'],
  ['jugar', 'present', 'juego juegas juega jugamos juegan', 'u to ue, the only one'],
  ['jugar', 'subjunctive', 'juegue juegues juegue juguemos jueguen', 'stem change and g to gu together'],
  ['sentir', 'preterite', 'sentí sentiste sintió sentimos sintieron', 'an -ir stem changer in the preterite'],
  ['sentir', 'subjunctive', 'sienta sientas sienta sintamos sientan', 'and its nosotros subjunctive'],
  ['dormir', 'subjunctive', 'duerma duermas duerma durmamos duerman', 'o to u in the same place'],
  ['morir', 'preterite', 'morí moriste murió morimos murieron', 'murió'],
  ['servir', 'subjunctive', 'sirva sirvas sirva sirvamos sirvan', 'e to i throughout'],
  ['preferir', 'present', 'prefiero prefieres prefiere preferimos prefieren', 'the last e changes, not the first'],
  ['conocer', 'present', 'conozco conoces conoce conocemos conocen', 'zc in the yo form'],
  ['conocer', 'subjunctive', 'conozca conozcas conozca conozcamos conozcan', 'and the subjunctive built on it'],
  ['seguir', 'present', 'sigo sigues sigue seguimos siguen', 'sigo, with the u dropped'],
  ['seguir', 'subjunctive', 'siga sigas siga sigamos sigan', 'siga'],
  ['seguir', 'preterite', 'seguí seguiste siguió seguimos siguieron', 'siguió'],
  ['elegir', 'present', 'elijo eliges elige elegimos eligen', 'g to j before o, and e to i'],
  ['coger', 'subjunctive', 'coja cojas coja cojamos cojan', 'coja'],
  ['buscar', 'preterite', 'busqué buscaste buscó buscamos buscaron', 'c to qu before e'],
  ['llegar', 'subjunctive', 'llegue llegues llegue lleguemos lleguen', 'g to gu before e'],
  ['empezar', 'preterite', 'empecé empezaste empezó empezamos empezaron', 'z to c before e'],
  ['empezar', 'subjunctive', 'empiece empieces empiece empecemos empiecen', 'and with the stem change'],
  ['almorzar', 'subjunctive', 'almuerce almuerces almuerce almorcemos almuercen', 'almuerce'],
  ['leer', 'preterite', 'leí leíste leyó leímos leyeron', 'y between vowels'],
  ['creer', 'preterite', 'creí creíste creyó creímos creyeron', 'creyó'],
  ['caer', 'present', 'caigo caes cae caemos caen', 'caigo'],
  ['caer', 'preterite', 'caí caíste cayó caímos cayeron', 'cayó'],
  ['oír', 'present', 'oigo oyes oye oímos oyen', 'oír, listed'],
  ['oír', 'preterite', 'oí oíste oyó oímos oyeron', 'oyó'],
  ['oír', 'future', 'oiré oirás oirá oiremos oirán', 'the future drops the accent'],
  ['ver', 'present', 'veo ves ve vemos ven', 'veo'],
  ['ver', 'preterite', 'vi viste vio vimos vieron', 'vi and vio, no accents'],
  ['ver', 'imperfect', 'veía veías veía veíamos veían', 'veía'],
  ['reír', 'present', 'río ríes ríe reímos ríen', 'río'],
  ['confiar', 'present', 'confío confías confía confiamos confían', 'the stressed í'],
  ['suponer', 'preterite', 'supuse supusiste supuso supusimos supusieron', 'suponer follows poner'],
  ['suponer', 'future', 'supondré supondrás supondrá supondremos supondrán', 'including its future'],
  ['tener', 'subjunctive', 'tenga tengas tenga tengamos tengan', 'tenga, from tengo'],
  ['decir', 'subjunctive', 'diga digas diga digamos digan', 'diga'],
  ['levantarse', 'present', 'levanto levantas levanta levantamos levantan', 'a reflexive, without its se'],
  ['despertarse', 'present', 'despierto despiertas despierta despertamos despiertan', 'and a reflexive stem changer'],
  // Regular verbs are untouched.
  ['hablar', 'present', 'hablo hablas habla hablamos hablan', 'a regular -ar verb is unchanged'],
  ['comer', 'preterite', 'comí comiste comió comimos comieron', 'a regular -er verb is unchanged'],
  ['vivir', 'subjunctive', 'viva vivas viva vivamos vivan', 'a regular -ir verb is unchanged'],
  ['limpiar', 'present', 'limpio limpias limpia limpiamos limpian', 'and an unstressed i is left alone'],
];
for (const [v, t, want, why] of EXPECT) {
  const got = row(v, t);
  ok(`${why}: ${v}, ${t}`, got === want, `got ${got}`);
}

console.log('every verb in the bank');
const verbs = [...new Set(SEED.vocabulary.concat(VOCAB.vocabulary).filter((w) => w.pos === 'verb').map((w) => w.es))]
  .filter((v) => /(ar|er|ir|ír)(se)?$/.test(v));
const bad = [];
for (const v of verbs) {
  for (const t of V.VERBS.tenses) {
    if (!V.isVouchedFor(v, t.id)) continue;
    for (const p of P) {
      const f = V.conjugate(v, t.id, p);
      if (!f) { bad.push(`${v} ${t.id} ${p}: nothing`); continue; }
      // What a missed pattern leaves: z before e, a hard c or g gone soft,
      // three vowels where a y belongs, or an -ar stem changer left alone.
      if (/z[eé]/.test(f)) bad.push(`${v} ${t.id} ${p}: ${f}`);
      if (/[ao]i(ó|eron)$/.test(f) || /e(ió|ieron)$/.test(f)) bad.push(`${v} ${t.id} ${p}: ${f}`);
      if (/car$/.test(v.replace(/se$/, '')) && /c[eé]/.test(f)) bad.push(`${v} ${t.id} ${p}: ${f}`);
      if (/gar$/.test(v.replace(/se$/, '')) && /g[eé]/.test(f)) bad.push(`${v} ${t.id} ${p}: ${f}`);
    }
  }
}
ok(`${verbs.length} verbs, every vouched form built and none of the broken shapes`, bad.length === 0, bad.slice(0, 12).join(' | '));
const changers = Object.values(V.VERBS.stemChanges).flat();
const unchanged = changers.filter((v) => {
  const f = V.conjugate(v, 'present', 'el');
  const plain = v.slice(0, -2);
  return f && f.startsWith(plain) && !V.VERBS.irregulars.some((x) => x.infinitive === v);
});
ok('every stem changer actually changes', unchanged.length === 0, unchanged.join(', '));
ok('and every one is a verb the bank has, or a listed irregular', changers.every((v) => verbs.includes(v)
  || verbs.includes(v + 'se') || V.VERBS.irregulars.some((x) => x.infinitive === v)),
  changers.filter((v) => !verbs.includes(v) && !verbs.includes(v + 'se')).join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
