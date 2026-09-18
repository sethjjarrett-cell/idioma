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
const tapTile = (word) => p.locator('#build-tray .tile')
  .filter({ hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`) })
  .first().click();
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
await tapTile(c.answer[0]);
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
  await tapTile(w);
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
    await tapTile(w);
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
console.log('it starts on the present tense, not every tense at once:',
  /^Present, the verbs you need first/.test(blurb.trim()));
console.log('blurb:', blurb.trim());
await p.click('#btn-start');
await p.waitForTimeout(300);
const vc = await p.evaluate(() => ({ band: window.__card.band.key,
  label: window.__card.band.label, drill: !!window.__card.drill,
  queue: window.Idioma.round.queue.length }));
console.log('a drill card comes up:', vc.drill === true, `(${vc.label})`);
console.log('and the round is the length you asked for, not the whole table:',
  vc.queue === 15, `(${vc.queue} cards)`);

console.log('\n--- picking a tense ---');
console.log('the picker is only in verb mode:', await p.isVisible('#filters'));
const tenseNames = await p.$$eval('#filter-pills .pill', ps => ps.map(x => x.textContent));
console.log('mixed plus every tense:', tenseNames.join(', '));
const runTense = async (tense, cards) => {
  await p.click(`#filter-pills .pill[data-value="${tense}"]`);
  await p.waitForTimeout(150);
  await p.click('#btn-start');
  await p.waitForTimeout(250);
  const seen = new Set();
  for (let i = 0; i < cards; i++) {
    const c = await p.evaluate(() => ({ t: window.__card.band.label, a: window.__card.accepted[0] }));
    seen.add(c.t);
    await p.fill('#answer', c.a); await p.click('#btn-submit'); await p.waitForTimeout(45);
    await p.click('#btn-next'); await p.waitForTimeout(45);
  }
  return [...seen];
};
console.log('one tense asks only that tense:',
  JSON.stringify(await runTense('future', 10)));
const mixed = await runTense('mixed', 14);
console.log('mixed really mixes:', mixed.length > 1, `(${mixed.length} tenses)`);
console.log('and a mixed round is still a round, not two hundred cards:',
  await p.evaluate(() => window.Idioma.round ? window.Idioma.round.queue.length : 0) <= 15);
console.log('and changing it takes effect on the next round, not never:',
  JSON.stringify(await runTense('present', 8)));
console.log('the picker survives a round:', await p.isVisible('#filters'));

console.log('\n--- pace ---');
await p.click('#btn-menu'); await p.waitForTimeout(250);
console.log('steady by default:', await p.$eval('#set-pace .pill.on', e => e.textContent));
await p.click('#set-pace .pill[data-pace="brisk"]'); await p.waitForTimeout(200);
console.log('the engine takes it:',
  await p.evaluate(() => window.Idioma.Engine.CONFIG.MAX_NEW_PER_ROUND) === 10);
console.log('the teaching checkbox stops lying about itself:',
  await p.isDisabled('#set-introduce'));
await p.reload(); await p.waitForTimeout(400);
console.log('it survives a reload:',
  await p.evaluate(() => window.Idioma.Engine.CONFIG.MAX_NEW_PER_ROUND) === 10);
await p.evaluate(() => { window.Idioma.state.settings.mode = 'words';
  window.Idioma.Store.saveNow(window.Idioma.state); });
await p.reload(); await p.waitForTimeout(400);
await p.click('#btn-start'); await p.waitForTimeout(300);
console.log('brisk asks a word it never showed you:',
  await p.evaluate(() => window.__card.intro) !== true);
await p.click('#btn-menu'); await p.waitForTimeout(200);
await p.click('#set-pace .pill[data-pace="gentle"]'); await p.waitForTimeout(200);
console.log('gentle puts it back:',
  await p.evaluate(() => window.Idioma.Engine.CONFIG.MAX_NEW_PER_ROUND) === 3);
await p.click('#set-pace .pill[data-pace="steady"]'); await p.waitForTimeout(200);
await p.click('#btn-menu'); await p.waitForTimeout(200);

console.log('\n--- one filter row, three meanings ---');
const pills = () => p.$$eval('#filter-pills .pill', ps => ps.map(x => ({
  value: x.dataset.value, more: !!x.dataset.more, on: x.classList.contains('on'),
  text: x.textContent.trim() })));
const labelOf = () => p.textContent('#filter-label');

await p.evaluate(() => { window.Idioma.state.settings.mode = 'words';
  window.Idioma.Store.saveNow(window.Idioma.state); });
await p.reload(); await p.waitForTimeout(400);
console.log('words says Kind of word:', (await labelOf()) === 'Kind of word');
const posPills = await pills();
console.log('with the groups a learner would name:',
  posPills.map(x => x.value).join(', '));
console.log('each carries how many it would draw on:',
  posPills.filter(x => x.value !== 'all').every(x => /\d/.test(x.text)));
await p.click('#filter-pills .pill[data-value="noun"]');
await p.waitForTimeout(200);
/* Thirty words met and none of them settled means the new-word allowance is
   spent, so a nouns round has nothing to draw on. That is the rule working,
   and it has to say so rather than claiming nothing is enabled. */
await p.click('#btn-start'); await p.waitForTimeout(250);
console.log('an empty pool says why, and says it truthfully:',
  (await p.textContent('#toast')).includes('no new words until some of the ones you are working on settle'));
// Settle them, and the same round runs.
await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const [id, row] of Object.entries(st.progress)) {
    st.progress[id] = { ...row, level: 8 };
  }
  window.Idioma.Store.saveNow(st);
});
await p.click('#btn-start'); await p.waitForTimeout(300);
const kinds = new Set();
for (let i = 0; i < 8; i++) {
  const c = await p.evaluate(() => ({ pos: window.__card.word.pos, intro: !!window.__card.intro }));
  kinds.add(c.pos);
  if (c.intro) await p.click('#btn-got');
  else { await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(50); await p.click('#btn-next'); }
  await p.waitForTimeout(60);
}
console.log('and a nouns round is all nouns:', [...kinds].join(',') === 'noun');
console.log('the blurb says which pool it is:',
  (await p.textContent('#start-blurb')).startsWith('nouns:'));

