/* Attach the best Tatoeba example to each of a curated list of words.

   Input is a pipe-separated line per word: id|es|en|pos|topic|note. The
   English, the topic and the note are a person's; the sentence is the
   corpus's. Output is a batch for tools/bank/build.mjs, printed for reading
   before it is copied anywhere.
*/
import { readFileSync, writeFileSync } from 'fs';
import vm from 'vm';
import { CACHE, loadPairs, judge, norm, surfaceForms } from './lib.mjs';

const REPO = new URL('../../', import.meta.url).pathname;
const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js']) vm.runInContext(readFileSync(REPO + f, 'utf8'), ctx);
const bankWords = vm.runInContext('SEED', ctx).vocabulary.concat(ctx.window.VOCAB.vocabulary);
const known = new Set(bankWords.map((w) => norm(w.es).split(' ')[0]));

const pairs = loadPairs().filter((p) => judge(p).ok);
const index = new Map();
for (const p of pairs) {
  for (const t of new Set(norm(p[0]).split(' '))) {
    if (!index.has(t)) index.set(t, []);
    index.get(t).push(p);
  }
}

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((line) => {
  const [id, es, en, pos, topic, note = ''] = line.split('|');
  return { id, es, en: en.split(',').map((x) => x.trim()), pos, topic, note };
});

const brace = (s, t) => s.replace(new RegExp(`(^|[\\s¿¡])(${t})([\\s.,!?]|$)`),
  (_, a, w, z) => `${a}{${w}}${z}`);

let withSentence = 0;
const out = [];
for (const r of rows) {
  const forms = surfaceForms(r.es, r.pos);
  const cands = [];
  for (const form of forms) {
    for (const [es, en] of index.get(norm(form)) || []) {
      const m = es.match(new RegExp(`(^|[\\s¿¡])(${form})([\\s.,!?]|$)`, 'i'));
      if (!m) continue;
      // Keep the noun/verb homograph guard: a reflexive pronoun in front
      // means the sentence is using a verb of the same spelling.
      if (new RegExp(`\\b(me|te|se|nos|le|les)\\s+${form}\\b`, 'i').test(es)) continue;
      const others = norm(es).split(' ').filter((t) => t && t !== norm(form));
      const score = others.filter((t) => known.has(t)).length / (others.length || 1);
      cands.push({ es, en, target: m[2], score, len: es.split(/\s+/).length });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.len - b.len);
  const best = cands[0];
  const row = { id: r.id, es: r.es, en: r.en, pos: r.pos, topic: r.topic };
  if (r.note) row.note = r.note;
  if (best) { row.sent = { es: brace(best.es, best.target), en: best.en }; withSentence++; }
  out.push(row);
}

const path = `${CACHE}/attached.jsonl`;
writeFileSync(path, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`${out.length} words, ${withSentence} with a corpus example, ${out.length - withSentence} without`);
console.log(`written to ${path}\n`);
for (const r of out) {
  const s = r.sent ? `${r.sent.es}  /  ${r.sent.en}` : '*** NO EXAMPLE ***';
  console.log(`${r.es.padEnd(14)} ${r.en.join(', ').padEnd(26)} ${s}`);
}
