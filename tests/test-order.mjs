/* The teaching order: that it covers the bank, and that it actually decides
   which words a learner meets first. */
import { readFileSync } from 'fs';
import vm from 'vm';
const ctx = { window: {}, console, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['seed.js', 'vocab.js', 'order.js', 'engine.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
}
const SEED = vm.runInContext('SEED', ctx);
const { TEACHING_ORDER, rankOf } = ctx.window.TeachingOrder;
const E = ctx.window.Engine;
const bank = SEED.vocabulary.concat(ctx.window.VOCAB.vocabulary);
const byId = Object.fromEntries(bank.map(w => [w.id, w]));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

console.log('--- the list ---');
ok('every word in the bank is placed',
  bank.every(w => rankOf(w.id) !== Number.MAX_SAFE_INTEGER),
  bank.filter(w => rankOf(w.id) === Number.MAX_SAFE_INTEGER).map(w => w.id).join(', '));
ok('nothing is placed twice', new Set(TEACHING_ORDER).size === TEACHING_ORDER.length,
  TEACHING_ORDER.filter((x, i) => TEACHING_ORDER.indexOf(x) !== i).join(', '));
ok('nothing is placed that is not in the bank',
  TEACHING_ORDER.every(id => byId[id]),
  TEACHING_ORDER.filter(id => !byId[id]).join(', '));
ok('an unlisted word sorts last, rather than first',
  rankOf('a_word_that_does_not_exist') > rankOf(TEACHING_ORDER[TEACHING_ORDER.length - 1]));

console.log('--- it puts the useful words first ---');
const top = TEACHING_ORDER.slice(0, 30);
for (const id of ['ser', 'estar', 'tener', 'ir', 'hacer', 'no', 'de', 'que']) {
  ok(`${byId[id].es} is taught in the first thirty`, top.includes(id),
    'rank ' + rankOf(id));
}
const late = ['tocineta', 'caneca', 'asimismo', 'pinta'];
for (const id of late) {
  ok(`${byId[id].es} waits until later`, rankOf(id) > 100, 'rank ' + rankOf(id));
}
ok('the two verbs for to be come before anything you would say with them',
  rankOf('ser') < rankOf('cansado') && rankOf('estar') < rankOf('cansado'));
ok('you meet agua before vaso de agua',
  rankOf('agua') < rankOf('vaso-de-agua'));

console.log('--- and it decides what a round teaches ---');
const prog = {}; const pf = (id) => (prog[id] ||= E.freshProgress());
const first = E.pickRound(bank, pf, '2026-09-17T12:00:00Z', 15, { rankOf });
ok('a first round is the allowance, not the round size',
  first.length === E.CONFIG.MAX_NEW_PER_ROUND, 'got ' + first.length);
ok('and it is the first words in the list',
  first.map(w => w.id).join() === TEACHING_ORDER.slice(0, first.length).join(),
  first.map(w => w.id).join());

/* Walk a simulated learner through it. `hitRate` is how often they get a
   card right, so the same rule can be watched under someone doing well and
   someone struggling. */
function walk(hitRate, rounds) {
  const prg = {}; const f = (id) => (prg[id] ||= E.freshProgress());
  let met = 0, shortest = 99, overCap = 0, newWhileFull = 0, lateArrivals = 0;
  for (let r = 0; r < rounds; r++) {
    const settlingBefore = E.stillSettling(bank, f);
    const round = E.pickRound(bank, f, '2026-09-17T12:00:00Z', 15, { rankOf });
    const fresh = round.filter(w => !f(w.id).timesSeen).length;
    if (r > 3) shortest = Math.min(shortest, round.length);
    if (settlingBefore >= E.CONFIG.LEARNING_CAP && fresh) newWhileFull++;
    if (fresh > E.CONFIG.MAX_NEW_PER_ROUND) overCap++;
    if (r >= rounds - 10) lateArrivals += fresh;
    met += fresh;
    for (const w of round) {
      const p = f(w.id);
      prg[w.id] = E.applyResult(p, !p.timesSeen ? 'seen'
        : (Math.random() < hitRate ? 'correct' : 'wrong'), '2026-09-17T12:00:00Z').progress;
    }
  }
  return { met, shortest, overCap, newWhileFull, lateArrivals };
}

console.log('--- a learner walking through it ---');
for (const rate of [0.9, 0.7, 0.5]) {
  const w = walk(rate, 60);
  console.log(`  ${rate * 100}% right: met ${w.met} words in 60 rounds`
    + ` (${(w.met / 60).toFixed(1)} a round)`);
  ok(`at ${rate * 100}% right, never more new in a round than the cap allows`, w.overCap === 0);
  ok(`at ${rate * 100}% right, none arrive while a capful is unsettled`, w.newWhileFull === 0);
  ok(`at ${rate * 100}% right, it never stalls for good`, w.lateArrivals > 0,
    'nothing new in the last ten rounds');
  ok(`at ${rate * 100}% right, rounds reach full length`, w.shortest === 15,
    'shortest was ' + w.shortest);
}
// The cap governs how many words are *introduced*, not how many are unsettled:
// a word already settled can drop back below the line by being got wrong, and
// no rule should stop that happening.
const regress = { ...E.freshProgress(), level: E.CONFIG.SETTLED_LEVEL, timesSeen: 5 };
ok('a settled word that is got wrong counts as settling again',
  E.stillSettling([{ id: 'x' }], () => E.applyResult(regress, 'wrong', '2026-09-17T12:00:00Z').progress) === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
