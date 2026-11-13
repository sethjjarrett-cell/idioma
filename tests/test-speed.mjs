/* Starting a round has to be quick on a phone.

   A Write it round once took 24 seconds to start on a laptop, and on a phone
   the page froze and was killed: picking a varied round asked for the whole
   word list once per candidate sentence, and that list had become slow to
   build. Nothing else noticed, because every other test waits patiently.

   This one does not. The processor is slowed six-fold, roughly a mid-range
   phone, and each kind of round has to start within two seconds. */
import { chromium } from 'playwright';

let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 760 } });
p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);
await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 150)) {
    st.progress[id] = { ...E.freshProgress(), level: 3, timesSeen: 4, lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
});
await p.reload(); await p.waitForTimeout(400);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

const timed = async (fn) => { const t = Date.now(); await fn(); return Date.now() - t; };
const LIMIT = 2000;

await p.click('[data-mode="write"]');
for (const [label, value] of [['Write it, Mixed', 'mixed'], ['Write it, Your words', 'mine'], ['Write it, Basic', 'basic']]) {
  await p.click('#picker-summary').catch(() => {});
  await p.click(`#filter-pills [data-value="${value}"]`);
  const ms = await timed(() => p.click('#btn-start'));
  ok(`${label} starts in ${ms}ms`, ms < LIMIT && await p.isVisible('#answer'));
  const check = await timed(async () => { await p.fill('#answer', 'hola'); await p.click('#btn-submit'); });
  ok(`and an answer is checked in ${check}ms`, check < LIMIT && await p.isVisible('#verdict'));
}
await p.click('#picker-summary').catch(() => {});
await p.click('#how-pills [data-how="sentences"]');
const tap = await timed(() => p.click('#btn-start'));
ok(`Tap the words starts in ${tap}ms`, tap < LIMIT);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
