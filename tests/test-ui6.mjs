/* Sync, end to end, against a real server: two browser contexts standing in
   for a phone and a laptop, a stand-in for the Cloudflare Worker that
   implements the same two routes, and the failure paths that matter more than
   the happy one. */
import { chromium } from 'playwright';
import http from 'http';

/* The same contract as tools/sync/worker.js: GET and PUT on /v1/{code}, a
   revision to spot a clash. Kept in memory so the test owns its own state. */
const store = new Map();
let faults = { offline: false, status: 0 };
const server = http.createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-allow-headers': 'content-type' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, {});
  if (faults.offline) { req.destroy(); return; }
  if (faults.status) return send(faults.status, { error: 'forced' });
  const m = req.url.match(/^\/v1\/([0-9a-z]{20,64})$/);
  if (!m) return send(404, { error: 'not found' });
  const key = m[1];
  if (req.method === 'GET') return send(200, store.get(key) || { rev: 0, state: null });
  if (req.method === 'PUT') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      const cur = store.get(key);
      const rev = cur ? cur.rev : 0;
      if (typeof body.rev === 'number' && body.rev !== rev) {
        return send(409, { error: 'conflict', rev, state: cur ? cur.state : null });
      }
      const next = { rev: rev + 1, updatedAt: new Date().toISOString(), state: body.state };
      store.set(key, next);
      send(200, { rev: next.rev });
    });
    return;
  }
  send(405, { error: 'method' });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_BASE = `http://127.0.0.1:${server.address().port}`;
console.log('stand-in server on', URL_BASE);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function device(name) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log(`  !! PAGEERROR (${name}):`, e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(400);
  return p;
}
const setUp = async (p, code) => {
  await p.evaluate(({ url, code }) => {
    window.localStorage.setItem('idioma.sync.v1',
      JSON.stringify({ url, code, rev: 0, lastSyncedAt: null, lastError: null }));
  }, { url: URL_BASE, code });
  await p.reload();
  await p.waitForTimeout(500);
};
const syncNow = async (p) => {
  await p.click('#btn-menu'); await p.waitForTimeout(150);
  await p.click('#btn-sync-now'); await p.waitForTimeout(600);
  const s = (await p.textContent('#sync-state')).trim();
  await p.click('#btn-menu');
  return s;
};
const levelOf = (p, id) => p.evaluate((w) => window.Idioma.state.progress[w]?.level ?? null, id);
const setLevel = (p, id, level, when) => p.evaluate(({ w, level, when }) => {
  const st = window.Idioma.state;
  st.progress[w] = { ...window.Idioma.Engine.freshProgress(), level, timesSeen: 5, lastSeen: when };
  window.Idioma.Store.saveNow(st);
}, { w: id, level, when });

const CODE = 'bcdfghjkmnpqrstvwxyz00';

console.log('\n--- the panel with nothing set up ---');
const phone = await device('phone');
await phone.click('#btn-menu'); await phone.waitForTimeout(200);
console.log('panel shown        :', await phone.isVisible('.sync'));
console.log('state says         :', (await phone.textContent('#sync-state')).trim());
await phone.click('#btn-sync-now'); await phone.waitForTimeout(300);
console.log('sync now with no url is refused, not a crash:',
  (await phone.textContent('#toast')).includes('Set a sync URL'));
await phone.click('#btn-menu');

console.log('\n--- a code is generated, not typed ---');
await phone.click('#btn-menu'); await phone.waitForTimeout(150);
await phone.fill('#sync-url', URL_BASE);
await phone.dispatchEvent('#sync-url', 'change');
await phone.click('#btn-sync-new'); await phone.waitForTimeout(250);
const made = await phone.inputValue('#sync-code');
console.log('code made          :', made, `(${made.length} chars)`);
console.log('no vowels in it    :', !/[aeiou]/i.test(made));
await phone.click('#btn-menu');

console.log('\n--- phone practises, then syncs up ---');
await setUp(phone, CODE);
await setLevel(phone, 'mesa', 6, '2026-09-17T10:00:00.000Z');
console.log('after sync         :', await syncNow(phone));
console.log('server now holds a state:', !!store.get(CODE)?.state);
console.log('server rev         :', store.get(CODE)?.rev);

console.log('\n--- laptop, which has never seen this word ---');
const laptop = await device('laptop');
console.log('knows nothing yet  :', await levelOf(laptop, 'mesa'), '(want null)');
await setUp(laptop, CODE);
// setUp reloads, and a reload syncs on its own: nothing was pressed here.
console.log('after a reload, without pressing anything, mesa is at L:',
  await levelOf(laptop, 'mesa'), '(want 6, which proves sync on load)');
console.log('and pressing it says:', await syncNow(laptop));

console.log('\n--- laptop practises it further, phone catches up ---');
await setLevel(laptop, 'mesa', 8, '2026-09-17T12:00:00.000Z');
await syncNow(laptop);
await syncNow(phone);
console.log('phone now has mesa at L:', await levelOf(phone, 'mesa'), '(want 8)');

