/* Assemble the generated bank from the batch files, and refuse to build one
   that is structurally wrong. Checks here are the ones a machine can settle:
   duplicates, missing fields, a brace that does not match its sentence. What
   a word means is not one of them. */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import vm from 'vm';

const DIR = new URL('.', import.meta.url).pathname;
const REPO = new URL('../../', import.meta.url).pathname;

// what the seed already holds, so nothing is generated twice
const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'topics.js', 'pronounce.js']) {
  vm.runInContext(readFileSync(`${REPO}/${f}`, 'utf8'), ctx);
}
const SEED = vm.runInContext('SEED', ctx);
const TOPIC_IDS = new Set(ctx.window.TOPICS.map(t => t.id));
const seedIds = new Set(SEED.vocabulary.map(w => w.id));
const seedEs = new Map(SEED.vocabulary.map(w => [w.es, w.id]));

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const rows = [];
for (const f of readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort()) {
  const lines = readFileSync(`${DIR}/${f}`, 'utf8').split('\n').filter(l => l.trim());
  lines.forEach((l, i) => {
    try { rows.push({ ...JSON.parse(l), _src: `${f}:${i + 1}` }); }
    catch (e) { throw new Error(`${f} line ${i + 1} is not JSON: ${l.slice(0, 80)}`); }
  });
}

const problems = [];
const warnings = [];
const seenId = new Map(), seenEs = new Map();
const vocabulary = [], sentences = [];
let n = 0;

for (const r of rows) {
  const where = r._src;
  if (r.sentenceOnly) {
    if (!seedIds.has(r.wordId) && !seenId.has(r.wordId)) {
      problems.push(`${where}: sentence-only row points at unknown word "${r.wordId}"`);
      continue;
    }
    const braces = String(r.sent.es).match(/\{([^}]+)\}/g) || [];
    if (braces.length !== 1) { problems.push(`${where}: want exactly one braced form`); continue; }
    sentences.push({ id: `g${String(++n).padStart(4, '0')}`, wordId: r.wordId,
      es: r.sent.es, answer: braces[0].slice(1, -1).trim(), en: r.sent.en });
    continue;
  }
  if (!r.id || !r.es || !Array.isArray(r.en) || !r.en.length || !r.pos || !r.topic) {
    problems.push(`${where}: missing a required field (${r.es || r.id || '?'})`);
    continue;
  }
  if (!TOPIC_IDS.has(r.topic)) problems.push(`${where}: unknown topic "${r.topic}" on ${r.es}`);
  if (seedIds.has(r.id)) problems.push(`${where}: id "${r.id}" is already in seed.js`);
  // Compared folded, because that is how the engine compares an answer: with
  // accents and punctuation gone, "¿qué?" and "que" are the same card and one
  // of them cannot be answered reliably.
  for (const [es, id] of seedEs) {
    if (norm(es) === norm(r.es)) {
      problems.push(`${where}: "${r.es}" folds to the same as seed word "${es}" (${id})`);
    }
  }
  if (seenId.has(r.id)) problems.push(`${where}: id "${r.id}" repeats ${seenId.get(r.id)}`);
  if (seenEs.has(norm(r.es))) problems.push(`${where}: "${r.es}" repeats ${seenEs.get(norm(r.es))}`);
  seenId.set(r.id, where);
  seenEs.set(norm(r.es), where);

  const word = { id: r.id, es: r.es, en: r.en, pos: r.pos, topic: r.topic };
  if (r.es_alt && r.es_alt.length) word.es_alt = r.es_alt;
  if (r.note) word.note = r.note;
  vocabulary.push(word);

  if (r.sent) {
    const braces = String(r.sent.es).match(/\{([^}]+)\}/g) || [];
    if (braces.length !== 1) {
      problems.push(`${where}: sentence for ${r.es} has ${braces.length} braced forms, want exactly 1`);
    } else if (!r.sent.en || !r.sent.en.trim()) {
      problems.push(`${where}: sentence for ${r.es} has no English`);
    } else {
      const answer = braces[0].slice(1, -1).trim();
      // The braced form has to be a form of the word, not a different word.
      // Loose on purpose: Spanish inflects, so only the opening must match.
      const stem = norm(r.es).split(' ')[0].slice(0, 4);
      if (stem.length >= 3 && !norm(answer).includes(stem) && !norm(r.es).includes(norm(answer).slice(0, 4))) {
        // Irregular verbs legitimately look nothing like their infinitive
        // (hacer, hago), so this is a look-at-me, not a refusal.
        warnings.push(`${where}: "${answer}" shares no stem with "${r.es}"`);
      }
      sentences.push({ id: `g${String(++n).padStart(4, '0')}`, wordId: r.id,
        es: r.sent.es, answer, en: r.sent.en });
    }
  }
}

if (warnings.length) {
  console.log(`${warnings.length} to eyeball (irregular forms are expected here):`);
  warnings.forEach(w => console.log('  ? ' + w));
}
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  problems.slice(0, 40).forEach(p => console.log('  ' + p));
  if (problems.length > 40) console.log(`  ...and ${problems.length - 40} more`);
  process.exit(1);
}

const byTopic = {};
for (const w of vocabulary) byTopic[w.topic] = (byTopic[w.topic] || 0) + 1;

const out = `/* The generated bank: vocabulary and example sentences.

   Written for this app rather than supplied with it, which is why it is not
   in seed.js; that file is the original bank and stays as it was given. Both
   are loaded and merged, and a word added through the Manage screen sits on
   top of them both.

   Every word carries its own topic, so nothing here needs a second entry in
   topics.js. Every sentence wraps the target form in {braces}; the cloze card
   blanks it out and the answer is the form as written, inflected, because the
   learner types what the sentence needs rather than the dictionary form.

   ${vocabulary.length} words, ${sentences.length} sentences. Generated in batches and
   checked by tests/test-bank.mjs, which fails on a duplicate, a missing
   field, an unknown topic, or a braced form that is not a form of its word.
   Those checks settle structure, not meaning: the Spanish has been written
   with care but has not been read by a native speaker, so treat a surprising
   translation as a bug worth reporting rather than as gospel.

   vocabulary: { id, es, es_alt[], en[], pos, topic, note }
   sentences:  { id, wordId, es, answer, en }
*/
const VOCAB = {
  vocabulary: [
${vocabulary.map(w => '    ' + JSON.stringify(w)).join(',\n')}
  ],
  sentences: [
${sentences.map(s => '    ' + JSON.stringify(s)).join(',\n')}
  ],
};

window.VOCAB = VOCAB;
`;

writeFileSync(`${REPO}/vocab.js`, out);
console.log(`built vocab.js: ${vocabulary.length} words, ${sentences.length} sentences`);
const withSentence = new Set(sentences.map(s => s.wordId));
console.log('generated words with no sentence:', vocabulary.filter(w => !withSentence.has(w.id)).length);
console.log('by topic:', Object.entries(byTopic).sort((a, b) => b[1] - a[1])
  .map(([t, c]) => `${t} ${c}`).join(', '));
