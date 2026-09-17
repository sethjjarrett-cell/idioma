/* The theme: paper by default whatever the operating system prefers, dark
   only when it is asked for here, per device, and with no white flash. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
const open = async (colorScheme) => {
  const ctx = await b.newContext({ colorScheme });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(400);
  return p;
};
const themeOf = (p) => p.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-theme'),
  bg: getComputedStyle(document.body).backgroundColor,
  meta: document.getElementById('theme-colour')?.getAttribute('content'),
}));
const PAPER = 'rgb(239, 227, 200)';
const OLIVE = 'rgb(36, 36, 26)';

console.log('--- with the operating system set to dark ---');
let p = await open('dark');
let t = await themeOf(p);
console.log('page is still paper   :', t.bg === PAPER, t.bg);
console.log('no theme attribute set:', t.attr === null);
console.log('browser chrome colour :', t.meta);

console.log('\n--- with the operating system set to light ---');
const light = await open('light');
console.log('page is paper         :', (await themeOf(light)).bg === PAPER);

console.log('\n--- choosing dark in the menu ---');
await p.click('#btn-menu'); await p.waitForTimeout(200);
console.log('toggle starts off     :', !(await p.isChecked('#set-dark')));
await p.check('#set-dark'); await p.waitForTimeout(300);
t = await themeOf(p);
console.log('page goes olive       :', t.bg === OLIVE, t.bg);
console.log('attribute set         :', t.attr === 'dark');
console.log('chrome colour follows :', t.meta);

console.log('\n--- and it survives a reload ---');
await p.reload(); await p.waitForTimeout(400);
t = await themeOf(p);
console.log('still dark            :', t.bg === OLIVE && t.attr === 'dark');
// The attribute has to be on the element before the first paint, or a
// dark-mode user gets a white flash on every load. The head script is what
// does that, so check it is the head script and not app.js doing the work.
const early = await p.evaluate(() => {
  const scripts = [...document.querySelectorAll('head script')];
  return scripts.some((x) => x.textContent.includes('idioma.theme.v1'));
});
console.log('set in the head, before paint:', early);
await p.click('#btn-menu'); await p.waitForTimeout(150);
console.log('toggle reads as on    :', await p.isChecked('#set-dark'));

console.log('\n--- turning it back off ---');
await p.uncheck('#set-dark'); await p.waitForTimeout(300);
console.log('back to paper         :', (await themeOf(p)).bg === PAPER);
await p.reload(); await p.waitForTimeout(400);
console.log('and stays paper       :', (await themeOf(p)).bg === PAPER);

console.log('\n--- it is a per-device choice, not a synced one ---');
const other = await open('light');
console.log('a different device is unaffected:', (await themeOf(other)).bg === PAPER);
const inSettings = await p.evaluate(() =>
  JSON.stringify(window.Idioma.state.settings).includes('theme'));
console.log('theme is not in the synced settings:', !inSettings);

console.log('\npageerror =', pe);
await b.close();
