/* One screen, on a phone.

   The measurement that matters is not whether the page is tidy but whether a
   thumb has to move before you can answer. Three mode buttons and a row of
   pills come to about three hundred pixels, which on a phone put the card and,
   in sentence mode, the Check button below the fold, so every single card
   needed a scroll before it could be answered.

   390 by 660 is an iPhone 13 in Safari with the browser's own chrome on
   screen, which is the smallest thing this has to work on. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 660 } })).newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);

const meet = (n) => p.evaluate((count) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: 5, timesSeen: 5,
      lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, n);

const setMode = async (m) => {
  await p.evaluate((mode) => { window.Idioma.state.settings.mode = mode;
    window.Idioma.Store.saveNow(window.Idioma.state); }, m);
  await p.reload();
  await p.waitForTimeout(400);
};

/* How far past the bottom of the window the page goes, and where the thing
   you have to press ends up. */
const fits = (sel) => p.evaluate((s) => {
  const el = document.querySelector(s);
  const r = el && el.offsetParent ? el.getBoundingClientRect() : null;
  return {
    page: document.documentElement.scrollHeight,
    view: window.innerHeight,
    bottom: r ? Math.round(r.bottom) : null,
  };
}, sel);

const answerWhateverIsThere = async () => {
  if (await p.evaluate(() => !!window.__card.intro)) {
    await p.click('#btn-got'); await p.waitForTimeout(250);
  }
  if (await p.evaluate(() => window.__card.band.key) === 'build') {
    const tray = await p.$$eval('#build-tray .tile', (ts) => ts.map((x) => x.textContent));
    for (const w of tray.slice(0, 2)) {
      await p.locator('#build-tray .tile').filter({ hasText: new RegExp(`^${w}$`) }).first().click();
    }
    await p.click('#btn-build-check');
  } else {
    await p.fill('#answer', 'definitely wrong');
    await p.click('#btn-submit');
  }
  await p.waitForTimeout(300);
};

await meet(200);

console.log('--- the card, without scrolling ---');
for (const mode of ['words', 'verbs', 'sentences']) {
  await setMode(mode);
  await p.click('#btn-start');
  await p.waitForTimeout(400);
  const card = await fits('#card');
  /* Whichever button this card is actually answered with. Picking by
     selector order rather than by what is on screen finds the hidden one
     first and reports null, and null <= 660 is true, so the check passes
     while measuring nothing. */
  const answerable = await p.evaluate(() => {
    for (const sel of ['#btn-build-check', '#btn-got', '#btn-submit']) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent) return Math.round(el.getBoundingClientRect().bottom);
    }
    return null;
  });
  console.log(`${mode.padEnd(10)} whole card on screen: ${card.bottom <= card.view}`
    + ` | the button you press ends at ${answerable}px of ${card.view}`
    + ` | ${card.page <= card.view ? 'no scrolling at all' : (card.page - card.view) + 'px below the fold'}`);
  console.log(`           card fits: ${card.bottom <= card.view}`);
  console.log(`           button reachable without scrolling: ${answerable !== null && answerable <= card.view}`);
  /* The one that matters, and the one the other two flatter: a rectangle is
     measured against the viewport after the browser has already scrolled to
     bring it into view, so "it fits" can be true on a page that had to be
     scrolled first. A page no taller than the window cannot have been. */
  console.log(`           the whole page is one screen: ${card.page <= card.view}`
    + ` (${card.page}px in ${card.view}px)`);
}

console.log('\n--- and after answering ---');
for (const mode of ['words', 'verbs', 'sentences']) {
  await setMode(mode);
  await p.click('#btn-start');
  await p.waitForTimeout(400);
  await answerWhateverIsThere();
  const next = await fits('#btn-next');
  console.log(`${mode.padEnd(10)} Next ends at ${next.bottom}px of ${next.view}px: ${next.bottom <= next.view}`);
}

