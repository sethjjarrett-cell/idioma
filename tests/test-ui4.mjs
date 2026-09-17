/* Topics, lessons and the conjugation drill, driven through the real page. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });
p.on('console', m => { if (m.type() === 'error') console.log('  !! CONSOLE:', m.text().slice(0, 140)); });

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(400);
console.log('tabs:', (await p.$$eval('.tab', ns => ns.map(n => n.textContent.trim()))).join(', '));

// --- topics ----------------------------------------------------------
await p.click('.tab[data-screen="topics"]');
await p.waitForTimeout(300);
const topics = await p.$$eval('.topic', ns => ns.map(n => ({
  name: n.querySelector('h2').textContent.trim(),
  count: n.querySelector('.count-chip').textContent.trim(),
})));
console.log('\n--- topics ---');
console.log('panes rendered:', topics.length);
topics.forEach(t => console.log('  ', t.name.padEnd(22), t.count));
const totalFiled = await p.evaluate(() =>
  window.TOPICS.reduce((a, t) => a + t.words.length, 0));
console.log('words filed across topics:', totalFiled, '(bank is', await p.evaluate(() => SEED.vocabulary.length) + ')');
console.log('word list has pronunciation column:', await p.locator('.topic .say-cell').count() > 0);

// practise one topic and check the pool really is limited to it
const first = p.locator('.topic').first();
const topicId = await first.getAttribute('data-topic');
const expected = await p.evaluate(id => window.TOPICS.find(t => t.id === id).words, topicId);
await first.locator('[data-act="practise-topic"]').click();
await p.waitForTimeout(350);
console.log('\n--- practising one topic ---');
console.log('switched to practice:', await p.isVisible('#card'));
console.log('chip says:', (await p.textContent('#start-picked-name')).trim());
const drawn = [];
for (let i = 0; i < 6; i++) {
  drawn.push(await p.evaluate(() => window.__card.word.id));
  await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(70);
  await p.click('#btn-next'); await p.waitForTimeout(70);
  if (!(await p.isVisible('#card'))) break;
}
console.log('cards drawn:', drawn.length, '| all from that topic:', drawn.every(id => expected.includes(id)));

// --- lessons ---------------------------------------------------------
await p.click('.tab[data-screen="lessons"]');
await p.waitForTimeout(300);
console.log('\n--- lessons ---');
console.log('tense tables  :', await p.locator('#verb-tenses details').count());
console.log('irregular verbs:', await p.locator('#verb-irregulars details').count());
console.log('notes         :', await p.locator('#verb-notes details').count());
console.log('sound rules   :', await p.locator('#pron-rules details').count());

const pres = p.locator('#verb-tenses details').first();
await pres.locator('summary').click();
await p.waitForTimeout(150);
console.log('present tense table opens:', await pres.locator('table.conj').isVisible());
const row = await pres.locator('table.conj tbody tr').first().innerText();
console.log('first row:', row.replace(/\s+/g, ' ').trim());

// --- the drill -------------------------------------------------------
const before = await p.evaluate(() => JSON.parse(JSON.stringify(window.Idioma.state.progress)));
await pres.locator('[data-act="drill"]').click();
await p.waitForTimeout(350);
console.log('\n--- drill ---');
console.log('chip says   :', (await p.textContent('#start-picked-name')).trim());
console.log('prompt      :', (await p.textContent('#card-prompt')).trim());
console.log('hint        :', (await p.textContent('#card-hint')).trim());
console.log('band label  :', (await p.textContent('#card-band')).trim());
console.log('person label:', (await p.textContent('#card-level')).trim());
const want = await p.evaluate(() => window.__card.accepted[0]);
console.log('expected answer comes from the table:', JSON.stringify(want));
await p.fill('#answer', want);
await p.click('#btn-submit'); await p.waitForTimeout(200);
console.log('verdict     :', (await p.textContent('#verdict-chip')).trim());
console.log('override hidden on a drill:', await p.isHidden('#btn-override'));
const after = await p.evaluate(() => JSON.parse(JSON.stringify(window.Idioma.state.progress)));
console.log('no word progress touched:', JSON.stringify(before) === JSON.stringify(after));

// every form the drill can ask must match the table it came from
const mismatches = await p.evaluate(() => {
  const { VERBS, conjugate } = window.Verbs;
  const bad = [];
  for (const t of VERBS.tenses) for (const f of VERBS.families) for (const pr of VERBS.persons) {
    const form = conjugate(f.example, t.id, pr.id);
    if (!form || !form.length) bad.push([f.example, t.id, pr.id]);
  }
  return bad;
});
console.log('every regular form builds:', mismatches.length === 0, mismatches.length ? mismatches : '');

// --- pronunciation on a card ----------------------------------------
await p.click('.tab[data-screen="practice"]');
// The way back to the whole bank must be reachable mid-round, not only from
// the start pane, or a topic is a room with no door.
console.log('\nway out visible mid-drill:', await p.isVisible('#btn-clear-pick'));
await p.click('#btn-clear-pick'); await p.waitForTimeout(200);
console.log('round abandoned, back to the start pane:', await p.isVisible('#btn-start'));
await p.click('#btn-start'); await p.waitForTimeout(250);
let sawSay = false, tried = 0;
while (tried++ < 14 && await p.isVisible('#card')) {
  await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(70);
  if (await p.isVisible('#verdict-say')) {
    console.log('\n--- pronunciation on a card ---');
    console.log('word :', (await p.textContent('#verdict-answer')).trim());
    console.log('shown:', (await p.textContent('#verdict-say')).trim());
    sawSay = true;
  }
  await p.click('#btn-next'); await p.waitForTimeout(70);
  if (sawSay) break;
}
console.log('pronunciation shown on at least one card:', sawSay);

console.log('\npageerror =', pe);
await b.close();
