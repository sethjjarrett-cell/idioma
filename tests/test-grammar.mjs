/* Grammar lessons and drills.

   First the content, which is where a mistake would actually teach someone
   something wrong: every question has exactly one gap, its answer among its
   options, a reason, and English. Then the page: a round is drawn from the
   right topic, a choice is marked with its reason, nothing is written to
   saved progress, and a state saved before there was any grammar loads and
   drills without complaint. */
import { readFileSync } from 'fs';
import vm from 'vm';
import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

console.log('the content');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../grammar.js', import.meta.url), 'utf8'), ctx);
const G = ctx.window.GRAMMAR;
const items = G.lessons.flatMap((l) => l.items.map((it) => ({ ...it, lesson: l.id })));
ok(`${G.lessons.length} lessons, ${items.length} questions`, G.lessons.length >= 12 && items.length >= 100);
ok('lesson ids are unique', new Set(G.lessons.map((l) => l.id)).size === G.lessons.length);
ok('every lesson has a title, a short name, a blurb, an explanation and examples',
  G.lessons.every((l) => l.title && l.short && l.blurb && l.explain.length && l.examples.length));
ok('every lesson has a drill of at least six questions', G.lessons.every((l) => l.items.length >= 6),
  G.lessons.filter((l) => l.items.length < 6).map((l) => l.id).join(','));
const gaps = items.filter((it) => (it.es.match(/___/g) || []).length !== 1);
ok('every question has exactly one gap', !gaps.length, gaps.map((g) => g.es).join(' | '));
const lost = items.filter((it) => !it.options.includes(it.answer));
ok('every answer is one of its options', !lost.length, lost.map((g) => g.es).join(' | '));
const counts = items.filter((it) => it.options.length < 2 || it.options.length > 4
  || new Set(it.options).size !== it.options.length);
ok('two to four options, none repeated', !counts.length, counts.map((g) => g.es).join(' | '));
ok('every question has English and a reason', items.every((it) => it.en && it.why));
// Letter-aware edges: a plain \b treats ñ as a gap, and finds "os" in años.
const vos = /(?<!\p{L})(vosotros|vosotras|os)(?!\p{L})|\p{L}+áis(?!\p{L})|(?<!dieci)\p{L}*[^c]éis(?!\p{L})/iu;
const spain = items.filter((it) => it.options.concat(it.es).some((t) => vos.test(t))
  && !/vosotros form/.test(it.why));
ok('no vosotros anywhere, except where a reason names it as Spain-only', !spain.length,
  spain.map((g) => g.es).join(' | '));
ok('no question gives its answer away in the English', items.every((it) =>
  it.answer === '—' || !new RegExp(`\\b${it.answer}\\b`, 'i').test(it.en) || it.answer.length < 3));
ok('every lesson has its classic mistake, wrong then right', G.lessons.every((l) =>
  Array.isArray(l.mistake) && l.mistake.length === 3 && l.mistake[0] !== l.mistake[1]));

console.log('the page');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page(viewport = { width: 390, height: 760 }) {
  const c = await b.newContext({ viewport });
  const p = await c.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  return { c, p };
}
const card = (p) => p.evaluate(() => window.__card);

