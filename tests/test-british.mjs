/* British English, everywhere the app speaks.

   Every word the learner reads and every word they have to type: the page, the
   messages app.js builds, the lesson notes, the sense tags, the ladder, and
   the generated bank. Spelling first, then the vocabulary, which matters more
   than it looks: an English gloss is not decoration, it is the answer the
   learner has to type, and being marked wrong for typing "shop" is worse than
   being taught the wrong word.

   seed.js is exempt and checked separately. It is the bank as it was supplied
   and it stays that way; if something in it needed British English it would
   need an overlay rather than an edit. As it happens nothing does, and the
   last section proves it rather than assuming it.

   The awkward one is practice. British English spells the noun practice and
   the verb practise, so neither spelling can simply be banned; what this
   checks is the forms that are unambiguous either way.
*/
import { readFileSync } from 'fs';
import vm from 'vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

/* ---------------------------------------------------------------
   What counts as American
   --------------------------------------------------------------- */

/* Spellings. No British word ends up here by accident, so any hit is a real
   one wherever it turns up. */
const SPELLINGS = {
  color: 'colour', colors: 'colours', colored: 'coloured', coloring: 'colouring',
  favorite: 'favourite', favorites: 'favourites',
  neighbor: 'neighbour', neighbors: 'neighbours',
  behavior: 'behaviour', honor: 'honour', flavor: 'flavour', labor: 'labour',
  center: 'centre', centers: 'centres', centered: 'centred',
  theater: 'theatre', meter: 'metre', meters: 'metres',
  liter: 'litre', liters: 'litres', fiber: 'fibre',
  traveled: 'travelled', traveling: 'travelling', traveler: 'traveller',
  canceled: 'cancelled', canceling: 'cancelling',
  labeled: 'labelled', modeling: 'modelling', marvelous: 'marvellous',
  practiced: 'practised', practicing: 'practising',
  organize: 'organise', organized: 'organised', organizing: 'organising',
  recognize: 'recognise', recognized: 'recognised',
  realize: 'realise', realized: 'realised', apologize: 'apologise',
  memorize: 'memorise', prioritize: 'prioritise', emphasize: 'emphasise',
  analyze: 'analyse', analyzed: 'analysed',
  defense: 'defence', offense: 'offence', pretense: 'pretence',
  gray: 'grey', catalog: 'catalogue', dialog: 'dialogue',
  maneuver: 'manoeuvre', skeptical: 'sceptical', aluminum: 'aluminium',
  gotten: 'got',
  /* "math" is deliberately absent: it cannot be told apart from Math.round
     without parsing the JavaScript, and nothing here is going to say it. */
};

/* Vocabulary. Every one of these is understood in Britain, so a hit is not a
   mistake exactly; it is the app speaking with somebody else's accent. */
const VOCABULARY = {
  apartment: 'flat', elevator: 'lift', sidewalk: 'pavement', truck: 'lorry',
  gasoline: 'petrol', 'cell phone': 'mobile', cellphone: 'mobile',
  soccer: 'football', cookie: 'biscuit', candy: 'sweets',
  vacation: 'holiday', movie: 'film', movies: 'films',
  pants: 'trousers', sweater: 'jumper', trash: 'rubbish', garbage: 'rubbish',
  faucet: 'tap', 'trash can': 'bin', 'garbage can': 'bin',
  eggplant: 'aubergine', zucchini: 'courgette',
  cilantro: 'coriander', 'french fries': 'chips', subway: 'underground',
  downtown: 'town centre', 'parking lot': 'car park', sneakers: 'trainers',
  airplane: 'plane', closet: 'wardrobe', flashlight: 'torch',
  freeway: 'motorway', mailbox: 'postbox', purse: 'handbag',
  railroad: 'railway', 'zip code': 'postcode', 'band-aid': 'plaster',
  drugstore: 'chemist', diaper: 'nappy', stroller: 'pushchair',
  popsicle: 'ice lolly', 'ground beef': 'mince', shrimp: 'prawn',
  mom: 'mum', moms: 'mums',
};

const ALL = { ...SPELLINGS, ...VOCABULARY };

/* Longest first, and a match is taken out of the text before the shorter keys
   see it: "trash can" is a bin, and reporting it as a rubbish as well would be
   two complaints about one phrase, only one of them right. */
