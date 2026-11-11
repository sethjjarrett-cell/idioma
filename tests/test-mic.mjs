/* Saying an answer instead of typing it, in a real browser.

   What this can check: the key appears only where the browser can listen and
   only on a card that wants Spanish, what is heard lands in the box without
   being submitted, the language asked for is Colombian Spanish with fallbacks,
   and a blocked microphone says so. What it cannot check is a real
   microphone: the recogniser here is a stand-in that "hears" whatever the
   test tells it to. How well a phone hears a learner's accent is not
   something a test run can vouch for. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const open = async (withMic) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 660 } });
  await ctx.addInitScript((mic) => {
    if (!mic) {
      // This Chromium ships the real thing, so "a browser without it" has to be made.
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      return;
    }
    window.__heard = [];
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() {
        window.__heard.push(this.lang);
        setTimeout(() => {
          if (window.__micError === 'language-not-supported' && this.lang !== 'es-MX') {
            this.onerror && this.onerror({ error: 'language-not-supported' });
          } else if (window.__micError && window.__micError !== 'language-not-supported') {
            this.onerror && this.onerror({ error: window.__micError });
          } else {
            this.onresult && this.onresult({ results: [[{ transcript: window.__say || '' }]] });
          }
          this.onend && this.onend();
        }, 30);
      }
      abort() { this.onend && this.onend(); }
    };
  }, withMic);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(400);
  return p;
};
const startWrite = async (p) => {
  await p.click('[data-mode="write"]'); await p.waitForTimeout(150);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  // Write it shows any unmet words first; step past that if it is there.
  for (let i = 0; i < 3 && !(await p.isVisible('#answer')); i++) {
    for (const sel of ['#btn-got', '#btn-next', '#btn-write-go']) {
      if (await p.isVisible(sel).catch(() => false)) { await p.click(sel); await p.waitForTimeout(200); break; }
    }
  }
};

console.log('--- a browser that can listen ---');
{
  const p = await open(true);
  await startWrite(p);
  ok('a typed Spanish card is on screen', await p.isVisible('#answer'));
  ok('the microphone key is offered', await p.isVisible('#btn-mic'));
  await p.evaluate(() => { window.__say = 'me llamo Seth'; });
  await p.click('#btn-mic'); await p.waitForTimeout(200);
  ok('what was heard is in the box', await p.inputValue('#answer') === 'me llamo Seth', await p.inputValue('#answer'));
  ok('and it was not submitted', await p.isHidden('#verdict'));
  ok('Colombian Spanish is asked for first', (await p.evaluate(() => window.__heard))[0] === 'es-CO');
  ok('the key is no longer lit', !(await p.$eval('#btn-mic', (e) => e.classList.contains('on'))));

  await p.evaluate(() => { window.__say = 'mucho gusto'; });
  await p.click('#btn-mic'); await p.waitForTimeout(200);
  ok('saying more adds to what is there', await p.inputValue('#answer') === 'me llamo Seth mucho gusto');

  await p.fill('#answer', '');
  await p.evaluate(() => { window.__micError = 'language-not-supported'; window.__heard = []; window.__say = 'hola'; });
  await p.click('#btn-mic'); await p.waitForTimeout(500);
  const tried = await p.evaluate(() => window.__heard);
  ok('a language the browser lacks falls back to the next nearest',
    tried.join(',') === 'es-CO,es-419,es-MX' && await p.inputValue('#answer') === 'hola', tried.join(','));

  await p.evaluate(() => { window.__micError = 'not-allowed'; });
  await p.click('#btn-mic'); await p.waitForTimeout(200);
  ok('a blocked microphone says so plainly', (await p.textContent('#toast')).includes('microphone is blocked'));

  await p.evaluate(() => { window.__micError = null; });
  await p.fill('#answer', 'x'); await p.click('#btn-submit'); await p.waitForTimeout(200);
  ok('the verdict takes the key away with the box', await p.isHidden('#btn-mic'));

  await p.click('#btn-menu'); await p.waitForTimeout(150);
  ok('the menu says where the audio goes', await p.isVisible('#mic-note'));
}

console.log('--- a card that wants English ---');
{
  const p = await open(true);
  await p.evaluate(() => {
    const st = window.Idioma.state, E = window.Idioma.Engine;
    for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 20)) {
      st.progress[id] = { ...E.freshProgress(), level: 2, timesSeen: 3, lastSeen: new Date().toISOString() };
    }
    st.settings.pace = 'gentle';
    window.Idioma.Store.saveNow(st);
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  for (let i = 0; i < 6 && await p.isVisible('#btn-got'); i++) { await p.click('#btn-got'); await p.waitForTimeout(150); }
  const band = await p.evaluate(() => window.__card && window.__card.band.key);
  ok('a recognition card has no microphone, the answer being English',
    band !== 'recognition' || await p.isHidden('#btn-mic'), band);
}

console.log('--- a browser that cannot ---');
{
  const p = await open(false);
  await startWrite(p);
  ok('the card still works', await p.isVisible('#answer'));
  ok('no microphone key at all', await p.isHidden('#btn-mic'));
  await p.click('#btn-menu'); await p.waitForTimeout(150);
  ok('and no note about one', await p.isHidden('#mic-note'));
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