await p.evaluate(() => { window.Idioma.state.settings.pos = 'all';
  window.Idioma.state.settings.mode = 'sentences';
  window.Idioma.Store.saveNow(window.Idioma.state); });
await p.reload(); await p.waitForTimeout(400);
console.log('\nsentences says About:', (await labelOf()) === 'About');
const themes = await pills();
console.log('themes offered:', themes.filter(x => !x.more).map(x => x.value).join(', '));
console.log('only subjects that have sentences in them:',
  themes.filter(x => !x.more && x.value !== 'all').every(x => /\d/.test(x.text)));
/* Whichever subject is actually on offer, rather than a named one: which
   subjects exist depends on which words have been met, and a check that
   quietly skips itself is not a check. */
const food = themes.find(x => !x.more && x.value !== 'all');
if (food) {
  console.log('picking:', food.value);
  await p.click(`#filter-pills .pill[data-value="${food.value}"]`);
  await p.waitForTimeout(200);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  const ids = [];
  for (let i = 0; i < 4; i++) {
    // A subject can hold fewer sentences than the round asks for, and a round
    // that has ended leaves the last card behind for debugging.
    if (!(await p.isVisible('#card'))) break;
    const c = await p.evaluate(() => ({ id: window.__card.item.id, a: window.__card.tileAnswer, es: window.__card.reveal }));
    ids.push(c.id);
    if (c.a) { for (const w of c.a) { await tapTile(w); await p.waitForTimeout(35); } await p.click('#btn-build-check'); }
    else { await p.fill('#answer', c.es); await p.click('#btn-submit'); }
    await p.waitForTimeout(160);
    await p.click('#btn-next'); await p.waitForTimeout(160);
  }
  console.log('cards in that round:', ids.length);
  const allOne = await p.evaluate(({ got, theme }) => {
    const st = window.Idioma.state;
    const rows = window.Idioma.Store.sentenceIndex(st).rows;
    return got.every(id => ((rows.find(r => r.item.id === id) || {}).theme || 'other') === theme);
  }, { got: ids, theme: food.value });
  console.log('and every card in the round is about that one thing:', allOne);
} else {
  console.log('!! no subjects on offer, which should not happen here');
}

console.log('\n--- the long tail of subjects ---');
await p.evaluate(() => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 300))
    st.progress[id] = { ...E.freshProgress(), level: 4, timesSeen: 4, lastSeen: new Date().toISOString() };
  st.settings.subject = 'all';
  window.Idioma.Store.saveNow(st);
});
await p.reload(); await p.waitForTimeout(500);
const collapsed = await pills();
console.log('the row is capped rather than twenty pills long:', collapsed.length <= 10, `(${collapsed.length})`);
console.log('with a More on the end:', collapsed[collapsed.length - 1].more);
await p.click('#filter-pills .pill.more'); await p.waitForTimeout(200);
const opened = await pills();
console.log('More shows the rest:', opened.length > collapsed.length, `(${opened.length})`);
const last = opened.filter(x => !x.more).slice(-1)[0].value;
await p.click(`#filter-pills .pill[data-value="${last}"]`); await p.waitForTimeout(200);
await p.click('#filter-pills .pill.more'); await p.waitForTimeout(200);
const afterCollapse = await pills();
console.log('and a subject picked from the tail stays on screen when it closes:',
  afterCollapse.some(x => x.value === last && x.on), `(chose ${last})`);
console.log('changing mode closes it again:',
  await (async () => { await p.click('[data-mode="verbs"]'); await p.waitForTimeout(200);
    return (await labelOf()) === 'Tense'; })());

console.log('\n--- and the word mode still works ---');
await p.evaluate(() => { window.Idioma.state.settings.mode = 'words';
  window.Idioma.state.settings.pos = 'all';
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
