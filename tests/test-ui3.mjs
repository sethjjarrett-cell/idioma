/* The amber band, driven through the real page: a near miss must not be
   called wrong, must show where it went wrong, must leave the word where
   it was, and must let a second go put it right. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext();
const p = await ctx.newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });

/* A learner who has already met the bank. Written in rather than practised
   in: what these checks are about is answering cards, and a fresh bank now
   opens with introductions instead of questions. */
async function seedMetWords(page, level = 2) {
  await page.evaluate((level) => {
    const st = window.Idioma.state;
    for (const w of window.Idioma.Store.allWords(st)) {
      st.progress[w.id] = { ...window.Idioma.Engine.freshProgress(), level, timesSeen: 3,
        lastSeen: new Date(Date.now() - 864e5).toISOString() };
    }
    window.Idioma.Store.saveNow(st);
  }, level);
}

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);
await seedMetWords(p);
await p.click('#btn-start');
await p.waitForTimeout(250);

const card = () => p.evaluate(() => ({
  id: window.__card.word.id,
  answer: window.__card.accepted[0],
}));
const levelOf = (id) => p.evaluate((w) => window.Idioma.state.progress[w]?.level ?? 1, id);
const progOf = (id) => p.evaluate((w) => window.Idioma.state.progress[w], id);

// Find a card whose answer does not already start with an article, so that
// adding one is the only difference.
let c = await card();
for (let i = 0; i < 12 && /^(a|an|the)\s/i.test(c.answer); i++) {
  await p.fill('#answer', c.answer);
  await p.click('#btn-submit'); await p.waitForTimeout(60);
  await p.click('#btn-next'); await p.waitForTimeout(60);
  c = await card();
}
const levelBefore = await levelOf(c.id);
/* Seen before this card, not zero: a word met for the first time is shown and
   then asked straight away, so a card reached part way through a round has
   already been counted once or twice. What is under test is that three
   attempts at one card count as one, whatever the running total was. */
const seenBefore = (await progOf(c.id) || { timesSeen: 0 }).timesSeen;
console.log('card:', c.id, '| answer:', JSON.stringify(c.answer), '| level', levelBefore);

// --- the near miss --------------------------------------------------
await p.fill('#answer', 'a ' + c.answer);
await p.click('#btn-submit');
await p.waitForTimeout(150);

console.log('\n--- "a " in front of the answer ---');
console.log('verdict     :', (await p.textContent('#verdict-chip')).trim());
console.log('why         :', (await p.textContent('#verdict-detail')).trim());
console.log('card class  :', await p.getAttribute('#card', 'class'));
console.log('diff shown  :', await p.isVisible('#verdict-diff'));
console.log('diff html   :', (await p.innerHTML('#verdict-diff')).trim());
console.log('extra word struck out:', await p.locator('#verdict-diff .d-extra').count() === 1);
console.log('second go offered    :', await p.isVisible('#btn-retry'));
const afterAmber = await progOf(c.id);
console.log('level held  :', afterAmber.level === levelBefore, `(L${afterAmber.level})`);
console.log('not counted wrong    :', afterAmber.totalWrong === 0);
console.log('counted as a near miss:', afterAmber.totalAlmost === 1);

// --- a second go that is also not right must not make it worse -------
await p.click('#btn-retry'); await p.waitForTimeout(120);
console.log('\n--- a second go, still not right ---');
console.log('box reopened and empty:', await p.isEnabled('#answer') && (await p.inputValue('#answer')) === '');
await p.fill('#answer', 'complete nonsense');
await p.click('#btn-submit'); await p.waitForTimeout(150);
const afterBad = await progOf(c.id);
console.log('verdict     :', (await p.textContent('#verdict-chip')).trim(), '(must not be "Not quite")');
console.log('still held  :', afterBad.level === levelBefore, '| still not wrong:', afterBad.totalWrong === 0);

// --- and a second go that is right earns the level -------------------
await p.click('#btn-retry'); await p.waitForTimeout(120);
await p.fill('#answer', c.answer);
await p.click('#btn-submit'); await p.waitForTimeout(150);
const afterFix = await progOf(c.id);
console.log('\n--- fixed ---');
console.log('verdict     :', (await p.textContent('#verdict-chip')).trim());
console.log('levelled up :', afterFix.level === levelBefore + 1, `(L${afterFix.level})`);
console.log('counted once, not three times:',
  afterFix.timesSeen === seenBefore + 1, `(seen ${seenBefore} then ${afterFix.timesSeen})`);
console.log('near miss no longer on the card:', afterFix.totalAlmost === 0);
console.log('one correct answer recorded  :', afterFix.totalCorrect === 1);

// --- a plain misspelling ---------------------------------------------
await p.click('#btn-next'); await p.waitForTimeout(150);
const c2 = await card();
const mangled = c2.answer.length > 4
  ? c2.answer.slice(0, 2) + c2.answer.slice(3)      // drop one letter
  : c2.answer + 'x';
await p.fill('#answer', mangled);
await p.click('#btn-submit'); await p.waitForTimeout(150);
console.log('\n--- one letter out ---');
console.log('typed       :', JSON.stringify(mangled), 'for', JSON.stringify(c2.answer));
console.log('verdict     :', (await p.textContent('#verdict-chip')).trim());
console.log('why         :', (await p.textContent('#verdict-detail')).trim());
console.log('letters marked:', await p.locator('#verdict-diff mark').count() > 0
  || await p.locator('#verdict-diff .d-extra, #verdict-diff .d-missing').count() > 0);

console.log('\npageerror =', pe);
await b.close();
