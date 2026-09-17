/* A word you have never met must be shown before it is tested. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(500);
await p.click('#btn-start');
await p.waitForTimeout(300);

console.log('--- the first card of a fresh bank ---');
const c = await p.evaluate(() => ({ intro: window.__card.intro, id: window.__card.word.id }));
console.log('is an introduction  :', c.intro === true);
console.log('band says           :', (await p.textContent('#card-band')).trim());
console.log('word                :', (await p.textContent('#card-prompt')).trim());
console.log('meaning shown       :', (await p.textContent('#teach-meaning')).trim());
console.log('example shown       :', await p.isVisible('#teach-example'));
console.log('example sentence    :', (await p.textContent('#teach-es')).trim());
console.log('and its translation :', (await p.textContent('#teach-en')).trim());
console.log('the word is picked out of it:', await p.locator('#teach-es b').count() === 1,
  '->', (await p.locator('#teach-es b').textContent().catch(() => '')).trim());
console.log('nothing to type     :', await p.isHidden('#answer-form'));
console.log('one button, Got it  :', await p.isVisible('#btn-got'));

const before = await p.evaluate(id => window.Idioma.state.progress[id], c.id);
await p.click('#btn-got'); await p.waitForTimeout(200);
const after = await p.evaluate(id => window.Idioma.state.progress[id], c.id);
console.log('\n--- after Got it ---');
console.log('level untouched     :', (after.level === 1), `(L${after.level})`);
console.log('nothing counted right or wrong:', after.totalCorrect === 0 && after.totalWrong === 0);
console.log('but marked as met   :', after.timesSeen === 1);
console.log('was unseen before   :', !before || !before.timesSeen);

// the same word, next time it comes up, must be a test
const tested = await p.evaluate(id => {
  const st = window.Idioma.state;
  const w = window.Idioma.Store.allWords(st).find(x => x.id === id);
  const sFor = (wid) => window.Idioma.Store.allSentences(st).filter(s => s.wordId === wid);
  return window.Idioma.Engine.buildCard(w, st.progress[id], sFor, { introduce: true });
}, c.id);
console.log('second time it is tested, not shown:', tested.intro !== true, '| band:', tested.band.label);

console.log('\n--- how many new words a round will introduce ---');
let intros = 0, cards = 0;
while (await p.isVisible('#card') && cards < 20) {
  cards++;
  if (await p.evaluate(() => !!window.__card.intro)) {
    intros++; await p.click('#btn-got');
  } else {
    await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(60);
    await p.click('#btn-next');
  }
  await p.waitForTimeout(60);
}
console.log('first round: every card new, so all were introductions:', intros, 'of', cards);
console.log('round summary counts them apart:',
  (await p.textContent('#end-stats')).replace(/\s+/g, ' ').trim());

// now that words have been met, the cap should bite
await p.click('#btn-again'); await p.waitForTimeout(300);
let intros2 = 0, cards2 = 0;
while (await p.isVisible('#card') && cards2 < 20) {
  cards2++;
  if (await p.evaluate(() => !!window.__card.intro)) { intros2++; await p.click('#btn-got'); }
  else { await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(60); await p.click('#btn-next'); }
  await p.waitForTimeout(60);
}
console.log('second round introduced', intros2, 'new words of', cards2, '(cap is 5)');

console.log('\n--- with the setting off ---');
await p.click('#btn-menu'); await p.waitForTimeout(150);
await p.uncheck('#set-introduce'); await p.waitForTimeout(150);
await p.click('#btn-menu');
await p.click('#btn-again'); await p.waitForTimeout(300);
console.log('new words go straight to a test:', await p.evaluate(() => !!window.__card.intro) === false);
console.log('the box is back                :', await p.isVisible('#answer-form'));

console.log('\npageerror =', pe);
await b.close();