{
  const { c, p } = await page();
  ok('Grammar is one of the modes', await p.isVisible('#modes [data-mode="grammar"]'));
  await p.click('#modes [data-mode="grammar"]');
  ok('with a pill per topic, and Mixed', /Mixed/.test(await p.textContent('#filter-pills')));
  ok('and a blurb for the mix', /A mix of all/.test(await p.textContent('#start-blurb')));
  const book = () => p.evaluate(() => JSON.stringify([window.Idioma.state.progress,
    window.Idioma.state.phrases, window.Idioma.state.stats]));
  const before = await book();
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const lessons = await p.evaluate(() => new Set(window.Idioma.round.queue.map((q) => q.lesson.id)).size);
  ok(`a mixed round spreads across topics (${lessons} in ten questions)`, lessons >= 8);

  let k = await card(p);
  ok('the card is a gap to fill', k.grammar && /___/.test(k.prompt));
  ok('with the options as buttons, and no box to type in',
    await p.isVisible('#choices') && await p.isHidden('#answer-form')
    && (await p.$$('#choices .choice')).length === k.options.length);
  ok('the English is the hint', (await p.textContent('#card-hint')) === k.promptHint);
  ok('the gap is drawn as a blank', await p.$('#card-prompt .blank') !== null);
  await p.click(`#choices [data-choice="${k.answer}"]`);
  ok('the right one is Correct', (await p.textContent('#verdict-chip')) === 'Correct');
  ok('with the reason', (await p.textContent('#verdict-note')) === k.word.note && k.word.note.length > 5);
  ok('and the whole sentence, every word tappable', (await p.$$('#verdict-answer .tap')).length > 1
    && !(await p.textContent('#verdict-answer')).includes('___'));
  ok('no I was right, since nothing is scored', await p.isHidden('#btn-override'));

  await p.click('#btn-next'); await p.waitForTimeout(100);
  k = await card(p);
  const wrong = k.options.find((o) => o !== k.answer);
  await p.click(`#choices [data-choice="${wrong}"]`);
  ok('a wrong one is Not quite', (await p.textContent('#verdict-chip')) === 'Not quite');
  ok('and says what was chosen', /you chose/.test(await p.textContent('#verdict-detail')));
  ok('and still gives the reason and the right sentence', (await p.textContent('#verdict-note')).length > 5);

  await p.click('#btn-next'); await p.waitForTimeout(100);
  k = await card(p);
  const shown = await p.$$eval('#choices .choice', (els) => els.map((e) => e.dataset.choice));
  await p.keyboard.press('1');
  await p.waitForTimeout(100);
  ok('on a keyboard, 1 picks the first option', await p.isVisible('#verdict')
    && (await p.textContent('#verdict-chip')) === (shown[0] === k.answer ? 'Correct' : 'Not quite'));

  for (let i = 0; i < 12 && await p.isVisible('#btn-next'); i++) {
    await p.click('#btn-next'); await p.waitForTimeout(80);
    if (await p.isVisible('#choices')) await p.click('#choices .choice >> nth=0');
  }
  ok('the round ends as a drill', await p.isVisible('#round-end')
    && /practice, not assessment/.test(await p.textContent('#end-movers')));
  ok('and no level, sentence or round count moved', await book() === before);
  await c.close();
}

console.log('the lessons');
{
  const { c, p } = await page();
  await p.click('[data-screen="lessons"]');
  ok(`every lesson is on the Lessons screen`, (await p.$$('#grammar-lessons details')).length === G.lessons.length);
  const first = p.locator('#grammar-lessons details').nth(5);
  await first.locator('summary').click();
  ok('a lesson opens to its explanation, examples and mistake',
    await first.locator('.lesson-body p').first().isVisible() && await first.locator('.mistake').isVisible());
  ok('its examples can be tapped for meaning', await first.locator('.examples .tap').count() > 3);
  const id = await first.getAttribute('data-grammar');
  await first.locator('[data-act="grammar"]').click();
  await p.waitForTimeout(200);
  ok('Practise this starts a round of that topic only', await p.evaluate((want) =>
    window.Idioma.round.queue.every((q) => q.lesson.id === want), id));
  ok('on the practice screen, with the topic named', await p.isVisible('#card')
    && (await p.textContent('#picker-summary-text')).includes(G.lessons.find((l) => l.id === id).title));
  ok('and the topic is remembered', await p.evaluate(() => window.Idioma.state.settings.grammar) === id);
  await c.close();
}

console.log('a state saved before there was any grammar');
{
  const { c, p } = await page();
  await p.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('idioma.state.v1') || 'null') || window.Idioma.state;
    delete st.settings.grammar;
    st.settings.mode = 'grammar';
    localStorage.setItem('idioma.state.v1', JSON.stringify(st));
  });
  await p.reload(); await p.waitForTimeout(300);
  ok('loads on Mixed', /A mix of all/.test(await p.textContent('#start-blurb')));
  await p.click('#btn-start'); await p.waitForTimeout(150);
  ok('and drills', await p.isVisible('#choices'));
  await c.close();
}

console.log('on a phone');
{
  const { c, p } = await page({ width: 390, height: 660 });
  await p.click('#modes [data-mode="grammar"]');
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const bottom = await p.evaluate(() => Math.max(...[...document.querySelectorAll('#choices .choice')]
    .map((e) => e.getBoundingClientRect().bottom)));
  ok(`every choice is on screen without scrolling (${Math.round(bottom)}px of 660)`, bottom <= 660);
  await p.click('#choices .choice >> nth=0'); await p.waitForTimeout(100);
  const next = await p.evaluate(() => document.getElementById('btn-next').getBoundingClientRect().bottom);
  ok(`and Next after it (${Math.round(next)}px)`, next <= 660);
  await c.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
