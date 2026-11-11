/* Translating by typing, and by saying it.

   The recogniser here is a stand-in. Headless Chromium has no speech
   recognition, so what this proves is the wiring: that the button appears
   only where the browser offers one, asks for Colombian Spanish, puts what
   was heard in the box and leaves the checking to the learner. Whether a
   real phone hears a real voice properly cannot be tested from here and is
   not claimed. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
const open = async (withMic) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 660 } });
  if (!withMic) {
    // This Chromium ships both names, so "a browser without it" has to be made.
    await ctx.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
    });
  }
  if (withMic) {
    await ctx.addInitScript(() => {
      window.__heard = [];
      // Both names: the unprefixed one is tried first, and the real thing in a
      // headless browser accepts start() and then never hears anything.
      window.SpeechRecognition = window.webkitSpeechRecognition = class {
        start() {
          window.__heard.push(this.lang);
          const say = window.__say || '';
          setTimeout(() => {
            if (window.__micError) { this.onerror && this.onerror({ error: window.__micError }); }
            else { this.onresult && this.onresult({ results: [[{ transcript: say }]] }); }
            this.onend && this.onend();
          }, 30);
        }
        abort() { this.onend && this.onend(); }
      };
    });
  }
  const p = await ctx.newPage();
  p.on('pageerror', e => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const st = window.Idioma.state, E = window.Idioma.Engine;
    for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 60)) {
      st.progress[id] = { ...E.freshProgress(), level: 5, timesSeen: 5,
        lastSeen: new Date().toISOString() };
    }
    st.settings.mode = 'sentences';
    window.Idioma.Store.saveNow(st);
  });
  await p.reload();
  await p.waitForTimeout(400);
  return p;
};

const p = await open(true);
const card = () => p.evaluate(() => ({ band: window.__card.band.key,
  id: window.__card.item.id, en: window.__card.prompt, es: window.__card.reveal }));

console.log('--- type it out ---');
console.log('the choice is offered in sentence mode:', await p.isVisible('#hows'));
console.log('tiles first is the default:',
  await p.$eval('#how-pills .pill.on', e => e.dataset.how) === 'build');
await p.click('#how-pills .pill[data-how="type"]');
await p.waitForTimeout(150);
await p.click('#btn-start');
await p.waitForTimeout(350);
let c = await card();
console.log('a brand new sentence is typed, not built:', c.band === 'translate');
console.log('the box is there and the tiles are not:',
  await p.isVisible('#answer-form') && await p.isHidden('#build'));
console.log('the folded line says so:', (await p.textContent('#picker-summary-text')).includes('typed'));
console.log('and the page is still one screen:',
  await p.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight));

// One word wrong: amber, with the place marked.
const words = c.es.replace(/[¿?¡!.,]/g, '').split(/\s+/);
if (words.length >= 3) {
  const off = words.slice(); off[off.length - 1] = 'zapato';
  await p.fill('#answer', off.join(' '));
  await p.click('#btn-submit'); await p.waitForTimeout(250);
  console.log(`one word out of ${words.length}:`, (await p.textContent('#verdict-chip')).trim(),
    '|', (await p.textContent('#verdict-detail')).trim());
  console.log('and the card marks where:', await p.isVisible('#verdict-diff'));
  await p.click('#btn-retry'); await p.waitForTimeout(200);
}
await p.fill('#answer', c.es.replace(/[¿?¡!.,]/g, '').toLowerCase());
await p.click('#btn-submit'); await p.waitForTimeout(250);
console.log('typed without capitals, accents aside, or punctuation:',
  (await p.textContent('#verdict-chip')).trim() === 'Correct');

console.log('\n--- a wrong sentence says where ---');
await p.click('#btn-next'); await p.waitForTimeout(300);
c = await card();
await p.fill('#answer', 'esto no es la frase');
await p.click('#btn-submit'); await p.waitForTimeout(250);
console.log('verdict:', (await p.textContent('#verdict-chip')).trim(),
  '|', (await p.textContent('#verdict-detail')).trim());
console.log('the diff is shown even though it is wrong:', await p.isVisible('#verdict-diff'));

console.log('\n--- a translation it did not know, taught once ---');
await p.click('#btn-override'); await p.waitForTimeout(300);
console.log('toast:', (await p.textContent('#toast')).trim().slice(0, 70));
const taught = await p.evaluate(() => window.Idioma.Store.taughtAnswers(window.Idioma.state));
console.log('remembered against that sentence:', taught.length === 1 && taught[0].id === c.id);
const again = await p.evaluate((id) => {
  const st = window.Idioma.state, S = window.Idioma.Store, E = window.Idioma.Engine;
  const item = S.allPhrases(st).find(x => x.id === id);
  const k = E.sentenceCard(item, S.peekPhrase(st, id), { typed: true, alternatives: S.alternatives(st, id, 'es') });
  return E.checkSentence('esto no es la frase', k.accepted);
}, c.id);
console.log('and accepted next time, marked as the other way of putting it:',
  again.correct && again.equivalent);

console.log('\n--- and taken back ---');
await p.click('button:has-text("Manage")'); await p.waitForTimeout(300);
console.log('listed on Manage, by the sentence and not an id:',
  (await p.textContent('#taught-body')).includes(c.en));
await p.click('#taught-body [data-act="forget"]'); await p.waitForTimeout(250);
console.log('gone from the list:', (await p.textContent('#taught-body')).includes('Nothing yet'));
console.log('and no longer accepted:', await p.evaluate((id) =>
  window.Idioma.Store.alternatives(window.Idioma.state, id, 'es').length === 0, c.id));
console.log('the row is kept, stamped, so a sync cannot put it back:',
  await p.evaluate((id) => !!window.Idioma.state.accepted[id].at, c.id));

console.log('\n--- saying it ---');
await p.click('button:has-text("Practice")'); await p.waitForTimeout(200);
// The round from before is still running, parked on the verdict it was left on.
if (await p.isVisible('#btn-start')) await p.click('#btn-start');
else await p.click('#btn-next');
await p.waitForTimeout(350);
if (!(await p.isVisible('#card'))) { await p.click('#btn-again'); await p.waitForTimeout(350); }
c = await card();
console.log('the microphone is offered:', await p.isVisible('#btn-mic'));
await p.evaluate((es) => { window.__say = es; }, c.es);
await p.click('#btn-mic'); await p.waitForTimeout(200);
console.log('it asked for Colombian Spanish:', await p.evaluate(() => window.__heard[0]) === 'es-CO');
console.log('what was heard is in the box:', (await p.inputValue('#answer')) === c.es);
console.log('and nothing was submitted for you:', await p.isHidden('#verdict'));
console.log('the button is no longer lit:', !(await p.$eval('#btn-mic', e => e.classList.contains('on'))));
await p.click('#btn-submit'); await p.waitForTimeout(250);
console.log('checking it is still your move:', (await p.textContent('#verdict-chip')).trim() === 'Correct');

// A round of new sentences is short, so the next card may be a new round.
await p.click('#btn-next'); await p.waitForTimeout(300);
if (!(await p.isVisible('#card'))) { await p.click('#btn-again'); await p.waitForTimeout(350); }
await p.evaluate(() => { window.__micError = 'not-allowed'; });
await p.click('#btn-mic'); await p.waitForTimeout(200);
console.log('a blocked microphone says so plainly:',
  (await p.textContent('#toast')).includes('microphone is blocked'));
await p.evaluate(() => { window.__micError = 'language-not-supported'; window.__heard = []; });
await p.click('#btn-mic'); await p.waitForTimeout(400);
console.log('no Colombian model: it works down the list rather than giving up:',
  JSON.stringify(await p.evaluate(() => window.__heard)));

console.log('\n--- a word card asks in the right language ---');
await p.evaluate(() => { window.__micError = null; window.__heard = [];
  const st = window.Idioma.state, E = window.Idioma.Engine;
  st.settings.mode = 'words';
  for (const id of Object.keys(st.progress)) st.progress[id].level = 2;
  window.Idioma.Store.saveNow(st); });
await p.reload(); await p.waitForTimeout(400);
await p.click('#btn-start'); await p.waitForTimeout(350);
if (await p.evaluate(() => !!window.__card.intro)) { await p.click('#btn-got'); await p.waitForTimeout(250); }
const band = await p.evaluate(() => window.__card.band.key);
await p.evaluate(() => { window.__say = 'hello'; });
await p.click('#btn-mic'); await p.waitForTimeout(200);
console.log(`a ${band} card listens in:`, await p.evaluate(() => window.__heard[0]),
  '->', (band === 'recognition') === ((await p.evaluate(() => window.__heard[0])) === 'en-GB'));

console.log('\n--- where the browser cannot do it ---');
const q = await open(false);
await q.click('#how-pills .pill[data-how="type"]'); await q.waitForTimeout(150);
await q.click('#btn-start'); await q.waitForTimeout(350);
console.log('no microphone button at all:', await q.isHidden('#btn-mic'));
console.log('and typing works exactly as before:', await q.isVisible('#answer'));

console.log('\npageerror =', pe);
await b.close();
process.exit(pe ? 1 : 0);
