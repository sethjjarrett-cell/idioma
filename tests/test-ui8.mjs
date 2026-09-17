/* Three things that only exist once the browser is running them: a new word
   asked straight after it is taught, a word you keep missing being taught
   again and listed, and an English prompt with two right Spanish answers
   saying which one it wants. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
let pe = 0; p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });

await p.goto('file:///home/user/idioma/index.html');
await p.waitForTimeout(500);

const card = () => p.evaluate(() => ({
  id: window.__card.word.id, es: window.__card.word.es,
  intro: !!window.__card.intro, relearn: !!window.__card.relearn,
  band: window.__card.band.key, hint: window.__card.promptHint,
  prompt: window.__card.prompt,
}));

console.log('--- taught, then asked straight away ---');
await p.click('#btn-start');
await p.waitForTimeout(300);
const first = await card();
console.log('first card is a teach:', first.intro === true, '->', first.es);
console.log('it says what comes next:', await p.isVisible('#teach-then'),
  '->', (await p.textContent('#teach-then')).trim());
const queueBefore = await p.evaluate(() => window.Idioma.round.queue.length);
await p.click('#btn-got'); await p.waitForTimeout(250);
const second = await card();
const queueAfter = await p.evaluate(() => window.Idioma.round.queue.length);
console.log('the very next card is the same word:', second.id === first.id, '->', second.es);
console.log('and this time it is asked, not shown:', second.intro === false,
  `(${second.band})`);
console.log('the round grew by one rather than losing a card:',
  queueAfter === queueBefore + 1, `(${queueBefore} -> ${queueAfter})`);
console.log('the answer box is back:', await p.isVisible('#answer-form'));

// Answer it right, and the word should not be introduced a third time.
await p.fill('#answer', await p.evaluate(() => window.__card.accepted[0]));
await p.click('#btn-submit'); await p.waitForTimeout(250);
console.log('answering it counts:', (await p.textContent('#verdict-chip')).trim());
const prog = await p.evaluate(id => window.Idioma.state.progress[id], first.id);
console.log('seen twice, right once:', prog.timesSeen === 2 && prog.totalCorrect === 1,
  JSON.stringify({ timesSeen: prog.timesSeen, right: prog.totalCorrect }));

console.log('\n--- a word that keeps going wrong ---');
/* Driven through the app's own state rather than by typing sixteen wrong
   answers: the point under test is what the app does with the count, not the
   arithmetic, which test-engine already holds. */
await p.evaluate(() => {
  const st = window.Idioma.state;
  const E = window.Idioma.Engine;
  st.progress['agua'] = { ...E.freshProgress(), level: 2, timesSeen: 6,
    totalCorrect: 2, totalWrong: 4, lapses: 3, needsTeaching: true,
    lastSeen: new Date().toISOString() };
  window.Idioma.Store.saveNow(st);
});
const sticky = await p.evaluate(() => {
  const st = window.Idioma.state;
  const w = window.Idioma.Store.allWords(st).find(x => x.id === 'agua');
  const sFor = (id) => window.Idioma.Store.allSentences(st).filter(s => s.wordId === id);
  const c = window.Idioma.Engine.buildCard(w, st.progress['agua'], sFor);
  return { intro: c.intro, relearn: c.relearn, band: c.band.label };
});
console.log('it is shown again, not asked:', sticky.intro === true);
console.log('and labelled as a second look:', sticky.relearn === true, `-> "${sticky.band}"`);

console.log('\n--- and it is listed where you can see it ---');
await p.click('[data-go="progress"]').catch(async () => { await p.click('button:has-text("Progress")'); });
await p.waitForTimeout(300);
const rows = await p.$$eval('#sticking-body tr', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
console.log('sticking points table has the word:', rows.some(r => r.includes('agua')), '->', rows[0]);

console.log('\n--- two right answers to one English prompt ---');
const seen = await p.evaluate(() => {
  const st = window.Idioma.state;
  const E = window.Idioma.Engine;
  for (const id of ['ser', 'estar']) {
    st.progress[id] = { ...E.freshProgress(), level: 5, timesSeen: 5,
      lastSeen: new Date().toISOString() };
  }
  window.Idioma.Store.saveNow(st);
  const w = window.Idioma.Store.allWords(st).find(x => x.id === 'ser');
  const c = E.buildCard(w, st.progress['ser'], () => []);
  return { prompt: c.prompt, hint: c.promptHint, accepted: c.accepted };
});
console.log('the prompt is still just the English:', seen.prompt === 'to be', `-> "${seen.prompt}"`);
console.log('the hint says which sense:', /identity/.test(seen.hint), `-> "${seen.hint}"`);

const graded = await p.evaluate(() => {
  const st = window.Idioma.state;
  const words = window.Idioma.Store.allWords(st);
  const sibs = window.Idioma.Store.siblingsOf(words, 'ser');
  return window.Idioma.Engine.checkAnswer('estar', ['ser'], { siblings: sibs });
});
console.log('typing estar is amber, not red:', graded.almost && !graded.correct);
console.log('and is called a sense, not a typo:', graded.reason === 'sense');
console.log('naming the pair:', `${graded.sibling.es} = ${graded.sibling.sense}`);

console.log('\npageerror =', pe);
await b.close();
process.exit(pe ? 1 : 0);
