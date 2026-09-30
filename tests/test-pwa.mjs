/* Installing, updating, and the accent keys.

   A service worker will not run from file://, so this one serves the folder
   over http itself. The update is played out for real: the test changes what
   the server says sw.js is, the way a deploy stamps a new commit into it,
   and the page has to notice, offer the update, and take it only when told. */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let build = 'first';
let up = true;
const server = createServer((req, res) => {
  if (!up) { req.socket.destroy(); return; }
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = readFileSync(file);
  if (path === '/sw.js') body = body.toString().replace('__BUILD__', build);
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const ok = (what, cond) => { cond ? pass++ : fail++; console.log(`${cond ? '  ok ' : '  !! '} ${what}`); };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 760 } });
const p = await ctx.newPage();
let pe = 0; p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });

console.log('install');
await p.goto(URL_);
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload();
await p.waitForFunction(() => !!navigator.serviceWorker.controller);
ok('the worker controls the page after a reload', true);
const manifest = await p.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]').href;
  return (await fetch(href)).json();
});
ok('manifest is standalone and relative', manifest.display === 'standalone' && manifest.start_url === './');
for (const icon of manifest.icons) {
  const st = await p.evaluate(async (src) => (await fetch(src)).status, icon.src);
  ok(`icon ${icon.src} is there`, st === 200);
}
ok('first install offers no update', await p.isHidden('#update-bar'));
await p.click('#btn-menu');
await p.waitForFunction(() => /first/.test(document.getElementById('app-version').textContent));
ok('the menu says which version this is', (await p.textContent('#app-version')).includes('first'));
ok('check for updates is on offer', await p.isVisible('#btn-check-update'));
await p.click('#btn-check-update');
await p.waitForFunction(() => /latest/.test(document.getElementById('toast').textContent));
ok('checking with nothing new says so', true);
await p.click('#btn-menu');

console.log('offline');
up = false;
await p.reload();
ok('loads with the server down', await p.isVisible('#round-start'));
ok('no page errors offline', pe === 0);
up = true;

console.log('update');
// Progress made before the update has to survive it.
await p.evaluate(() => { window.Idioma.state.settings.roundSize = 7; window.Idioma.Store.saveNow(window.Idioma.state); });
build = 'second';
await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
// visibilitychange is throttled to a minute; the menu button is not.
await p.click('#btn-menu');
await p.click('#btn-check-update');
await p.waitForSelector('#update-bar', { state: 'visible', timeout: 10000 });
ok('a new build is offered', true);
ok('and not applied before it is asked for', await p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration(); return !!r.waiting;
}));
await Promise.all([p.waitForEvent('load'), p.click('#btn-update')]);
await p.waitForFunction(() => /Updated/.test(document.getElementById('toast').textContent));
ok('the reload says it updated', true);
await p.click('#btn-menu');
await p.waitForFunction(() => /second/.test(document.getElementById('app-version').textContent));
ok('now on the new build', true);
ok('settings survived the update', await p.evaluate(() => window.Idioma.state.settings.roundSize) === 7);
ok('old cache cleared', await p.evaluate(async () => (await caches.keys()).join()) === 'idioma-second');
await p.click('#btn-menu');

console.log('accent keys');
const seen = { spanish: 0, english: 0 };
// A fresh learner only gets recognition, which wants English. Words met a
// while ago and sitting at the bottom of production come back in Spanish.
await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  const lvl = E.CONFIG.BAND_RECOGNITION_TOP + 1;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 30)) {
    st.progress[id] = { ...E.freshProgress(), level: lvl, timesSeen: 5,
      lastSeen: new Date(Date.now() - 30 * 864e5).toISOString() };
  }
  window.Idioma.Store.saveNow(st);
});
await p.reload();
await p.waitForTimeout(300);
await p.click('#btn-start');
await p.waitForTimeout(200);
for (let i = 0; i < 40 && (!seen.spanish || !seen.english); i++) {
  const st = await p.evaluate(() => {
    const c = window.__card;
    if (!c) return null;
    return { key: c.band.key, form: !document.getElementById('answer-form').hidden,
             keys: !document.getElementById('accents').hidden };
  });
  if (!st) break;
  if (st.form) {
    const spanish = ['production', 'cloze', 'translate', 'drill'].includes(st.key);
    ok(`${st.key}: keys ${spanish ? 'shown' : 'hidden'}`, st.keys === spanish);
    if (spanish && !seen.spanish) {
      await p.fill('#answer', 'mana');
      await p.focus('#answer');
      await p.evaluate(() => document.getElementById('answer').setSelectionRange(2, 2));
      await p.click('.key[data-ch="ñ"]');
      await p.click('.key[data-ch="á"]');
      ok('keys type at the caret', await p.inputValue('#answer') === 'mañána');
      ok('focus stays in the box', await p.evaluate(() => document.activeElement.id === 'answer'));
    }
    seen[spanish ? 'spanish' : 'english']++;
    await p.fill('#answer', 'definitely wrong');
    await p.click('#btn-submit');
  } else if (await p.isVisible('#btn-got')) {
    await p.click('#btn-got');
    continue;
  } else if (st.key === 'build') {
    await p.click('#btn-build-check');
  }
  await p.waitForTimeout(80);
  if (await p.isVisible('#btn-next')) await p.click('#btn-next');
  else break;
  await p.waitForTimeout(80);
}
ok('saw a card wanting Spanish', seen.spanish > 0);

ok('pageerror = 0', pe === 0);
await b.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