console.log('\n--- a word that went down must not be pulled back up ---');
await setLevel(phone, 'mesa', 3, '2026-09-17T14:00:00.000Z');
await syncNow(phone);
await syncNow(laptop);
console.log('laptop took the drop:', await levelOf(laptop, 'mesa'), '(want 3, not 8)');

console.log('\n--- a word added on the laptop reaches the phone ---');
await laptop.click('.tab[data-screen="manage"]'); await laptop.waitForTimeout(300);
await laptop.fill('#nw-es', 'chévere');
await laptop.fill('#nw-en', 'cool, great');
await laptop.click('#add-word button[type="submit"]'); await laptop.waitForTimeout(300);
await syncNow(laptop);
await syncNow(phone);
console.log('phone has it now   :',
  await phone.evaluate(() => window.Idioma.Store.allWords(window.Idioma.state).some((w) => w.es === 'chévere')));

console.log('\n--- with the server unreachable ---');
faults.offline = true;
const offlineState = await syncNow(phone);
console.log('menu says          :', offlineState.slice(0, 60));
console.log('and says it plainly, not "Failed to fetch":',
  offlineState.includes('could not reach'));
console.log('app still works    :', await phone.isVisible('#btn-start'));
await phone.click('#btn-start'); await phone.waitForTimeout(300);
console.log('a round still starts:', await phone.isVisible('#card'));
console.log('progress still saves:', await phone.evaluate(() => {
  const st = window.Idioma.state;
  return window.Idioma.Store.saveNow(st) !== false;
}));
faults.offline = false;

console.log('\n--- with the server erroring ---');
faults.status = 500;
console.log('menu says          :', (await syncNow(phone)).slice(0, 60));
faults.status = 0;
console.log('and it recovers    :', (await syncNow(phone)).startsWith('Synced'));

console.log('\n--- two devices writing at once ---');
// Both read the same revision, then both write: the second must not clobber.
await setLevel(phone, 'agua', 5, '2026-09-17T15:00:00.000Z');
await setLevel(laptop, 'pan', 7, '2026-09-17T15:00:00.000Z');
await Promise.all([syncNow(phone), syncNow(laptop)]);
await syncNow(phone); await syncNow(laptop);
const srv = store.get(CODE).state;
console.log('server kept both words:',
  srv.progress.agua?.level === 5 && srv.progress.pan?.level === 7,
  `(agua ${srv.progress.agua?.level}, pan ${srv.progress.pan?.level})`);

console.log('\n--- turning it off ---');
await phone.click('#btn-menu'); await phone.waitForTimeout(150);
phone.once('dialog', (d) => d.accept());
await phone.click('#btn-sync-off'); await phone.waitForTimeout(300);
console.log('state says         :', (await phone.textContent('#sync-state')).trim());
console.log('progress kept      :', await levelOf(phone, 'mesa'), '(not null)');

console.log('\n--- pairing the second device with a link ---');
/* The step that decides whether anyone actually sets this up: getting the
   endpoint and the code onto the phone without typing twenty-two characters
   of base32 into a phone keyboard. */
const desk = await device('desk');
await setUp(desk, 'bcdfghjkmnpqrstvwxyz11');
await desk.evaluate(() => {
  const st = window.Idioma.state;
  st.progress['mesa'] = { ...window.Idioma.Engine.freshProgress(), level: 7,
    timesSeen: 9, totalCorrect: 9, lastSeen: new Date().toISOString() };
  window.Idioma.Store.saveNow(st);
});
console.log('desk synced      :', await syncNow(desk));
const link = await desk.evaluate(() =>
  window.Sync.pairingLink(window.Sync.loadConfig(), location.href));
console.log('link made        :', /#sync=/.test(link));
console.log('code not in the clear:', !link.includes('bcdfghjkmnpqrstvwxyz11'));

const fresh = await b.newContext();
const phone2 = await fresh.newPage();
phone2.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR (phone2):', e.message); });
await phone2.goto(link);
await phone2.waitForTimeout(900);
console.log('it says it paired :', (await phone2.textContent('#toast')).includes('Paired'));
console.log('the code is out of the address bar:', !phone2.url().includes('#sync='));
const got = await phone2.evaluate(() => window.Sync.loadConfig());
console.log('endpoint carried  :', got.url === URL_BASE);
console.log('code carried      :', got.code === 'bcdfghjkmnpqrstvwxyz11');
console.log('and the progress came with it:',
  await phone2.evaluate(() => window.Idioma.state.progress.mesa?.level) === 7);
await phone2.reload();
await phone2.waitForTimeout(600);
console.log('pairing sticks across a reload:',
  (await phone2.evaluate(() => window.Sync.loadConfig())).code === 'bcdfghjkmnpqrstvwxyz11');

console.log('\npageerror =', pe);
await b.close();
server.close();
