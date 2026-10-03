/* Progress kept in Google Drive.

   Google is faked: the sign-in page answers straight away with a token, and
   Drive is a Map. What is real is everything on this side: the page leaving
   for Google and coming back, the merge, the guards, and when the app does
   and does not renew its sign-in.

   The case that matters most is the one that happened: progress on a phone,
   the app deleted and added again, an empty app. Signed in, the empty app has
   to get everything back, not push its nothing over the top of it. */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const APP = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const ok = (what, cond) => { cond ? pass++ : fail++; console.log(`${cond ? '  ok ' : '  !! '} ${what}`); };

/* ---------------- the fake Google ---------------- */
const drive = new Map();          // id -> { name, body, modifiedTime }
let nextId = 1;
let authMode = 'grant';           // 'grant' | 'refuse'
const authLog = [];
const fileByName = (name) => [...drive.entries()].find(([, f]) => f.name === name);

async function google(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.host === 'accounts.google.com') {
    const q = url.searchParams;
    authLog.push({ prompt: q.get('prompt'), redirect: q.get('redirect_uri'), hint: q.get('login_hint') });
    const back = authMode === 'grant'
      ? `access_token=tok${authLog.length}&token_type=Bearer&expires_in=3599&state=${q.get('state')}`
      : `error=interaction_required&state=${q.get('state')}`;
    return route.fulfill({ status: 302, headers: { location: `${q.get('redirect_uri')}#${back}` } });
  }
  if (url.host === 'openidconnect.googleapis.com') return json({ email: 'learner@gmail.com' });
  if (url.host === 'oauth2.googleapis.com') return json({});
  if (!/^Bearer tok/.test(req.headers()['authorization'] || '')) return json({ error: 'no' }, 401);
  const p = url.pathname;
  if (p === '/drive/v3/files' && req.method() === 'GET') {
    const name = (url.searchParams.get('q').match(/name='([^']+)'/) || [])[1];
    const hit = fileByName(name);
    return json({ files: hit ? [{ id: hit[0], modifiedTime: hit[1].modifiedTime }] : [] });
  }
  let m = p.match(/^\/drive\/v3\/files\/(\w+)$/);
  if (m && req.method() === 'GET') {
    const f = drive.get(m[1]);
    return f ? route.fulfill({ status: 200, contentType: 'application/json', body: f.body }) : json({}, 404);
  }
  m = p.match(/^\/upload\/drive\/v3\/files\/(\w+)$/);
  if (m && req.method() === 'PATCH') {
    const f = drive.get(m[1]);
    f.body = req.postData(); f.modifiedTime = new Date().toISOString();
    return json({ id: m[1] });
  }
  if (p === '/upload/drive/v3/files' && req.method() === 'POST') {
    const parts = req.postData().split(/--idioma\d+/);
    const meta = JSON.parse(parts[1].split('\r\n\r\n')[1]);
    const body = parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    const id = `f${nextId++}`;
    drive.set(id, { name: meta.name, parents: meta.parents, body, modifiedTime: new Date().toISOString() });
    return json({ id });
  }
  return json({ error: 'unhandled ' + req.method() + ' ' + p }, 500);
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function device({ clientId = 'test-client' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, serviceWorkers: 'block' });
  if (clientId) await ctx.addInitScript((id) => { window.IDIOMA_GOOGLE_CLIENT_ID = id; }, clientId);
  for (const host of ['accounts.google.com', 'www.googleapis.com', 'openidconnect.googleapis.com', 'oauth2.googleapis.com']) {
    await ctx.route(`https://${host}/**`, google);
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto(APP);
  await p.waitForTimeout(300);
  return { ctx, p };
}
const learn = (p, n) => p.evaluate((count) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: 4, timesSeen: 6, lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, n);
const learned = (p) => p.evaluate(() => Object.keys(window.Idioma.state.progress).length);
const auth = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('idioma.google.v1') || '{}'));
const remote = () => { const f = fileByName('idioma-progress.json'); return f ? JSON.parse(f[1].body) : null; };
const signIn = async (p) => {
  await p.click('#btn-menu');
  await Promise.all([p.waitForURL(/127\.0\.0\.1/), p.click('#btn-g-in')]);
  await p.waitForFunction(() => /synced/.test(document.getElementById('g-state').textContent), null, { timeout: 8000 });
};

console.log('not set up');
{
  const { ctx, p } = await device({ clientId: '' });
  ok('the Google section is hidden without a client ID', await p.isHidden('#gsync'));
  await ctx.close();
}

console.log('phone, signing in for the first time');
const phone = await device();
await learn(phone.p, 40);
await signIn(phone.p);
ok('progress went up to Drive', Object.keys(remote().progress).length === 40);
ok('into the hidden app folder', fileByName('idioma-progress.json')[1].parents[0] === 'appDataFolder');
ok('the redirect is the app folder, not index.html', authLog[0].redirect === APP);
ok('first sign-in lets them pick an account', authLog[0].prompt === 'select_account');
ok('the menu says who and when', /learner@gmail\.com, synced/.test(await phone.p.textContent('#g-state')));
ok('the token is gone from the address bar', !/access_token/.test(phone.p.url()));
await phone.ctx.close();

console.log('the app deleted and added again');
const fresh = await device();
ok('starts empty', await learned(fresh.p) === 0);
await signIn(fresh.p);
ok('signing in brings all 40 words back', await learned(fresh.p) === 40);
ok('and Drive still has all 40', Object.keys(remote().progress).length === 40);
ok('the empty state was kept aside before it was replaced',
  await fresh.p.evaluate(() => !!localStorage.getItem('idioma.state.v1.before-sync')));

