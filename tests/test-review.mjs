/* Going over mistakes, the words you keep missing, and "I know this".

   Three things a learner asked for:
   - at the end of a round, a second look at what went wrong;
   - a way to work through the words that keep going wrong;
   - a button for a word you already know, so getting it right moves it on a
     whole stage instead of one level.

   The part worth being strict about is what each one is allowed to change. A
   second look changes nothing, because the answer was on screen a minute ago.
   Sticking points are real rounds. "I know this" only ever helps when the
   answer is right, and costs nothing extra when it is not. */
import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page() {
  const c = await b.newContext({ viewport: { width: 390, height: 760 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  return { c, p };
}
const card = (p) => p.evaluate(() => window.__card);
const level = (p, id) => p.evaluate((w) => window.Idioma.state.progress[w].level, id);
const seed = (p, n, lv, extra = {}) => p.evaluate(([count, l, x]) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: l, timesSeen: 6,
      lastSeen: new Date(Date.now() - 30 * 864e5).toISOString(), ...x };
  }
  window.Idioma.Store.saveNow(st);
}, [n, lv, extra]);
const answer = async (p, text) => { await p.fill('#answer', text); await p.click('#btn-submit'); await p.waitForTimeout(80); };
async function untilBand(p, key) {
  for (let i = 0; i < 40; i++) {
    const c = await card(p);
    if (c && c.band.key === key && await p.isHidden('#verdict')) return c;
    if (await p.isVisible('#btn-again')) await p.click('#btn-again');
    else if (c.intro) await p.click('#btn-got');
    else { if (await p.isHidden('#verdict')) await answer(p, 'zzz'); await p.click('#btn-next'); }
    await p.waitForTimeout(60);
  }
  return null;
}

console.log('where "I know this" sends a word');
{
  const { c, p } = await page();
  const j = await p.evaluate(() => [1, 3, 4, 7, 8, 9, 14, 15].map((l) => window.Idioma.Engine.jumpAhead(l)));
  ok('recognition jumps to the start of production', j[0] === 4 && j[1] === 4);
  ok('production to the start of cloze', j[2] === 8 && j[3] === 8);
  ok('in cloze, two levels on, never past the ceiling', j[4] === 10 && j[5] === 11 && j[6] === 15 && j[7] === 15, JSON.stringify(j));
  await c.close();
}

console.log('on a card');
{
  const { c, p } = await page();
  await seed(p, 60, 2);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(150);
  let k = await untilBand(p, 'recognition');
  ok('a recognition card offers I know this', await p.isVisible('#btn-sure')
    && (await p.textContent('#btn-sure')) === 'I know this');
  await p.focus('#answer');
  await p.click('#btn-sure');
  ok('pressed, it says what it will do', await p.getAttribute('#btn-sure', 'aria-pressed') === 'true'
    && /jump ahead/.test(await p.textContent('#btn-sure')));
  ok('and the keyboard stays up', await p.evaluate(() => document.activeElement.id === 'answer'));
  await answer(p, k.accepted[0]);
  ok('right: the word jumps to production', await level(p, k.word.id) === 4, String(await level(p, k.word.id)));
  ok('and the verdict says so', /jumped ahead/.test(await p.textContent('#verdict-detail')));
  ok('the switch is gone once answered', await p.isHidden('#btn-sure'));
  await p.click('#btn-next'); await p.waitForTimeout(80);

  k = await untilBand(p, 'recognition');
  await p.click('#btn-sure');
  await answer(p, 'definitely not');
  ok('wrong: it drops one level, as it would have anyway', await level(p, k.word.id) === 1);
  ok('and says there was no jump', /no jump/.test(await p.textContent('#verdict-detail')));
  await p.click('#btn-next'); await p.waitForTimeout(80);

  k = await untilBand(p, 'recognition');
  ok('the next card starts with the switch off', await p.getAttribute('#btn-sure', 'aria-pressed') === 'false');
  await answer(p, k.accepted[0]);
  ok('and without it a right answer is one level, as before', await level(p, k.word.id) === 3);
  await c.close();
}
{
  const { c, p } = await page();
  await seed(p, 60, 5);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(150);
  const k = await untilBand(p, 'production');
  await p.click('#btn-sure');
  await answer(p, k.accepted[0]);
  ok('a production word answered right jumps to cloze', await level(p, k.word.id) === 8);
  await c.close();
}

console.log('a new word you already know');
{
  const { c, p } = await page();
  await p.click('#btn-start'); await p.waitForTimeout(150);
  const intro = await card(p);
  ok('the teaching card has I know this beside Got it', intro.intro && await p.isVisible('#btn-know'));
  await p.click('#btn-know'); await p.waitForTimeout(80);
  const k = await card(p);
  ok('it is asked straight away, already switched on', k.word.id === intro.word.id && !k.intro
    && await p.getAttribute('#btn-sure', 'aria-pressed') === 'true');
  await answer(p, k.accepted[0]);
  ok('and right, it jumps past recognition', await level(p, k.word.id) === 4, String(await level(p, k.word.id)));
  await c.close();
}

