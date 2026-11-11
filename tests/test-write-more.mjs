/* Write it, the parts added after the first hundred and twenty sentences:
   Your words, which offers the bank's sentences as you learn the words for
   them, and the switch that hides Might help. */
import { chromium } from 'playwright';

let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 660 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);

const meet = (n) => p.evaluate((count) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  st.progress = {};
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: 4, timesSeen: 3, lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, n);
const pillCount = async (id) => Number((await p.textContent(`#filter-pills .pill[data-value="${id}"] i`).catch(() => '0')) || 0);

console.log('--- your words ---');
await p.click('[data-mode="write"]'); await p.waitForTimeout(150);
const empty = await pillCount('mine');
await meet(100);
await p.reload(); await p.waitForTimeout(400);
const after = await pillCount('mine');
ok(`it is the first level offered`, (await p.$$eval('#filter-pills .pill', (ps) => ps.map((x) => x.dataset.value)))[0] === 'mine');
ok(`it grows with the words you know (${empty} at none, ${after} at a hundred)`, after > 300 && after > empty * 10);
await p.click('#filter-pills .pill[data-value="mine"]'); await p.waitForTimeout(150);
ok('the start line says it grows', /more with every word you learn/.test(await p.textContent('#start-blurb')));
await p.click('#btn-start'); await p.waitForTimeout(300);
const c = await p.evaluate(() => ({ label: window.__card.band.label, write: window.__card.isWrite,
  es: window.__card.accepted[0], en: window.__card.prompt }));
ok('a Your words card is a typed Write it card', c.write && c.label === 'Write it · Your words', JSON.stringify(c));
ok('it asks the English and wants the Spanish', !!c.en && !!c.es && c.en !== c.es);
ok('every word in it is one you have met, or all but one', await p.evaluate(() => {
  const st = window.Idioma.state, S = window.Idioma.Store;
  const row = S.sentenceIndex(st).rows.find((r) => r.item.id === window.__card.item.id);
  return row && !row.loose.length && row.needs.filter((id) => !(st.progress[id] || {}).timesSeen).length <= 1;
}));
await p.fill('#answer', c.es); await p.click('#btn-submit'); await p.waitForTimeout(200);
ok('typing it right is marked right', await p.evaluate(() => document.getElementById('card').classList.contains('correct')));
ok('and it is kept in the Write it book', await p.evaluate((id) => !!(window.Idioma.state.writing[id] || {}).timesSeen,
  await p.evaluate(() => window.__card.item.id)));

console.log('--- hiding Might help ---');
await meet(0);
await p.reload(); await p.waitForTimeout(400);
await p.click('#picker-summary').catch(() => {});
await p.click('[data-mode="write"]'); await p.waitForTimeout(100);
await p.click('#filter-pills .pill[data-value="basic"]'); await p.waitForTimeout(100);
await p.click('#btn-start'); await p.waitForTimeout(300);
ok('a fresh learner sees the hints', await p.locator('#card-help .hchip').count() > 0);
await p.click('#card-help [data-hints="off"]'); await p.waitForTimeout(100);
ok('one tap hides them', await p.locator('#card-help .hchip').count() === 0
  && await p.isVisible('#card-help [data-hints="on"]'));
ok('and the setting is kept', await p.evaluate(() => window.Idioma.state.settings.writeHints) === false);
ok('the answer box keeps the focus', await p.evaluate(() => document.activeElement && document.activeElement.id === 'answer'));
await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(150);
await p.click('#btn-next'); await p.waitForTimeout(200);
ok('the next card stays without them', await p.locator('#card-help .hchip').count() === 0);
await p.reload(); await p.waitForTimeout(400);
ok('and so does the next visit', await p.evaluate(() => window.Idioma.state.settings.writeHints) === false);
await p.click('#btn-start'); await p.waitForTimeout(300);
await p.click('#card-help [data-hints="on"]'); await p.waitForTimeout(100);
ok('one tap brings them back', await p.locator('#card-help .hchip').count() > 0);

console.log('--- an old save ---');
{
  const old = await b.newContext();
  await old.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('idioma.state.v1', JSON.stringify({ version: 1, savedAt: '2026-10-01T00:00:00Z',
      settings: { typoTolerance: false, roundSize: 15, mode: 'write', writeLevel: 'basic' },
      progress: {}, customWords: [], customSentences: [], editedWords: {}, stats: {} }));
  });
  const q = await old.newPage();
  q.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await q.goto('file:///home/user/idioma/index.html'); await q.waitForTimeout(400);
  ok('a save from before loads with the hints on and its level kept',
    await q.evaluate(() => window.Idioma.state.settings.writeHints === true && window.Idioma.state.settings.writeLevel === 'basic'));
  await old.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
