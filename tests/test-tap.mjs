/* Tapping a word for what it means.

   The lookup goes through the same form index that decides when a sentence
   is ready, so the useful thing to check is that it finds the word behind a
   form (tengo is tener, casas is casa) and says which form it was. Then the
   page: which Spanish can be tapped, which cannot because it is the
   question, and that the pop-up opens under the word and gets out of the
   way. */
import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page(viewport = { width: 390, height: 760 }) {
  const ctx = await b.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  return { ctx, p };
}
const seed = (p, n, level) => p.evaluate(([count, lv]) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: lv, timesSeen: 6,
      lastSeen: new Date(Date.now() - 30 * 864e5).toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, [n, level]);
const card = (p) => p.evaluate(() => window.__card);

console.log('what a word means');
{
  const { ctx, p } = await page();
  const g = (t) => p.evaluate((tok) => window.Idioma.glossFor(tok), t);
  let x = await g('tengo');
  ok('tengo is tener', x && x.es === 'tener', JSON.stringify(x));
  ok('and says which form: tense, person and English', x && x.verb && x.verb.tense === 'present'
    && x.verb.person === 'yo' && x.verb.english === 'I have', JSON.stringify(x && x.verb));
  x = await g('tiene');
  ok('the él form is he and she alike', x && x.verb && /^he \/ she has/.test(x.verb.english), JSON.stringify(x && x.verb));
  x = await g('fui');
  ok('an irregular past is found too', x && (x.es === 'ir' || x.es === 'ser'), JSON.stringify(x));
  x = await g('casas');
  ok('a plural is its singular', x && x.es === 'casa' && /form of casa/.test(x.form));
  x = await g('bonita');
  ok('a feminine is its masculine', x && x.es === 'bonito');
  x = await g('mesa');
  ok('the word itself has no form note', x && x.es === 'mesa' && !x.form);
  x = await g('la');
  ok('an article is explained as grammar', x && x.en === 'the');
  x = await g('del');
  ok('and a contraction says what it is made of', x && /de and el/.test(x.en));
  const html = await p.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = window.Idioma.tappable('¿Dónde _____? Aquí _____.');
    return { blanks: d.querySelectorAll('.blank').length, taps: d.querySelectorAll('.tap').length };
  });
  ok('a blank with punctuation stuck to it is still a blank', html.blanks === 2 && html.taps === 2, JSON.stringify(html));
  x = await g('medellin');
  ok('a place name is simply not there', x === null);
  await ctx.close();
}

console.log('the teaching card');
{
  const { ctx, p } = await page();
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const c = await card(p);
  ok('the word being taught is not tappable', await p.$('#card-prompt .tap') === null);
  if (c.example) {
    const taps = await p.$$('#teach-es .tap');
    ok('every word of the example is', taps.length === c.example.es.split(/\s+/).length,
      `${taps.length} for "${c.example.es}"`);
    ok('the taught word is still picked out', await p.$('#teach-es b .tap') !== null);
    await taps[taps.length - 1].click();
    ok('tapping one opens what it means', await p.isVisible('#gloss')
      && (await p.textContent('#gloss-en')).length > 0);
    // A verb form, in a sentence fixed here so it does not depend on which
    // example the card drew: the rows are labelled, not run together.
    await p.evaluate(() => { document.getElementById('teach-es').innerHTML = window.Idioma.tappable('Ella tiene hambre.'); });
    await p.click('#teach-es .tap[data-tok="tiene"]');
    const rows = await p.$$eval('#gloss-rows dt', (els) => els.map((e) => [e.textContent, e.nextElementSibling.textContent]));
    const row = Object.fromEntries(rows);
    ok('a verb shows labelled rows: what was tapped, tense, person, English',
      row['You tapped'] === 'tiene' && row.Tense === 'present' && /él/.test(row.Person)
      && /he \/ she has/.test(row['In English']), JSON.stringify(row));
    await p.click('#teach-es .tap[data-tok="hambre"]');
    ok('a plain word has no rows at all', await p.isHidden('#gloss-rows'));
    const box = await p.evaluate(() => {
      const g = document.getElementById('gloss').getBoundingClientRect();
      const t = document.querySelector('.tap.on').getBoundingClientRect();
      return { below: g.top >= t.bottom - 1, inside: g.left >= 0 && g.right <= window.innerWidth };
    });
    ok('under the word, and on screen', box.below && box.inside, JSON.stringify(box));
    await p.click('#teach-meaning');
    ok('tapping elsewhere closes it', await p.isHidden('#gloss'));
  }
  await ctx.close();
}

console.log('a recognition card');
{
  const { ctx, p } = await page();
  await seed(p, 60, 2);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  let c = await card(p);
  for (let i = 0; i < 10 && c.band.key !== 'recognition'; i++) {
    if (c.intro) await p.click('#btn-got');
    await p.waitForTimeout(80);
    c = await card(p);
  }
  ok('the Spanish word is the question, so it cannot be tapped',
    c.band.key === 'recognition' && await p.$('#card-prompt .tap') === null);
  await ctx.close();
}

console.log('a cloze card');
{
  const { ctx, p } = await page();
  await seed(p, 60, 9);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  let c = await card(p);
  for (let i = 0; i < 12 && c.band.key !== 'cloze'; i++) {
    if (c.intro) await p.click('#btn-got');
    else { await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.click('#btn-next'); }
    await p.waitForTimeout(80);
    c = await card(p);
  }
  ok('the sentence around the blank can be tapped', c.band.key === 'cloze'
    && (await p.$$('#card-prompt .tap')).length > 0);
  ok('the blank is still a blank, not a word', await p.$('#card-prompt .blank') !== null
    && !(await p.$$eval('#card-prompt .tap', (els) => els.map((e) => e.textContent))).includes('_____'));
  await p.focus('#answer');
  await p.click('#card-prompt .tap >> nth=0');
  ok('tapping a word while typing keeps the keyboard up', await p.evaluate(() => document.activeElement.id === 'answer'));
  ok('and shows the meaning', await p.isVisible('#gloss'));
  await p.fill('#answer', 'zzz');
  // A verb's pop-up has rows and can reach down over Check; close it first,
  // as you would by tapping elsewhere.
  await p.keyboard.press('Escape');
  await p.click('#btn-submit'); await p.waitForTimeout(100);
  ok('the full sentence at the verdict can be tapped too', (await p.$$('#verdict-context .tap')).length > 0);
  await p.click('#btn-next'); await p.waitForTimeout(100);
  ok('the next card closes the pop-up', await p.isHidden('#gloss'));
  await ctx.close();
}

console.log('sentences and listening');
{
  const { ctx, p } = await page();
  await seed(p, 250, 2);
  await p.evaluate(() => { window.Idioma.state.settings.mode = 'sentences'; window.Idioma.Store.saveNow(window.Idioma.state); });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const c = await card(p);
  if (await p.isVisible('#build')) await p.click('#btn-build-check').catch(() => {});
  else { await p.fill('#answer', 'x'); await p.click('#btn-submit'); }
  await p.waitForTimeout(100);
  if (await p.isHidden('#verdict')) { await p.click('#build-tray .tile >> nth=0'); await p.click('#btn-build-check'); await p.waitForTimeout(100); }
  ok('a sentence answer can be tapped word by word',
    (await p.$$('#verdict-answer .tap')).length === c.reveal.split(/\s+/).length);
  await ctx.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
