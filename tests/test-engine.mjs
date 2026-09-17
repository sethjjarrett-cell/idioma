import { readFileSync } from 'fs';
import vm from 'vm';
const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'engine.js']) vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
const E = ctx.window.Engine;
const SEED = vm.runInContext('SEED', ctx);   // const does not land on the context object

let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };
const NOW = '2026-09-16T12:00:00Z';

console.log('--- bands ---');
ok('L1-L3 recognition', [1,2,3].every(l => E.bandForLevel(l).key === 'recognition'));
ok('L4-L7 production', [4,5,6,7].every(l => E.bandForLevel(l).key === 'production'));
ok('L8+ cloze', [8,10,14].every(l => E.bandForLevel(l).key === 'cloze'));

console.log('--- level movement ---');
let p = E.freshProgress();
ok('starts at L1', p.level === 1);
p = E.applyResult(p, true, NOW).progress;  ok('correct 1 -> 2', p.level === 2);
p = E.applyResult(p, true, NOW).progress;  ok('correct 2 -> 3', p.level === 3);
// at the L3 boundary the streak already stands at 2, so it should cross
ok('streak is 2 at L3', p.correctStreak === 2);
p = E.applyResult(p, true, NOW).progress;  ok('crosses L3 -> L4 on a standing streak', p.level === 4);

console.log('--- boundary needs two in a row ---');
let q = E.freshProgress(); q.level = 3; q.correctStreak = 0;
let r = E.applyResult(q, true, NOW); q = r.progress;
ok('L3 + 1 correct from cold holds at L3', q.level === 3, 'got L' + q.level);
r = E.applyResult(q, true, NOW); q = r.progress;
ok('L3 + 2nd correct promotes to L4', q.level === 4, 'got L' + q.level);
let s = E.freshProgress(); s.level = 7; s.correctStreak = 0;
s = E.applyResult(s, true, NOW).progress; ok('L7 + 1 correct holds', s.level === 7);
s = E.applyResult(s, true, NOW).progress; ok('L7 + 2nd correct -> L8', s.level === 8);
// a wrong answer in between must reset the streak
let t = E.freshProgress(); t.level = 3;
t = E.applyResult(t, true, NOW).progress;
t = E.applyResult(t, false, NOW).progress; ok('wrong at L3 drops to L2 and clears streak', t.level === 2 && t.correctStreak === 0);

console.log('--- floor and ceiling ---');
let u = E.freshProgress();
u = E.applyResult(u, false, NOW).progress; ok('never drops below L1', u.level === 1);
let v = E.freshProgress(); v.level = E.CONFIG.LEVEL_CEILING; v.correctStreak = 5;
v = E.applyResult(v, true, NOW).progress; ok('caps at ceiling', v.level === E.CONFIG.LEVEL_CEILING);

console.log('--- selection weight ---');
const w = (lvl, hoursAgo) => E.selectionWeight(
  { ...E.freshProgress(), level: lvl,
    lastSeen: hoursAgo === null ? null : new Date(Date.parse(NOW) - hoursAgo*3600e3).toISOString() }, NOW);
ok('lower level outweighs higher, same recency', w(1, 1) > w(10, 1), `${w(1,1)} vs ${w(10,1)}`);
ok('older outweighs recent, same level', w(5, 200) > w(5, 1), `${w(5,200)} vs ${w(5,1)}`);
ok('L10 seen recently still non-zero', w(10, 0) >= E.CONFIG.WEIGHT_FLOOR && w(10,0) > 0, String(w(10,0)));
ok('a struggling word outranks a mastered one however stale', w(1, 0) > w(10, 5000), `${w(1,0)} vs ${w(10,5000)}`);
ok('stale mastered beats fresh mastered by a lot', w(10, 400) > w(10, 0) * 3, `${w(10,400)} vs ${w(10,0)}`);
// A fully stale mastered word draws level with a just-practised mid-level
// word. That is the intended balance, so the assertion allows the tie.
ok('stale mastered is competitive with recent mid-level', w(10, 400) >= w(5, 0), `${w(10,400)} vs ${w(5,0)}`);
ok('recency orders within a level', w(4, 300) > w(4, 30) && w(4, 30) > w(4, 1));
ok('never seen gets full recency', w(5, null) === w(5, 10000));