console.log('a second look at what went wrong');
{
  const { c, p } = await page();
  await seed(p, 60, 2);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(150);
  // Everything wrong, the teaching cards just read.
  for (let i = 0; i < 40 && await p.isHidden('#round-end'); i++) {
    const k = await card(p);
    if (k.intro) await p.click('#btn-got');
    else { await answer(p, 'zzz'); await p.click('#btn-next'); }
    await p.waitForTimeout(50);
  }
  const missed = await p.evaluate(() => {
    const r = window.Idioma.round;
    return new Set(r.queue.filter((q, i) => r.results[i] && r.results[i].outcome === 'wrong').map((q) => q.id)).size;
  });
  ok(`the end of the round offers them (${missed})`, await p.isVisible('#btn-review')
    && (await p.textContent('#btn-review')) === `Go over the ${missed} you missed`);
  const before = await p.evaluate(() => JSON.stringify([window.Idioma.state.progress, window.Idioma.state.stats]));
  await p.click('#btn-review'); await p.waitForTimeout(100);
  ok('a second look asks exactly those, each once', await p.evaluate(() => window.Idioma.round.queue.length) === missed
    && await p.evaluate(() => window.Idioma.round.review === true));
  ok('labelled as such', /second look/.test(await p.textContent('#card-band')));
  ok('with no I know this, and no teaching card', await p.isHidden('#btn-sure') && !(await card(p)).intro);
  const first = await card(p);
  await answer(p, first.accepted[0]);
  ok('right or wrong, nothing moves', (await p.textContent('#verdict-chip')) === 'Correct'
    && await p.evaluate(() => JSON.stringify([window.Idioma.state.progress, window.Idioma.state.stats])) === before);
  for (let i = 0; i < 30 && await p.isHidden('#round-end'); i++) {
    await p.click('#btn-next'); await p.waitForTimeout(50);
    if (await p.isVisible('#answer')) await answer(p, 'zzz');
  }
  ok('it ends saying it was practice', /second look is practice/.test(await p.textContent('#end-movers')));
  ok('and offers another go at what is still wrong', (await p.textContent('#btn-review')) === `Go over the ${missed - 1} you missed`);
  ok('still without a word having moved', await p.evaluate(() => JSON.stringify([window.Idioma.state.progress, window.Idioma.state.stats])) === before);
  await c.close();
}

console.log('a second look at grammar');
{
  const { c, p } = await page();
  await p.click('#modes [data-mode="grammar"]');
  await p.click('#btn-start'); await p.waitForTimeout(100);
  for (let i = 0; i < 12 && await p.isHidden('#round-end'); i++) {
    const k = await card(p);
    await p.click(`#choices [data-choice="${k.options.find((o) => o !== k.answer)}"]`);
    await p.click('#btn-next'); await p.waitForTimeout(40);
  }
  ok('grammar offers its misses too', /Go over the 10 you missed/.test(await p.textContent('#btn-review')));
  const record = await p.evaluate(() => JSON.stringify(window.Idioma.state.grammar));
  await p.click('#btn-review'); await p.waitForTimeout(80);
  const k = await card(p);
  await p.click(`#choices [data-choice="${k.answer}"]`);
  ok('and a right answer on the second look does not clear the weak spot', await p.evaluate(() =>
    JSON.stringify(window.Idioma.state.grammar)) === record);
  await c.close();
}

console.log('words you keep missing');
{
  const { c, p } = await page();
  await seed(p, 30, 2);
  await p.evaluate(() => {
    const st = window.Idioma.state;
    for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 4)) {
      st.progress[id].lapses = 3;
    }
    window.Idioma.Store.saveNow(st);
  });
  await p.reload(); await p.waitForTimeout(300);
  ok('the start screen offers them', await p.isVisible('#btn-sticking-start')
    && (await p.textContent('#btn-sticking-start')) === 'Words you keep missing (4)');
  await p.click('#btn-sticking-start'); await p.waitForTimeout(100);
  const ids = await p.evaluate(() => window.Idioma.round.queue.map((q) => q.id));
  const want = await p.evaluate(() => window.TeachingOrder.TEACHING_ORDER.slice(0, 4));
  ok('a round of just those', ids.length === 4 && ids.every((id) => want.includes(id)));
  const k = await card(p);
  const lv = await level(p, k.word.id);
  if (k.intro) { await p.click('#btn-got'); await p.waitForTimeout(60); }
  const asked = await card(p);
  await answer(p, asked.accepted[0]);
  ok('and it counts: a right answer moves the word', await level(p, asked.word.id) !== lv
    || /L\d to L\d|holding/.test(await p.textContent('#verdict-detail')));
  await c.close();
}

console.log('where it does not belong');
{
  const { c, p } = await page();
  await p.click('#modes [data-mode="verbs"]');
  await p.click('#btn-start'); await p.waitForTimeout(100);
  ok('no I know this on a verb drill', await p.isHidden('#btn-sure'));
  ok('and no sticking button in other modes', await p.evaluate(() => {
    window.Idioma.state.settings.mode = 'verbs'; return true;
  }) && await p.isHidden('#btn-sticking-start'));
  await c.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
