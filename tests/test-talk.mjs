/* Having a Course conversation, Write it typed or tapped, and Sounds wrong?

   The voice is a stand-in that writes down what it was asked to say, so the
   test can check the other person's lines are spoken; how they sound is the
   phone's business. */
import { chromium } from 'playwright';

let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const VOICE = () => {
  window.__spoken = [];
  class U { constructor(t) { this.text = t; this.lang = ''; this.rate = 1; this.voice = null; } }
  const synth = { speaking: false, pending: false, paused: false,
    getVoices: () => [{ name: 'Paulina', lang: 'es-MX', localService: true }],
    speak(u) { if (u.text.trim()) window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 0); },
    cancel() {}, resume() {}, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function open(init = VOICE) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 } });
  await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(400);
  return { ctx, p };
}
const openUnit = async (p, id) => {
  await p.click('.tab[data-screen="course"]'); await p.waitForTimeout(100);
  await p.click(`[data-unit="${id}"]`); await p.waitForTimeout(100);
  await p.click('[data-step="read"] > summary').catch(() => {});
  await p.waitForTimeout(100);
};

console.log('--- read and hear ---');
{
  const { ctx, p } = await open();
  await openUnit(p, 'u6');
  ok('a unit offers both ways', await p.isVisible('[data-act="talk"][data-how="read"]')
    && await p.isVisible('[data-act="talk"][data-how="hear"]'));
  const before = await p.evaluate(() => JSON.stringify(window.Idioma.state.progress));
  await p.click('[data-act="talk"][data-how="read"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ talk: !!window.__card.talk, prompt: window.__card.prompt, es: window.__card.reveal,
    label: window.__card.band.label, n: window.Idioma.round.queue.length }));
  ok('it is a round of Sam\'s lines', c.talk && c.n === 6 && c.label === 'Conversation · Unit 6', JSON.stringify(c));
  ok('the other person\'s line is shown', /Buenos días, Sam/.test(await p.textContent('#talk')));
  ok('and spoken', (await p.evaluate(() => window.__spoken)).some((t) => /Buenos días, Sam/.test(t)));
  ok('what to say is given in English', c.prompt === 'Very good, thanks. And yours?');
  await p.fill('#answer', 'muy bien gracias y el tuyo'); await p.click('#btn-submit'); await p.waitForTimeout(200);
  ok('saying it right is marked right, accents and capitals aside',
    await p.evaluate(() => document.getElementById('card').classList.contains('correct')));
  ok('the other line\'s English is there after answering', /Morning, Sam/.test(await p.textContent('#talk')));
  for (let i = 1; i < 6; i++) {
    await p.click('#btn-next'); await p.waitForTimeout(150);
    await p.fill('#answer', 'no sé'); await p.click('#btn-submit'); await p.waitForTimeout(120);
  }
  ok('nothing levels up or down', await p.evaluate(() => JSON.stringify(window.Idioma.state.progress)) === before);
  await p.click('#btn-next'); await p.waitForTimeout(200);
  ok('the end of it leads back to the unit', await p.isVisible('#btn-unit-back'));
  ok('and offers to go over what was missed', await p.isVisible('#btn-review'));
  await p.click('#btn-review'); await p.waitForTimeout(200);
  ok('which is the conversation again, not something else', await p.evaluate(() => !!window.__card.talk));
  await ctx.close();
}

console.log('--- hear only ---');
{
  const { ctx, p } = await open();
  await openUnit(p, 'u8');
  await p.click('[data-act="talk"][data-how="hear"]'); await p.waitForTimeout(300);
  const t = await p.textContent('#talk');
  ok('the line is heard, not shown', /\(listen\)/.test(t) && !/Para dónde/.test(t), t);
  ok('but it is spoken', (await p.evaluate(() => window.__spoken)).some((x) => /Para dónde va/.test(x)));
  await p.click('[data-talk="show"]'); await p.waitForTimeout(100);
  ok('Show it shows it', /Para dónde va/.test(await p.textContent('#talk')));
  await p.click('#btn-next').catch(() => {});
  await p.fill('#answer', 'buenos dias un pasaje para bogota por favor'); await p.click('#btn-submit'); await p.waitForTimeout(200);
  ok('and the answer is marked as usual', await p.evaluate(() => document.getElementById('card').classList.contains('correct')));
  await ctx.close();
}

