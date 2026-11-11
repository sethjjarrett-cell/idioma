/* Listen on a voice that behaves like Safari's at its worst.

   The stand-in here reproduces the three things that made Listen silent on
   an iPhone: an utterance handed over straight after a cancel is dropped, a
   voice can be listed and never start, and an engine can stop answering
   altogether. What it cannot reproduce is a real iPhone; this checks that
   the code copes with those behaviours, not that the phone will speak. */
import { chromium } from 'playwright';

let pass = 0, fail = 0, pe = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const SAFARI = (mode) => {
  window.__started = [];
  window.__dropped = 0;
  const voices = [
    { name: 'Paulina', lang: 'es-MX', localService: true },   // listed, never starts in "broken"
    { name: 'Mónica', lang: 'es-ES', localService: true },
  ];
  class U { constructor(t) { this.text = t; this.lang = ''; this.rate = 1; this.voice = null; this.volume = 1; } }
  let cancelledAt = -1e9;
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    speak(u) {
      if (!u.text.trim()) return;                                   // the unlock
      if (performance.now() - cancelledAt < 50) { window.__dropped++; return; }   // Safari's habit
      if (mode === 'dead') { this.pending = true; return; }
      if (mode === 'broken' && u.voice && u.voice.name === 'Paulina') { this.pending = true; return; }
      this.speaking = true;
      setTimeout(() => {
        window.__started.push({ text: u.text, voice: u.voice && u.voice.name, lang: u.lang });
        u.onstart && u.onstart();
        // Long enough that a second tap lands while it is still talking.
        setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 600);
      }, 10);
    },
    cancel() { cancelledAt = performance.now(); this.speaking = false; this.pending = false; },
    resume() {}, addEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function listenPage(mode) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 } });
  await ctx.addInitScript(SAFARI, mode);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  // Listening needs sentences in reach, so a learner some way in.
  await p.evaluate(() => {
    const st = window.Idioma.state, E = window.Idioma.Engine;
    for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, 80)) {
      st.progress[id] = { ...E.freshProgress(), level: 5, timesSeen: 5, lastSeen: new Date().toISOString() };
    }
    st.settings.mode = 'listen';
    window.Idioma.Store.saveNow(st);
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('#btn-start'); await p.waitForTimeout(300);
  return { ctx, p };
}
const started = (p) => p.evaluate(() => window.__started.slice());

console.log('--- play again while it is still talking ---');
{
  const { ctx, p } = await listenPage('ok');
  ok('the card plays as it arrives', (await started(p)).length === 1);
  await p.click('#btn-listen-play'); await p.waitForTimeout(400);
  ok('a second tap mid-sentence is heard, not swallowed', (await started(p)).length === 2,
    `${(await started(p)).length} started, ${await p.evaluate(() => window.__dropped)} dropped`);
  await p.click('#btn-listen-slow'); await p.waitForTimeout(400);
  ok('and so is Slower straight after', (await started(p)).length === 3);
  await ctx.close();
}

console.log('--- a voice that is listed and never starts ---');
{
  const { ctx, p } = await listenPage('broken');
  await p.waitForTimeout(2000);
  const s = await started(p);
  ok('it is tried again on the language alone, and plays', s.length === 1 && !s[0].voice && s[0].lang === 'es-CO',
    JSON.stringify(s));
  ok('without a message, because something was heard', await p.isHidden('#toast'));
  await ctx.close();
}

console.log('--- an engine that does nothing at all ---');
{
  const { ctx, p } = await listenPage('dead');
  await p.waitForTimeout(3500);
  ok('nothing pretends to have played', (await started(p)).length === 0);
  ok('and the learner is told what to try', /Nothing played/.test(await p.textContent('#toast'))
    && await p.isVisible('#toast'));
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerror =', pe);
await b.close();
process.exit(fail || pe ? 1 : 0);
