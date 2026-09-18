/* The three modes, in a real browser: picking one, the tile builder end to
   end, a sentence graduating from tiles to typing and being sent back again,
   and the verb mode starting small rather than with every table at once. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(500);

const card = () => p.evaluate(() => ({
  band: window.__card.band.key,
  id: window.__card.item ? window.__card.item.id : window.__card.word.id,
  prompt: window.__card.prompt,
  reveal: window.__card.reveal,
  answer: window.__card.tileAnswer,
  tiles: (window.__card.tiles || []).map(t => t.text),
}));
const phrase = (id) => p.evaluate(i => window.Idioma.state.phrases[i], id);
const meet = (n) => p.evaluate((count) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: 3, timesSeen: 3,
      lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, n);

console.log('--- the picker ---');
console.log('three modes offered:', await p.locator('#modes .mode').count() === 3);
console.log('words is the default:',
  await p.evaluate(() => document.querySelector('.mode.on').dataset.mode) === 'words');
await p.click('[data-mode="sentences"]');
await p.waitForTimeout(150);
console.log('with nothing met, it says so rather than starting an empty round:',
  (await p.textContent('#start-blurb')).includes('No sentences yet'));
await p.click('#btn-start');
await p.waitForTimeout(200);
console.log('and starting is refused with a reason:',
  (await p.textContent('#toast')).includes('Practise some words first'));

await meet(30);
await p.reload();
await p.waitForTimeout(400);
console.log('the mode survives a reload:',
  await p.evaluate(() => document.querySelector('.mode.on').dataset.mode) === 'sentences');
console.log('blurb now counts what is in reach:',
  /\d+ sentences you have the words for/.test(await p.textContent('#start-blurb')));

console.log('\n--- building one out of tiles ---');
await p.click('#btn-start');
await p.waitForTimeout(300);
const c = await card();
console.log('a new sentence is built, not typed:', c.band === 'build');
console.log('prompt is the English:', JSON.stringify(c.prompt));
console.log('answer box is out of the way:', await p.isHidden('#answer-form'));
console.log('tray holds the words plus decoys:',
  c.tiles.length === c.answer.length + 3, `(${c.tiles.length} for a ${c.answer.length}-word answer)`);
console.log('no tile gives away the capital:',
  c.tiles.every(t => t === t.toLocaleLowerCase('es')));
console.log('check is disabled until something is placed:',
  await p.isDisabled('#btn-build-check'));

// Place one, take it back, then place the lot in order.
await p.click(`#build-tray .tile:text-is("${c.answer[0]}")`);
await p.waitForTimeout(80);
console.log('a placed tile moves to the answer line:',
  await p.locator('#build-line .tile').count() === 1);
console.log('and leaves the tray:',
  await p.locator('#build-tray .tile').count() === c.tiles.length - 1);
await p.click('#build-line .tile');
await p.waitForTimeout(80);
console.log('tapping it again takes it back:',
  await p.locator('#build-line .tile').count() === 0
  && await p.locator('#build-tray .tile').count() === c.tiles.length);

for (const w of c.answer) {
  await p.click(`#build-tray .tile:text-is("${w}")`);
  await p.waitForTimeout(50);
}
await p.click('#btn-build-check');
await p.waitForTimeout(250);
console.log('the right order is correct:', (await p.textContent('#verdict-chip')).trim() === 'Correct');
console.log('and the reveal shows it written properly:',
  (await p.textContent('#verdict-answer')).trim() === c.reveal);
const after = await phrase(c.id);
console.log('the sentence has its own progress row:',
  !!after && after.level === 2, JSON.stringify(after && { level: after.level, seen: after.timesSeen }));
console.log('and no word row was touched by it:',
  await p.evaluate(id => window.Idioma.state.progress[id] === undefined, c.id));

console.log('\n--- out of order ---');
await p.click('#btn-next');
await p.waitForTimeout(250);
const c2 = await card();
if (c2.band === 'build' && c2.answer.length > 2) {
  const swapped = c2.answer.slice();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  for (const w of swapped) {
    await p.click(`#build-tray .tile:text-is("${w}")`);
    await p.waitForTimeout(50);
  }
  await p.click('#btn-build-check');
  await p.waitForTimeout(250);
  console.log('two words swapped is Almost, not Not quite:',
    (await p.textContent('#verdict-chip')).trim() === 'Almost');
  console.log('and says what went wrong:', (await p.textContent('#verdict-detail')).trim());
  console.log('a second go is offered:', await p.isVisible('#btn-retry'));
  await p.click('#btn-retry');
  await p.waitForTimeout(200);
  console.log('which hands the tiles back, empty:',
    await p.isVisible('#build') && await p.locator('#build-line .tile').count() === 0);
} else {
  console.log('(skipped: next card was not a multi-word build)');
}

console.log('\n--- graduating to typing, and being sent back ---');
await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  st.phrases['p025'] = { ...E.freshProgress(), level: 4, timesSeen: 4, totalCorrect: 4,
    lastSeen: new Date(Date.now() - 9e8).toISOString() };
  window.Idioma.Store.saveNow(st);
});
const typedCard = await p.evaluate(() => {
  const st = window.Idioma.state;
  const item = window.Idioma.Store.allPhrases(st).find(x => x.id === 'p025');
  const c = window.Idioma.Engine.sentenceCard(item, st.phrases['p025']);
  return { band: c.band.key, tiles: c.tiles, prompt: c.prompt, reveal: c.reveal };
});
console.log('past the tile level it is typed:', typedCard.band === 'translate');
console.log('with no tiles at all:', typedCard.tiles === null);
const backToTiles = await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  // Three wrong answers from level 4 takes it below the tile ceiling.
  let row = st.phrases['p025'];
  for (let i = 0; i < 3; i++) row = E.applyResult(row, 'wrong', new Date().toISOString()).progress;
  const item = window.Idioma.Store.allPhrases(st).find(x => x.id === 'p025');
  return { level: row.level, band: E.sentenceCard(item, row, { distractors: [] }).band.key };
});
console.log('getting it wrong enough sends it back to tiles:',
  backToTiles.band === 'build', `(L${backToTiles.level})`);

console.log('\n--- verb endings ---');
await p.click('[data-mode="verbs"]');
await p.waitForTimeout(150);
const blurb = await p.textContent('#start-blurb');
console.log('it starts with the present tense only:', /Present tense/.test(blurb));
console.log('blurb:', blurb.trim());
await p.click('#btn-start');
await p.waitForTimeout(300);
const vc = await p.evaluate(() => ({ band: window.__card.band.key,
  label: window.__card.band.label, drill: !!window.__card.drill,
  queue: window.Idioma.round.queue.length }));
console.log('a drill card comes up:', vc.drill === true, `(${vc.label})`);
console.log('and the round is a sensible size:', vc.queue > 10 && vc.queue < 60, `(${vc.queue} forms)`);

console.log('\n--- and the word mode still works ---');
await p.evaluate(() => { window.Idioma.state.settings.mode = 'words';
  window.Idioma.Store.saveNow(window.Idioma.state); });
await p.reload();
await p.waitForTimeout(400);
await p.click('#btn-start');
await p.waitForTimeout(300);
const wc = await card();
console.log('a word card, not a sentence:',
  ['recognition', 'production', 'cloze', 'intro', 'relearn'].includes(wc.band), `(${wc.band})`);

console.log('\npageerror =', pe);
await b.close();
process.exit(pe ? 1 : 0);
