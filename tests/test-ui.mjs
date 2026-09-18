import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext();
const p = await ctx.newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });
p.on('console', m => { if (m.type() === 'error') console.log('  !! CONSOLE:', m.text().slice(0,140)); });

// Opened straight from disk, which is how the brief says it should work.
// A learner who has already met a chunk of the bank. Written in rather than
// practised in, because what these checks are about is answering cards, and a
// fresh bank now opens with introductions instead.
async function seedMetWords(page, howMany = 40, level = 2) {
  await page.evaluate(({ howMany, level }) => {
    const st = window.Idioma.state;
    for (const w of window.Idioma.Store.allWords(st).slice(0, howMany)) {
      st.progress[w.id] = { ...window.Idioma.Engine.freshProgress(), level, timesSeen: 3,
        lastSeen: new Date(Date.now() - 864e5).toISOString() };
    }
    window.Idioma.Store.saveNow(st);
  }, { howMany, level });
}

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);
console.log('opens on file:// :', await p.title());
console.log('tabs:', await p.$$eval('.tab', ns => ns.map(n => n.textContent.trim())).catch(() => 'none'));
console.log('start blurb:', (await p.textContent('#start-blurb')).trim());

// --- a full round ---
await seedMetWords(p);
await p.click('#btn-start');
await p.waitForTimeout(250);
let seen = [], bands = new Set();
for (let i = 0; i < 15; i++) {
  const band = (await p.textContent('#card-band')).trim();
  const prompt = (await p.textContent('#card-prompt')).trim();
  bands.add(band.split(' (')[0]);
  seen.push(prompt);
  // Answer the first three right by reading the expected answer out of the
  // page's own state, and the rest wrong, so both paths get exercised.
  if (i < 3) {
    const ans = await p.evaluate(() => window.__card.accepted[0]);
    await p.fill('#answer', ans);
  } else {
    await p.fill('#answer', 'definitely not the answer');
  }
  await p.click('#btn-submit');
  await p.waitForTimeout(80);
  if (i === 0) {
    console.log('\nfirst card band:', band);
    console.log('verdict:', (await p.textContent('#verdict-chip')).trim(),
                '| answer shown:', (await p.textContent('#verdict-answer')).trim());
    /* Shown when the word has one, hidden when it does not. Asserting it is
       always shown depends on which word the draw happened to produce, and
       about one word in ten carries no note. */
    const hasNote = await p.evaluate(() => !!(window.__card.word && window.__card.word.note));
    console.log('note shown exactly when the word has one:',
      hasNote === !(await p.locator('#verdict-note').isHidden()),
      hasNote ? '(this one has a note)' : '(this one has none)');
  }
  await p.click('#btn-next');
  await p.waitForTimeout(60);
}
await p.waitForTimeout(200);
console.log('\nround ended:', !(await p.locator('#round-end').isHidden()));
console.log('summary:', (await p.textContent('#end-stats')).replace(/\s+/g,' ').trim());
console.log('distinct prompts in round:', new Set(seen).size, 'of', seen.length);

// --- persistence across a reload ---
const before = await p.evaluate(() => JSON.stringify(Object.keys(window.Idioma.state.progress).length));
await p.reload(); await p.waitForTimeout(400);
const after = await p.evaluate(() => JSON.stringify(Object.keys(window.Idioma.state.progress).length));
console.log('progress survives reload:', before === after, `(${before} words)`);

// --- manage screen ---
await p.click('.tab[data-screen="manage"]'); await p.waitForTimeout(300);
console.log('\nbank rows rendered:', await p.locator('#bank-body tr').count());
await p.click('.pill[data-filter="nosentence"]'); await p.waitForTimeout(200);
console.log('cloze-without-sentence filter rows:', await p.locator('#bank-body tr').count());
await p.click('.pill[data-filter="all"]'); await p.waitForTimeout(200);

await p.fill('#nw-es', 'la chévere'); await p.fill('#nw-en', 'cool, great');
await p.fill('#nw-note', 'Colombian; very common as an exclamation.');
await p.click('#add-word button[type=submit]'); await p.waitForTimeout(300);
console.log('word added:', await p.evaluate(() => window.Idioma.state.customWords.length) === 1);
await p.fill('#filter', 'chevere'); await p.waitForTimeout(200);
console.log('new word findable by unaccented filter:', await p.locator('#bank-body tr').count() === 1);
await p.fill('#filter', ''); await p.waitForTimeout(150);

// --- progress screen ---
await p.click('.tab[data-screen="progress"]'); await p.waitForTimeout(300);
console.log('\nband bars:', (await p.textContent('#band-bars')).replace(/\s+/g,' ').trim().slice(0,110));
console.log('totals:', (await p.textContent('#progress-stats')).replace(/\s+/g,' ').trim().slice(0,130));

console.log('\npageerror =', pe);
await b.close();
