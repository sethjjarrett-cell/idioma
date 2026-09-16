import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ acceptDownloads: true });
const p = await ctx.newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });
await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(300);

// Force one word with a sentence up to L8 so a real cloze card appears.
await p.evaluate(() => {
  const s = window.Idioma.state;
  s.progress['comer'] = { ...window.Engine.freshProgress(), level: 9, timesSeen: 9, totalCorrect: 9 };
  // park everything else so the round can only draw comer
  for (const w of window.Idioma.Store.allWords(s)) {
    if (w.id !== 'comer') s.progress[w.id] = { ...window.Engine.freshProgress(), enabled: false };
  }
  window.Idioma.Store.saveNow(s);
});
await p.reload(); await p.waitForTimeout(300);
await p.click('#btn-start'); await p.waitForTimeout(250);
console.log('--- cloze card ---');
console.log('band :', (await p.textContent('#card-band')).trim());
console.log('level:', (await p.textContent('#card-level')).trim());
console.log('prompt:', (await p.textContent('#card-prompt')).trim());
console.log('hint  :', (await p.textContent('#card-hint')).trim());
console.log('blank rendered:', await p.locator('#card-prompt .blank').count() === 1);

// answer it wrong, then use the override
await p.fill('#answer', 'nonsense'); await p.click('#btn-submit'); await p.waitForTimeout(150);
const lvlAfterWrong = await p.evaluate(() => window.Idioma.state.progress.comer.level);
const wrongAfter = await p.evaluate(() => window.Idioma.state.progress.comer.totalWrong);
console.log('\n--- override ---');
console.log('after wrong: level', lvlAfterWrong, 'totalWrong', wrongAfter);
console.log('override offered:', !(await p.locator('#btn-override').isHidden()));
console.log('accented answer shown:', (await p.textContent('#verdict-answer')).trim());
await p.click('#btn-override'); await p.waitForTimeout(200);
const after = await p.evaluate(() => {
  const x = window.Idioma.state.progress.comer;
  return { level: x.level, totalWrong: x.totalWrong, totalCorrect: x.totalCorrect, timesSeen: x.timesSeen };
});
console.log('after override:', JSON.stringify(after), '-> wrong count returned to 0:', after.totalWrong === 0);

// --- export / import round trip ---
console.log('\n--- backup round trip ---');
await p.click('#btn-menu'); await p.waitForTimeout(150);
const dl = await Promise.all([p.waitForEvent('download'), p.click('#btn-export')]).then(r => r[0]);
const path = '/tmp/claude-0/-home-user-PVHub/6e692316-ca7f-5627-b1f9-959b09a3df82/scratchpad/backup.json';
await dl.saveAs(path);
const { readFileSync } = await import('fs');
const saved = JSON.parse(readFileSync(path, 'utf8'));
console.log('export file valid JSON, keys:', Object.keys(saved).join(','));
console.log('comer level in file:', saved.progress.comer.level);
await p.evaluate(() => { window.Idioma.state.progress = {}; window.Idioma.Store.saveNow(window.Idioma.state); });
await p.reload(); await p.waitForTimeout(300);
await p.click('#btn-menu'); await p.waitForTimeout(150);
await p.setInputFiles('#file-import', path); await p.waitForTimeout(400);
console.log('after import, comer level restored:',
  await p.evaluate(() => window.Idioma.state.progress.comer?.level));
// a junk file must be refused with a readable message
await p.setInputFiles('#file-import', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
await p.waitForTimeout(300);
console.log('junk file refused:', (await p.textContent('#toast')).trim());
await ctx.close();

// --- mobile ---
const m = await b.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true });
const mp = await m.newPage();
let mpe = 0; mp.on('pageerror', e => { mpe++; console.log('  !! MOBILE PAGEERROR:', e.message); });
await mp.goto('file:///home/user/idioma/index.html'); await mp.waitForTimeout(400);
const overflow = () => mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('\n--- mobile (iPhone 13) ---');
console.log('overflow on practice:', await overflow());
await mp.click('#btn-start'); await mp.waitForTimeout(250);
console.log('card visible:', !(await mp.locator('#card').isHidden()));
console.log('input font size:', await mp.evaluate(() => getComputedStyle(document.getElementById('answer')).fontSize));
for (const t of ['manage','progress']) {
  await mp.click(`.tab[data-screen="${t}"]`); await mp.waitForTimeout(400);
  console.log(`overflow on ${t}:`, await overflow());
}
console.log('mobile pageerror =', mpe);
console.log('\ndesktop pageerror =', pe);
await b.close();