const KEYS_BY_LENGTH = (dictionary) =>
  Object.keys(dictionary).sort((a, b) => b.length - a.length);

function americanismPairs(text, dictionary = ALL) {
  const found = [];
  let low = String(text || '').toLowerCase();
  for (const bad of KEYS_BY_LENGTH(dictionary)) {
    const re = new RegExp(`(^|[^a-z-])${bad}([^a-z-]|$)`);
    if (re.test(low)) {
      found.push({ bad, good: dictionary[bad] });
      low = low.replace(new RegExp(bad, 'g'), ' ');
    }
  }
  return found;
}

const americanisms = (text, dictionary = ALL) =>
  americanismPairs(text, dictionary).map((h) => `${h.bad} (want ${h.good})`);

/* ---------------------------------------------------------------
   The page and the messages
   --------------------------------------------------------------- */

/* Prose only. An attribute like autocapitalize is not English and a CSS
   property called color is not a spelling mistake. */
function proseOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // keep the attributes a person actually reads
    .replace(/<[^>]*?(placeholder|aria-label|title)="([^"]*)"[^>]*>/g, ' $2 ')
    .replace(/<[^>]+>/g, ' ');
}

/* The whole file, not its string literals.

   Pulling the strings out with a regex is the obvious thing and it does not
   work: an apostrophe in a comment, and this codebase is full of them, opens
   a string that runs to the next apostrophe hundreds of lines later and takes
   everything between with it. Anything skipped that way is skipped silently,
   which is the worst kind of missing check.

   So the raw text is scanned, comments and identifiers and all. That is
   stricter rather than looser: a variable named colorOfThing would be caught,
   and it should be. */
const wholeOf = (js) => js;

console.log('--- the page ---');
const html = read('index.html');
const htmlHits = americanisms(proseOf(html));
ok('index.html says it in British English', htmlHits.length === 0, htmlHits.join(', '));

console.log('--- the messages the app builds ---');
for (const f of ['app.js', 'engine.js', 'store.js', 'sync.js', 'pronounce.js']) {
  const hits = [];
  const text = wholeOf(read(f));
  for (const hit of americanisms(text)) {
    const where = new RegExp(`.{0,40}${hit.split(' ')[0]}.{0,25}`, 'i').exec(text);
    hits.push(`${hit} in ...${where ? where[0].replace(/\s+/g, ' ').trim() : ''}...`);
  }
  ok(`${f} does too`, hits.length === 0, hits.join(' | '));
}

console.log('--- practice the noun, practise the verb ---');
/* Both spellings are correct British English in their own place, so only the
   forms that can only be one thing are checked. */
const everything = [read('index.html'), read('app.js'), read('verbs.js'),
                    read('phrases.js'), read('topics.js'), read('senses.js')].join('\n');
const prose = proseOf(read('index.html')) + '\n' + read('app.js');
ok('no "practicing" or "practiced"',
  !/\bpractic(ing|ed)\b/i.test(everything),
  (everything.match(/\bpractic(ing|ed)\b/gi) || []).join(', '));
ok('no "to practice", which is the verb and takes an s',
  !/\bto practice\b/i.test(everything),
  (everything.match(/.{0,30}to practice.{0,20}/gi) || []).join(' | '));
ok('no "a practise" or "the practise", which is the noun and takes a c',
  !/\b(a|the|is) practise\b/i.test(everything));
/* And the other way round: the verb really is spelled with an s somewhere,
   so this is testing the spelling rather than the absence of the word. */
ok('the verb does appear, spelled practise', /\bpractise\b/.test(prose));
ok('and the noun appears, spelled practice', /\bpractice\b/.test(prose));

/* ---------------------------------------------------------------
   The data
   --------------------------------------------------------------- */

const ctx = { window: { localStorage: { getItem: () => null, setItem: () => {} } },
  console, Math, Date, JSON, Blob: class {}, URL };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'topics.js', 'senses.js', 'verbs.js',
                 'order.js', 'phrases.js', 'engine.js', 'store.js']) {
  vm.runInContext(read(f), ctx);
  for (const k of Object.keys(ctx.window)) ctx[k] = ctx.window[k];
}
const SEED = vm.runInContext('SEED', ctx);
const Store = ctx.window.Store;
const state = Store.defaultState();
const seedIds = new Set(SEED.vocabulary.map((w) => w.id));
const seedSentences = new Set(SEED.sentences.map((s) => s.id));