console.log('--- answer checking ---');
const chk = (typed, acc, opt) => E.checkAnswer(typed, acc, opt).correct;
ok('exact', chk('room', ['room']));
ok('case insensitive', chk('ROOM', ['room']));
ok('accent insensitive (habitacion)', chk('habitacion', ['habitación']));
ok('accent insensitive reverse', chk('habitación', ['habitacion']));
ok('n for enye', chk('bano', ['baño']));
ok('inverted punctuation ignored', chk('¿como estas?', ['cómo estás']));
ok('whitespace trimmed', chk('  room  ', ['room']));
ok('article optional (typed without)', chk('mesa', ['la mesa']));
ok('article optional (typed with)', chk('la mesa', ['mesa']));
ok('any listed answer accepted', chk('toilet', ['bathroom','toilet']));
ok('wrong answer rejected', !chk('kitchen', ['bathroom']));
ok('typo rejected by default', !chk('habitacon', ['habitación']));
ok('typo accepted when on', chk('habitacon', ['habitación'], { typoTolerance: true }));
ok('typo flagged as near', E.checkAnswer('habitacon', ['habitación'], { typoTolerance: true }).near === true);
ok('two-letter slip still rejected with tolerance', !chk('habitcon', ['habitación'], { typoTolerance: true }));
ok('empty answer is wrong', !chk('   ', ['room']));

console.log('--- card building ---');
const byId = Object.fromEntries(SEED.vocabulary.map(w => [w.id, w]));
const sFor = (id) => SEED.sentences.filter(s => s.wordId === id);
const comer = byId['comer'];
// A word that has been met at least once, which is what the band rules are
// about; a word that has not is introduced instead, and is tested below.
const met = (level) => ({ ...E.freshProgress(), level, timesSeen: 1 });
let c = E.buildCard(comer, met(2), sFor);
ok('L2 shows Spanish, accepts English', c.band.key === 'recognition' && c.prompt === comer.es && c.accepted.join() === comer.en.join());
c = E.buildCard(comer, met(5), sFor);
ok('L5 shows English, accepts Spanish', c.band.key === 'production' && c.accepted.includes(comer.es));
c = E.buildCard(comer, met(9), sFor);
ok('L9 is cloze with a blank', c.band.key === 'cloze' && c.prompt.includes('_____') && !c.fellBack);
ok('cloze answer is the surface form', c.accepted.length === 1 && /^[a-záéíóúñ]+$/i.test(c.accepted[0]));
ok('cloze reveal restores the sentence', !c.revealContext.includes('{'));
// Built rather than found: every word in the bank has a sentence now, so
// there is no longer one lying around to stand in for a word that does not.
const noSent = { id: 'zz_no_sentence', es: 'palabra', en: ['word'], pos: 'noun' };
c = E.buildCard(noSent, met(9), sFor);
ok('cloze with no sentence falls back and flags', c.fellBack === true && c.band.key === 'production', noSent.es);

console.log('--- a word you have never met is shown, not asked ---');
c = E.buildCard(comer, E.freshProgress(), sFor);
ok('a never-seen word builds an intro card', c.intro === true && c.band.key === 'intro');
ok('it shows the word and what it means', c.prompt === comer.es && c.reveal === comer.en.join(', '));
ok('and there is nothing to type', c.accepted.length === 0);
ok('it carries an example with the word still in it',
  c.example && !c.example.es.includes('{') && c.example.es.includes(c.example.target), JSON.stringify(c.example));
ok('a word met once is tested instead', E.buildCard(comer, met(1), sFor).intro !== true);
ok('introducing can be turned off',
  E.buildCard(comer, E.freshProgress(), sFor, { introduce: false }).band.key === 'recognition');
ok('a word with no sentence still introduces, just without the example',
  E.introCard(noSent, sFor).example === null);