console.log('two devices adding');
await learn(fresh.p, 50);
await fresh.p.evaluate(() => document.getElementById('btn-g-sync').click());
await fresh.p.waitForTimeout(500);
ok('a new word from this device reaches Drive', Object.keys(remote().progress).length === 50);

console.log('the daily copy');
fileByName('idioma-progress.json')[1].modifiedTime = '2020-01-01T00:00:00.000Z';
await fresh.p.evaluate(() => document.getElementById('btn-g-sync').click());
await fresh.p.waitForTimeout(500);
ok('the first write of a new day keeps the old copy', !!fileByName('idioma-progress-previous.json'));

console.log('an hour later');
const before = authLog.length;
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.expiresAt = Date.now() - 1000; a.lastBounce = 0;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.reload();
await fresh.p.waitForFunction(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  return a.expiresAt > Date.now();
}, null, { timeout: 8000 });
ok('an expired sign-in renews itself on launch', authLog.length === before + 1);
ok('without asking anything', authLog[authLog.length - 1].prompt === 'none');
ok('and with the account named', authLog[authLog.length - 1].hint === 'learner@gmail.com');

console.log('not mid-round');
await fresh.p.click('#btn-start');
await fresh.p.waitForTimeout(200);
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.expiresAt = Date.now() - 1000; a.lastBounce = 0;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
const n = authLog.length;
await fresh.p.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await fresh.p.waitForTimeout(500);
ok('coming back mid-round does not leave for Google', authLog.length === n && await fresh.p.isVisible('#card'));

console.log('Google says no');
authMode = 'refuse';
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.expiresAt = Date.now() - 1000; a.lastBounce = 0;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.reload();
await fresh.p.waitForTimeout(1200);
const tries = authLog.length;
await fresh.p.reload();
await fresh.p.waitForTimeout(800);
ok('a refused renewal is not retried in a loop', authLog.length === tries);
await fresh.p.click('#btn-menu');
ok('it asks for a tap instead', (await fresh.p.textContent('#btn-g-in')) === 'Sign in again' && await fresh.p.isVisible('#btn-g-in'));
ok('progress on the device is untouched', await learned(fresh.p) === 50);
authMode = 'grant';
await fresh.p.click('#btn-menu');

console.log('a reply that is not ours');
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.needsTap = false; a.token = 'tok-mine'; a.expiresAt = Date.now() + 3600e3;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.goto('about:blank');
await fresh.p.goto(`${APP}#access_token=evil&expires_in=3599&state=wrong`);
await fresh.p.waitForTimeout(400);
ok('is ignored', (await auth(fresh.p)).token === 'tok-mine');
ok('and does not sign this device out', !(await auth(fresh.p)).needsTap);
ok('and is cleared from the address bar', !/evil/.test(fresh.p.url()));

console.log('reset');
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.needsTap = false; a.token = 'tok-reset'; a.expiresAt = Date.now() + 3600e3;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.reload();
await fresh.p.waitForTimeout(500);
fresh.p.once('dialog', (d) => d.accept());
await fresh.p.click('#btn-menu');
await fresh.p.click('#btn-reset');
await fresh.p.waitForTimeout(600);
ok('a reset reaches Drive rather than being merged back', Object.keys(remote().progress).length === 0);
await fresh.p.reload();
await fresh.p.waitForTimeout(600);
ok('and stays reset after the next sync', await learned(fresh.p) === 0);

console.log('reset with the sign-in run out');
await learn(fresh.p, 20);
await fresh.p.evaluate(() => document.getElementById('btn-g-sync').click());
await fresh.p.waitForTimeout(500);
ok('(twenty words in Drive again)', Object.keys(remote().progress).length === 20);
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.expiresAt = Date.now() - 1000; a.lastBounce = Date.now();
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.reload(); await fresh.p.waitForTimeout(300);
fresh.p.once('dialog', (d) => d.accept());
await fresh.p.click('#btn-menu');
await fresh.p.click('#btn-reset');
await fresh.p.waitForTimeout(300);
ok('the reset is owed, not dropped', (await auth(fresh.p)).replaceOwed === true);
await fresh.p.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('idioma.google.v1'));
  a.lastBounce = 0;
  localStorage.setItem('idioma.google.v1', JSON.stringify(a));
});
await fresh.p.reload();
await fresh.p.waitForFunction(() => !JSON.parse(localStorage.getItem('idioma.google.v1')).replaceOwed, null, { timeout: 8000 });
ok('and paid once signed in again', Object.keys(remote().progress).length === 0 && await learned(fresh.p) === 0);

console.log('sign out');
await fresh.p.click('#btn-menu');
fresh.p.once('dialog', (d) => d.accept());
await fresh.p.click('#btn-g-out');
ok('signed out', !(await auth(fresh.p)).signedIn && await fresh.p.isVisible('#btn-g-in'));
await fresh.ctx.close();

console.log('the nudge');
{
  const { ctx, p } = await device();
  ok('no nudge with nothing to lose', await p.isHidden('#backup-bar'));
  await learn(p, 12);
  await p.reload(); await p.waitForTimeout(300);
  ok('a nudge once there is', await p.isVisible('#backup-bar'));
  await p.click('#btn-backup-later');
  await p.reload(); await p.waitForTimeout(300);
  ok('and not again the same week', await p.isHidden('#backup-bar'));
  await ctx.close();
}

console.log('offline cache');
{
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const missing = scripts.filter((s) => !sw.includes(`"${s}"`));
  ok(`every script the page loads is cached for offline${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`, !missing.length);
}

ok('pageerror = 0', pe === 0);
await b.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