console.log('--- write it, typed or tapped ---');
{
  const { ctx, p } = await open();
  ok('there is no separate Sentences button', await p.locator('#modes [data-mode="sentences"]').count() === 0);
  await p.click('[data-mode="write"]'); await p.waitForTimeout(100);
  ok('Write it offers Type it out and Tap the words, typing first', await p.isVisible('#hows')
    && (await p.textContent('#how-pills .pill.on')).trim() === 'Type it out');
  await p.click('[data-mode="words"]'); await p.waitForTimeout(100);
  ok('the choice is only shown for Write it', await p.isHidden('#hows'));
  await p.evaluate(() => {
    const st = window.Idioma.state, E = window.Idioma.Engine;
    for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 60)) {
      st.progress[id] = { ...E.freshProgress(), level: 4, timesSeen: 3, lastSeen: new Date().toISOString() };
    }
    window.Idioma.Store.saveNow(st);
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-mode="write"]'); await p.waitForTimeout(100);
  await p.click('#how-pills [data-how="sentences"]'); await p.waitForTimeout(150);
  ok('Tap the words keeps Write it lit', await p.evaluate(() => document.querySelector('#modes .mode.on').dataset.mode) === 'write');
  await p.click('#btn-start'); await p.waitForTimeout(300);
  ok('and gives tiles', await p.isVisible('#build') && await p.evaluate(() => window.__card.band.key) === 'build');
  ok('the folded line says which', /Write it · tap/.test(await p.textContent('#picker-summary-text')));
  await p.reload(); await p.waitForTimeout(400);
  ok('the choice survives a reload', (await p.textContent('#how-pills .pill.on')).trim() === 'Tap the words');
  await p.click('#how-pills [data-how="write"]'); await p.waitForTimeout(150);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  ok('Type it out is typed from the start', await p.evaluate(() => !!window.__card.isWrite) && await p.isVisible('#answer'));
  await ctx.close();
}

console.log('--- sounds wrong? ---');
{
  const { ctx, p } = await open();
  await p.click('[data-mode="write"]'); await p.waitForTimeout(100);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(150);
  ok('the verdict offers it', await p.isVisible('#btn-flag'));
  const es = await p.evaluate(() => window.__card.reveal);
  await p.click('#btn-flag'); await p.waitForTimeout(100);
  ok('tapped, it says so and can be undone', /undo/.test(await p.textContent('#btn-flag')));
  await p.click('#btn-menu'); await p.waitForTimeout(150);
  ok('the menu counts it', (await p.textContent('#flags-count')).trim() === '1');
  await p.click('#flags-panel summary'); await p.waitForTimeout(100);
  ok('and lists it, Spanish and English', (await p.textContent('#flag-list')).includes(es));
  await p.reload(); await p.waitForTimeout(400);
  ok('it is kept', await p.evaluate(() => window.Idioma.Store.openFlags(window.Idioma.state).length) === 1);
  const merged = await p.evaluate(() => {
    const a = { savedAt: '2026-11-01T00:00:00Z', progress: {}, flags: { x: { es: 'uno', en: 'one', at: '2026-11-01T00:00:00Z' } } };
    const b = { savedAt: '2026-11-02T00:00:00Z', progress: {}, flags: { x: { es: 'uno', en: 'one', at: '2026-11-02T00:00:00Z', done: true },
      y: { es: 'dos', en: 'two', at: '2026-11-02T00:00:00Z' } } };
    return window.Sync.merge(a, b).flags;
  });
  ok('across devices, taking one off wins over the older flag, and both lists join',
    merged.x.done === true && merged.y.es === 'dos', JSON.stringify(merged));
  await p.click('#btn-menu'); await p.waitForTimeout(150);
  await p.click('#flags-panel summary').catch(() => {});
  await p.click('[data-unflag]'); await p.waitForTimeout(100);
  ok('and it comes off the list', (await p.textContent('#flags-count')).trim() === 'None');
  await ctx.close();
}

console.log('--- an old save ---');
{
  const { ctx, p } = await open(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('idioma.state.v1', JSON.stringify({ version: 1, savedAt: '2026-10-01T00:00:00Z',
      settings: { roundSize: 15, mode: 'sentences' }, progress: { mesa: { level: 6, timesSeen: 4 } },
      customWords: [], customSentences: [], editedWords: {}, stats: {} }));
  });
  ok('loads with no flags and its progress intact', await p.evaluate(() =>
    JSON.stringify(window.Idioma.state.flags) === '{}' && window.Idioma.state.progress.mesa.level === 6));
  ok('and a saved Sentences choice shows as Write it, tapped', await p.evaluate(() =>
    document.querySelector('#modes .mode.on').dataset.mode === 'write')
    && (await p.textContent('#how-pills .pill.on')).trim() === 'Tap the words');
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