console.log('\n--- the pickers fold, but are not gone ---');
await setMode('sentences');
console.log('before a round they are all there:',
  await p.isVisible('#modes') && await p.isVisible('#filters')
  && await p.isHidden('#picker-summary'));
await p.click('#btn-start');
await p.waitForTimeout(400);
console.log('once one is running they fold to a line:',
  await p.isHidden('#modes') && await p.isHidden('#filters')
  && await p.isVisible('#picker-summary'));
console.log('which says what you picked:',
  (await p.textContent('#picker-summary-text')).trim());
await p.click('#picker-summary');
await p.waitForTimeout(250);
console.log('tapping change brings them back:',
  await p.isVisible('#modes') && await p.isVisible('#filters'));
console.log('without throwing the round away:',
  await p.isVisible('#card') && await p.evaluate(() => !!window.Idioma.round));
await p.click('[data-mode="words"]');
await p.waitForTimeout(250);
console.log('but actually changing mode does end it:',
  await p.evaluate(() => window.Idioma.round === null));
console.log('and the pickers stay open, since that is the screen now:',
  await p.isVisible('#modes'));

console.log('\n--- the filter shows in the folded line when it is narrowing something ---');
await p.evaluate(() => { const st = window.Idioma.state;
  st.settings.mode = 'words'; st.settings.pos = 'noun';
  window.Idioma.Store.saveNow(st); });
await p.reload(); await p.waitForTimeout(400);
await p.click('#btn-start'); await p.waitForTimeout(400);
console.log('narrowed:', (await p.textContent('#picker-summary-text')).trim());
await p.evaluate(() => { const st = window.Idioma.state; st.settings.pos = 'all';
  window.Idioma.Store.saveNow(st); });
await p.reload(); await p.waitForTimeout(400);
await p.click('#btn-start'); await p.waitForTimeout(400);
console.log('and stays quiet when it is not:',
  (await p.textContent('#picker-summary-text')).trim() === 'Words');

console.log('\n--- the spent answer box gets out of the way ---');
await p.evaluate(() => { const st = window.Idioma.state; st.settings.mode = 'words';
  window.Idioma.Store.saveNow(st); });
await p.reload(); await p.waitForTimeout(400);
await p.click('#btn-start'); await p.waitForTimeout(400);
if (await p.evaluate(() => !!window.__card.intro)) { await p.click('#btn-got'); await p.waitForTimeout(250); }
const want = await p.evaluate(() => window.__card.accepted[0]);
const typo = want.length > 4 ? want.slice(0, 2) + want.slice(3) : want + 'x';
await p.fill('#answer', typo);
await p.click('#btn-submit');
await p.waitForTimeout(300);
console.log(`typed "${typo}" for "${want}":`, (await p.textContent('#verdict-chip')).trim());
console.log('the box and its button are out of the way:', await p.isHidden('#answer-form'));
console.log('what you typed is still on the card:',
  (await p.textContent('#verdict-detail')).length > 0
  || (await p.textContent('#verdict-diff')).length > 0);
await p.click('#btn-retry');
await p.waitForTimeout(250);
console.log('a second go puts it back, empty and usable:',
  await p.isVisible('#answer-form') && await p.isEnabled('#answer')
  && (await p.inputValue('#answer')) === '');
await p.fill('#answer', want);
await p.click('#btn-submit');
await p.waitForTimeout(300);
console.log('and fixing it still works:', (await p.textContent('#verdict-chip')).trim() === 'Correct');
await p.click('#btn-next');
await p.waitForTimeout(300);
console.log('the next card gets its box back:',
  await p.isVisible('#answer-form') || await p.isVisible('#teach') || await p.isVisible('#build'));

console.log('\n--- nothing sideways, either ---');
console.log('no horizontal scrolling:',
  await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

console.log('\npageerror =', pe);
await b.close();
process.exit(pe ? 1 : 0);