console.log('--- the generated bank ---');
const VOCAB = ctx.window.VOCAB;
/* Spelling only. Offering both "film" and "movie" is a feature: it accepts
   what the learner types either way. Offering only "movie" is the problem,
   and that is the "also accepts the British one" check further down. */
const wordHits = [];
for (const w of VOCAB.vocabulary) {
  for (const en of w.en) {
    for (const h of americanisms(en, SPELLINGS)) wordHits.push(`${w.id}: "${en}" -> ${h}`);
  }
  for (const h of americanisms(w.note)) wordHits.push(`${w.id} note -> ${h}`);
}
ok('no generated word is spelled the American way',
  wordHits.length === 0, wordHits.join(' | '));

const sentHits = [];
for (const s of VOCAB.sentences) {
  for (const h of americanisms(s.en)) sentHits.push(`${s.id}: "${s.en}" -> ${h}`);
}
ok('no generated sentence is translated into American English',
  sentHits.length === 0, sentHits.join(' | '));

console.log('--- the ladder, the notes and the tags ---');
const ladderHits = [];
for (const it of ctx.window.PHRASES.items) {
  for (const h of americanisms(it.en)) ladderHits.push(`${it.id}: "${it.en}" -> ${h}`);
  for (const h of americanisms(it.note)) ladderHits.push(`${it.id} note -> ${h}`);
}
ok('the sentence ladder is British', ladderHits.length === 0, ladderHits.join(' | '));

const noteHits = [];
for (const n of ctx.window.Verbs.VERBS.notes) {
  for (const h of americanisms(n.title + ' ' + n.body)) noteHits.push(`"${n.title}" -> ${h}`);
}
ok('the lesson notes are British', noteHits.length === 0, noteHits.join(' | '));

const tagHits = [];
for (const [id, tag] of Object.entries(ctx.window.SENSES)) {
  for (const h of americanisms(tag)) tagHits.push(`${id}: "${tag}" -> ${h}`);
}
ok('the sense tags are British', tagHits.length === 0, tagHits.join(' | '));

const topicHits = [];
for (const t of ctx.window.TOPICS) {
  for (const h of americanisms(t.name + ' ' + t.blurb)) topicHits.push(`${t.id} -> ${h}`);
}
ok('the topic names and blurbs are British', topicHits.length === 0, topicHits.join(' | '));

console.log('--- the supplied bank, which is not ours to edit ---');
/* seed.js stays as it was given. What matters is not that it never says an
   American word but that a British learner is never marked wrong for typing
   the British one, so this checks the glosses rather than the prose. */
const offersBritish = (word) => {
  const gaps = [];
  for (const en of word.en) {
    for (const { bad, good } of americanismPairs(en, VOCABULARY)) {
      if (!word.en.some((other) => other.toLowerCase().includes(good))) {
        gaps.push(`${word.id} accepts "${en}" but not "${good}"`);
      }
    }
  }
  return gaps;
};

const notAccepted = SEED.vocabulary.flatMap(offersBritish);
ok('every seed word that offers an American term also accepts the British one',
  notAccepted.length === 0,
  notAccepted.join(' | ') + ' (an overlay in store.js would be the fix, not an edit to seed.js)');

/* The same for what the app generates, where an edit is allowed. */
const words = Store.allWords(state);
const missing = words.filter((w) => !seedIds.has(w.id)).flatMap(offersBritish);
ok('and every generated one does as well', missing.length === 0, missing.join(' | '));

console.log('--- the checker itself ---');
ok('it catches a spelling', americanisms('the color of it').length === 1);
ok('it catches a word', americanisms('in my apartment').length === 1);
ok('a longer phrase wins over the word inside it',
  JSON.stringify(americanisms('the trash can')) === JSON.stringify(['trash can (want bin)']),
  JSON.stringify(americanisms('the trash can')));
ok('it is not fooled by a longer word around it',
  americanisms('a colorimeter, a momentum, a centerpiece').length === 0,
  americanisms('a colorimeter, a momentum, a centerpiece').join(', '));
ok('and it passes clean British English',
  americanisms('the colour of my neighbour and I travelled to the centre').length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
