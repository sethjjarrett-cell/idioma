/* Against the clock: off by default, a draining bar on word and verb cards
   when switched on, and an empty box when it runs out is a miss. Not on a
   teaching card, a sentence or Write it, and a save from before the setting
   existed loads with it off. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };
const ctx = await b.newContext({ viewport: { width: 390, height: 660 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);

console.log('--- off by default ---');
await p.click('[data-mode="verbs"]'); await p.click('#btn-start'); await p.waitForTimeout(300);
ok('no clock on a verb card', await p.isHidden('#clock'));
await p.waitForTimeout(1200);
ok('and nothing is checked behind your back', await p.isHidden('#verdict'));

console.log('--- eight seconds ---');
await p.click('#btn-menu'); await p.waitForTimeout(150);
await p.click('#set-clock .pill[data-clock="8"]');
ok('the setting is kept', await p.evaluate(() => window.Idioma.state.settings.clock) === 8);
ok('and says what it means', /Eight seconds/.test(await p.textContent('#clock-blurb')));
await p.click('#btn-menu');
await p.click('#picker-summary').catch(() => {});
await p.click('[data-mode="verbs"]'); await p.click('#btn-start'); await p.waitForTimeout(300);
ok('a verb card has the bar', await p.isVisible('#clock'));
const t0 = Date.now();
await p.waitForSelector('#verdict:not([hidden])', { timeout: 10000 });
const took = Date.now() - t0;
ok(`it is checked when the time is up (${took}ms)`, took > 6500 && took < 9500);
ok('an empty box is a miss', await p.evaluate(() => document.getElementById('card').classList.contains('wrong')));
ok('the bar goes with the question', await p.isHidden('#clock'));

await p.click('#btn-next'); await p.waitForTimeout(200);
const want = await p.evaluate(() => window.__card.accepted[0]);
await p.fill('#answer', want); await p.click('#btn-submit'); await p.waitForTimeout(200);
ok('answering in time is marked as usual', await p.evaluate(() => document.getElementById('card').classList.contains('correct')));
const results = await p.evaluate(() => window.Idioma.round.results.length);
await p.waitForTimeout(8500);
ok('and the clock does not fire again on the verdict', await p.evaluate(() => window.Idioma.round.results.length) === results
  && await p.isVisible('#btn-next'));

console.log('--- not where it does not belong ---');
await p.click('#picker-summary').catch(() => {});
await p.click('[data-mode="write"]'); await p.click('#btn-start'); await p.waitForTimeout(300);
ok('no clock on Write it, a whole sentence', await p.isHidden('#clock'));
await p.evaluate(() => { window.Idioma.state.progress = {}; });
await p.click('#picker-summary').catch(() => {});
await p.click('[data-mode="words"]'); await p.click('#btn-start'); await p.waitForTimeout(300);
const intro = await p.evaluate(() => !!window.__card.intro);
ok('no clock on a teaching card', !intro || await p.isHidden('#clock'));

console.log('--- an old save ---');
{
  // A save written before the setting existed, put in place before the app loads.
  const old = await b.newContext();
  await old.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('idioma.state.v1', JSON.stringify({ version: 1, savedAt: '2026-10-01T00:00:00Z',
      settings: { typoTolerance: false, introduceNew: false, roundSize: 15, pace: 'steady', mode: 'verbs' },
      progress: {}, customWords: [], customSentences: [], editedWords: {}, stats: {} }));
  });
  const q = await old.newPage();
  q.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await q.goto('file:///home/user/idioma/index.html'); await q.waitForTimeout(400);
  ok('loads with the clock off', await q.evaluate(() => window.Idioma.state.settings.clock) === 0);
  ok('and the rest of its settings intact', await q.evaluate(() => window.Idioma.state.settings.mode) === 'verbs');
  await old.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