console.log('--- an introduction is not an answer ---');
let seen = E.applyResult({ ...E.freshProgress(), level: 4, correctStreak: 1 }, 'seen', NOW);
ok('the level does not move', seen.levelAfter === 4);
ok('the streak is not broken', seen.progress.correctStreak === 1);
ok('nothing is counted right or wrong',
  seen.progress.totalCorrect === 0 && seen.progress.totalWrong === 0 && seen.progress.totalAlmost === 0);
ok('but the word counts as met, so it is not introduced twice',
  seen.progress.timesSeen === 1 && seen.progress.lastSeen === NOW);

console.log('--- round selection ---');
const progMap = {}; const pf = (id) => (progMap[id] ||= E.freshProgress());
const round = E.pickRound(SEED.vocabulary, pf, NOW, 15, { maxNew: 15 });
ok('round is the requested size', round.length === 15);
// Nothing tops a round back up out of the new pile, so on a fresh bank the
// round is exactly as long as the allowance permits.
ok('a fresh bank gives a short round rather than a pile of unknown words',
  E.pickRound(SEED.vocabulary, pf, NOW, 15, { maxNew: 5 }).length === 5);
ok('no duplicates in a round', new Set(round.map(w => w.id)).size === 15);
progMap['comer'] = { ...E.freshProgress(), enabled: false };
const r2 = E.pickRound(SEED.vocabulary, pf, NOW, 130);
ok('disabled words excluded', !r2.some(w => w.id === 'comer'));
ok('round cannot exceed the pool',
  E.pickRound(SEED.vocabulary.slice(0,5), pf, NOW, 15, { maxNew: 15 }).length === 5);

console.log('--- new words are rationed once there are others to draw on ---');
const mixed = {};
SEED.vocabulary.forEach((w, i) => {
  // Half the bank met, half never seen.
  mixed[w.id] = i % 2 ? { ...E.freshProgress(), timesSeen: 3, lastSeen: NOW } : E.freshProgress();
});
const mf = (id) => mixed[id];
let worst = 0;
for (let i = 0; i < 40; i++) {
  const r = E.pickRound(SEED.vocabulary, mf, NOW, 15, { maxNew: 5 });
  worst = Math.max(worst, r.filter(w => !mixed[w.id].timesSeen).length);
  if (r.length !== 15) { ok('rounds stay full length', false, 'got ' + r.length); break; }
}
ok('never more new words than the cap allows', worst <= 5, 'worst was ' + worst);
ok('and the cap can be lifted', E.pickRound(SEED.vocabulary, mf, NOW, 15, { maxNew: 15 }).length === 15);

console.log('--- new words arrive commonest first, and stop when you are full ---');
const order = ['ser', 'tener', 'hacer', 'comer', 'dormir'];
const rankOf = (id) => (order.indexOf(id) === -1 ? 999 : order.indexOf(id));
const blank = {}; const bf = (id) => (blank[id] ||= E.freshProgress());
const first = E.pickRound(SEED.vocabulary, bf, NOW, 3, { maxNew: 3, rankOf });
ok('the first words taught are the first words listed',
  first.map(w => w.id).join() === 'ser,tener,hacer', first.map(w => w.id).join());
ok('and that order is not luck, it repeats',
  E.pickRound(SEED.vocabulary, bf, NOW, 3, { maxNew: 3, rankOf }).map(w => w.id).join() === 'ser,tener,hacer');

const load = {};
const lf = (id) => (load[id] ||= E.freshProgress());
SEED.vocabulary.forEach((w, i) => { load[w.id] = { ...E.freshProgress(), timesSeen: 2, level: i < 20 ? 1 : 9 }; });
ok('twenty words short of settled counts as twenty settling',
  E.stillSettling(SEED.vocabulary, lf) === 20);
ok('and no new word is allowed through', E.newWordAllowance(SEED.vocabulary, lf) === 0);
load[SEED.vocabulary[0].id] = { ...E.freshProgress(), timesSeen: 2, level: E.CONFIG.SETTLED_LEVEL };
ok('one settling makes room for exactly one', E.newWordAllowance(SEED.vocabulary, lf) === 1);
ok('a word out of recognition counts as settled',
  E.stillSettling(SEED.vocabulary, lf) === 19);
