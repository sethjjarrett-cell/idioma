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
let c = E.buildCard(comer, { ...E.freshProgress(), level: 2 }, sFor);
ok('L2 shows Spanish, accepts English', c.band.key === 'recognition' && c.prompt === comer.es && c.accepted.join() === comer.en.join());
c = E.buildCard(comer, { ...E.freshProgress(), level: 5 }, sFor);
ok('L5 shows English, accepts Spanish', c.band.key === 'production' && c.accepted.includes(comer.es));
c = E.buildCard(comer, { ...E.freshProgress(), level: 9 }, sFor);
ok('L9 is cloze with a blank', c.band.key === 'cloze' && c.prompt.includes('_____') && !c.fellBack);
ok('cloze answer is the surface form', c.accepted.length === 1 && /^[a-záéíóúñ]+$/i.test(c.accepted[0]));
ok('cloze reveal restores the sentence', !c.revealContext.includes('{'));
const noSent = SEED.vocabulary.find(w => sFor(w.id).length === 0);
c = E.buildCard(noSent, { ...E.freshProgress(), level: 9 }, sFor);
ok('cloze with no sentence falls back and flags', c.fellBack === true && c.band.key === 'production', noSent.es);

console.log('--- round selection ---');
const progMap = {}; const pf = (id) => (progMap[id] ||= E.freshProgress());
const round = E.pickRound(SEED.vocabulary, pf, NOW, 15);
ok('round is the requested size', round.length === 15);
ok('no duplicates in a round', new Set(round.map(w => w.id)).size === 15);
progMap['comer'] = { ...E.freshProgress(), enabled: false };
const r2 = E.pickRound(SEED.vocabulary, pf, NOW, 130);
ok('disabled words excluded', !r2.some(w => w.id === 'comer'));
ok('round cannot exceed the pool', E.pickRound(SEED.vocabulary.slice(0,5), pf, NOW, 15).length === 5);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
