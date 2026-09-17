/* Shared bits for the Tatoeba and Wiktionary importers.

   Nothing in here writes to the repo. The importers propose; a person reads
   what they propose and decides. That division is deliberate: a corpus can
   tell you a sentence is short and common, and cannot tell you it is a good
   thing to put in front of a learner.
*/
import { readFileSync, existsSync } from 'fs';

/* Where the downloads live. Outside the repo: they are hundreds of megabytes
   and they are not ours to redistribute. */
export const CACHE = process.env.IDIOMA_CACHE
  || '/tmp/claude-0/-home-user-idioma/b2862c23-4d6f-5f41-ba32-fcb467039677/scratchpad';

export const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[¿¡?!.,;:"'()«»—–]/g, '').replace(/\s+/g, ' ').trim();

/* --------------------------------------------------------------------
   What we will not put in front of a learner of Colombian Spanish
   -------------------------------------------------------------------- */

/* Vosotros is Spain's second person plural and is not used in Latin America.
   Listed as whole forms rather than guessed from endings, because -áis and
   -éis also end perfectly ordinary words. */
export const VOSOTROS = /\b(vosotros|vosotras|vuestro|vuestra|vuestros|vuestras|hab[eé]is|ten[eé]is|sois|est[aá]is|quer[eé]is|pod[eé]is|hac[eé]is|sab[eé]is|dec[ií]s|ven[ií]s|vais|id|idos|sed)\b/i;

/* Spain's word where Latin America has another. The bank teaches the Latin
   American one, so a sentence using the other would contradict the card it
   is supposed to be illustrating. */
export const PENINSULAR = [
  'coche', 'coches', 'ordenador', 'ordenadores', 'm[oó]vil', 'm[oó]viles',
  'zumo', 'zumos', 'patata', 'patatas', 'gafas', 'conducir', 'conduce',
  'conduzco', 'piso', 'pisos', 'gilipollas', 'vale', 'tío', 'tía', 'guay',
  'follar', 'coger el', 'cogerse', 'nevera', 'grifo', 'acera', 'billete',
  'cerilla', 'jersey', 'ascensor', 'aparcar', 'aparcamiento', 'melocot[oó]n',
  'fresa', 'alb[oó]ndiga', 'tortilla de patatas', 'bocadillo', 'cacahuete',
];
export const PENINSULAR_RE = new RegExp('\\b(' + PENINSULAR.join('|') + ')\\b', 'i');

/* --------------------------------------------------------------------
   Tatoeba
   -------------------------------------------------------------------- */

/* Spanish and English sentences joined on the links file. Returns pairs of
   the raw text, in the order Tatoeba lists them. */
export function loadPairs() {
  const dir = `${CACHE}/tat`;
  for (const f of ['spa.tsv', 'eng.tsv', 'spa-eng.tsv']) {
    if (!existsSync(`${dir}/${f}`)) {
      throw new Error(`${dir}/${f} is missing. See tools/tatoeba/README.md for the two curl commands that fetch it.`);
    }
  }
  const byId = (file) => {
    const m = new Map();
    for (const line of readFileSync(`${dir}/${file}`, 'utf8').split('\n')) {
      const a = line.indexOf('\t');
      if (a < 0) continue;
      const b = line.indexOf('\t', a + 1);
      m.set(line.slice(0, a), line.slice(b + 1));
    }
    return m;
  };
  const spa = byId('spa.tsv');
  const eng = byId('eng.tsv');
  const out = [];
  for (const line of readFileSync(`${dir}/spa-eng.tsv`, 'utf8').split('\n')) {
    const [a, b] = line.split('\t');
    const s = spa.get(a), e = eng.get(b);
    if (s && e) out.push([s, e]);
  }
  return out;
}

const wordCount = (s) => s.trim().split(/\s+/).length;

/* Is this pair fit to put on a card? Length, punctuation and dialect. The
   reasons are returned rather than a bare false, so a rejected sentence can
   be argued with. */
export function judge([es, en], opts = {}) {
  const minEs = opts.minEs ?? 3, maxEs = opts.maxEs ?? 9, maxEn = opts.maxEn ?? 12;
  const why = [];
  const n = wordCount(es);
  if (n < minEs) why.push('too short');
  if (n > maxEs) why.push('too long');
  if (wordCount(en) > maxEn) why.push('English too long');
  if (!/[.!?]$/.test(es.trim())) why.push('no end punctuation');
  // Quotes, brackets, digits and semicolons all make a worse cloze card:
  // more to read, and more ways to type it not-quite-right.
  if (/["“”'’‘()\[\];:0-9]/.test(es)) why.push('awkward punctuation or digits');
  if (/[0-9]/.test(en)) why.push('digits in the English');
  if (/\b[A-ZÁÉÍÓÚÑ][a-z]+\b/.test(es.replace(/^\s*\S+/, ''))) why.push('proper noun');
  if (VOSOTROS.test(es)) why.push('vosotros');
  if (PENINSULAR_RE.test(es)) why.push('peninsular word');
  return { ok: why.length === 0, why };
}

/* The surface forms a headword is likely to appear as. Deliberately shallow:
   it is a net for finding candidate sentences, not a morphological analyser,
   and every hit is checked against the sentence afterwards anyway. */
export function surfaceForms(es, pos) {
  const w = es.toLowerCase();
  if (w.includes(' ')) return [w];
  const out = new Set([w]);
  const add = (x) => out.add(x);
  if (pos === 'adjective' || pos === 'determiner') {
    const stem = w.replace(/[oa]$/, '');
    if (/[oa]$/.test(w)) { add(stem + 'o'); add(stem + 'a'); add(stem + 'os'); add(stem + 'as'); }
    else { add(w + 's'); add(w + 'es'); }
  } else if (pos === 'noun') {
    if (/[aeiouáéíóú]$/.test(w)) add(w + 's');
    else if (/z$/.test(w)) add(w.slice(0, -1) + 'ces');
    else add(w + 'es');
  } else if (pos === 'verb') {
    // Only the infinitive and the bare stem; a real conjugation belongs in
    // verbs.js, and a wrong guess here would go looking for nonsense.
    add(w);
  }
  return [...out];
}

/* --------------------------------------------------------------------
   Wiktionary, via kaikki.org
   -------------------------------------------------------------------- */

/* Glosses and gender for the words asked for, pulled out of the by-part-of-
   speech extracts. Streamed line by line because the noun file alone is
   177MB and holding it in memory is not worth it. */
export function lookupGlosses(wanted, files = ['noun.jsonl', 'adj.jsonl', 'adv.jsonl']) {
  const want = new Set(wanted.map((w) => w.toLowerCase()));
  const found = new Map();
  for (const file of files) {
    const path = `${CACHE}/kaikki/${file}`;
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line) continue;
      /* Cheap pre-filter, because parsing four hundred thousand JSON objects
         to throw nearly all of them away is slow. The headword is not the
         first key and is not at a fixed offset, but the top-level one is
         always the one followed by "lang", which nested words are not. An
         earlier version looked only at the first 120 characters and so found
         almost nothing. */
      const m = line.match(/"word": "([^"]+)", "lang":/);
      if (!m || !want.has(m[1].toLowerCase())) continue;
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      const w = String(d.word || '').toLowerCase();
      if (!want.has(w) || d.lang_code !== 'es') continue;
      /* Wiktionary covers the whole language, which includes senses nobody
         wants on a beginner's flashcard. perro's third sense is a slur. */
      const SKIP = ['obsolete', 'archaic', 'rare', 'dated', 'vulgar', 'offensive',
                    'derogatory', 'slang', 'ethnic-slur', 'historical'];
      const senses = (d.senses || [])
        .filter((s) => s.glosses && s.glosses.length
          && !(s.tags || []).some((t) => SKIP.includes(t)))
        .slice(0, 4);
      if (!senses.length) continue;
      const tags = new Set(senses.flatMap((s) => s.tags || []));
      const prev = found.get(w);
      const entry = {
        word: d.word,
        pos: d.pos,
        gender: tags.has('feminine') ? 'f.' : tags.has('masculine') ? 'm.' : '',
        glosses: senses.map((s) => s.glosses[0]),
      };
      // Prefer the entry with more senses when a word appears twice.
      if (!prev || entry.glosses.length > prev.glosses.length) found.set(w, entry);
    }
  }
  return found;
}

/* Wiktionary writes glosses for readers, not for flashcards: parentheses,
   "see also", a lead-off "to" on verbs. Trimmed to something typeable. */
/* Wiktionary writes glosses for readers: parentheticals, a definition
   trailing off after a comma, cross-references. A flashcard wants the short
   answer, so anything longer than a synonym is dropped rather than trimmed —
   "dog (Canis familiaris, domesticated for thousands of years...)" should
   come out as "dog" and not as "dog, domesticated for thousands of years". */
export function tidyGloss(g) {
  const bare = String(g)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(see|compare|synonym of|alternative form of|used in|especially)\b.*$/i, '')
    .replace(/[;:].*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
  // Keep the pieces that read as an answer; drop the ones that read as prose.
  const parts = bare.split(',')
    .map((x) => x.replace(/^[^a-z]+|[^a-z)]+$/g, '').trim())
    .filter((x) => x && x.split(' ').length <= 3);
  return [...new Set(parts)].join(', ');
}