const empty = {}; const ef = (id) => (empty[id] ||= E.freshProgress());
ok('knowing nothing allows a full first helping, not more',
  E.newWordAllowance(SEED.vocabulary, ef) === E.CONFIG.MAX_NEW_PER_ROUND);
ok('a disabled word is not counted as settling',
  E.stillSettling([{ id: 'zzz' }], () => ({ enabled: false, timesSeen: 3, level: 1 })) === 0);

console.log('--- the amber band ---');
const near = (typed, acc, opt) => E.checkAnswer(typed, acc, opt);
ok('English article flagged, not failed',
  near('a glass of water', ['glass of water']).almost === true);
ok('and named as an article',
  near('a glass of water', ['glass of water']).reason === 'article');
ok('an amber answer is not a correct one',
  near('a glass of water', ['glass of water']).correct === false);
ok('article the other way round too', near('table', ['the table']).almost === true);
ok('Spanish article stays free, not amber', near('mesa', ['la mesa']).correct === true);
ok('missing infinitive flagged', near('walk', ['to walk']).reason === 'infinitive');
ok('one-letter slip is amber with tolerance off',
  near('habitacon', ['habitación']).reason === 'spelling');
ok('the same slip is a clean pass with tolerance on',
  near('habitacon', ['habitación'], { typoTolerance: true }).correct === true);
ok('a different word is still wrong',
  near('kitchen', ['bathroom']).almost === false);
ok('two letters out of a short answer is still wrong',
  near('bano', ['casa']).almost === false);
ok('two letters out of a long answer is amber',
  near('por supueso', ['por supuesto']).almost === true);
ok('a swapped pair of letters costs one edit, not two',
  E.damerau('hunegr', 'hunger') === 1 && E.levenshtein('hunegr', 'hunger') === 2);
ok('so a transposition is amber, not wrong',
  near('hunegr', ['hunger']).reason === 'spelling');
ok('and it passes outright with typo tolerance on',
  near('hunegr', ['hunger'], { typoTolerance: true }).correct === true);
ok('a transposition in an accented word too',
  near('habitacino', ['habitación']).almost === true);
ok('but a genuinely mangled word is still wrong',
  near('tsire', ['triste']).almost === false);

console.log('--- the correction ---');
const d1 = near('a glass of water', ['glass of water']).diff;
ok('extra word marked as typed', d1[0].op === 'extra' && d1[0].text === 'a');
ok('the rest of the answer left alone', d1.slice(1).every(o => o.op === 'same'));
const d2 = near('habitacon', ['habitación']).diff;
ok('a misspelling is one changed word, not two edits', d2.length === 1 && d2[0].op === 'changed');
ok('the missing letter is picked out', d2[0].fix === 'i', JSON.stringify(d2[0]));
ok('and the accent survives into the highlight', d2[0].head + d2[0].fix + d2[0].tail === 'habitación');
const d3 = near('walk', ['to walk']).diff;
ok('a dropped word is marked missing', d3[0].op === 'missing' && d3[0].text === 'to');

console.log('--- an amber answer holds the word ---');
let a = { ...E.freshProgress(), level: 5, correctStreak: 1 };
const held = E.applyResult(a, 'almost', NOW);
ok('level does not move', held.levelAfter === 5 && held.held === true);
ok('streak stands rather than breaking', held.progress.correctStreak === 1);
ok('it is not counted as right or wrong',
  held.progress.totalCorrect === 0 && held.progress.totalWrong === 0);
ok('but it is counted', held.progress.totalAlmost === 1);
ok('the card still counts as seen', held.progress.timesSeen === 1);
ok('booleans still mean correct and wrong',
  E.applyResult(a, true, NOW).levelAfter === 6 && E.applyResult(a, false, NOW).levelAfter === 4);
// A near miss at a band boundary must not promote on its own, but must not
// cost the streak that a later right answer needs either.
let b = { ...E.freshProgress(), level: 3, correctStreak: 1 };
b = E.applyResult(b, 'almost', NOW).progress;
ok('amber at a boundary does not promote', b.level === 3);
b = E.applyResult(b, true, NOW).progress;
ok('and the standing streak still carries it over', b.level === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
