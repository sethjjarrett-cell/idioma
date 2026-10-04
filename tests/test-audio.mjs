/* Reading aloud, and listening rounds.

   The browser's voice is replaced with one that writes down what it was asked
   to say, so the test can check what is read, when, at what speed and in
   which voice. What it cannot check is how it sounds, which is the phone's
   business.

   The rule being tested: Spanish is read once, when it first appears. A card
   that shows Spanish reads it as the card arrives; a card that asks for
   Spanish reads nothing until the verdict, because reading it first would be
   giving the answer away. */
import { chromium } from 'playwright';

const URL_ = 'file:///home/user/idioma/index.html';
let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

const FAKE_VOICE = () => {
  window.__spoken = [];
  window.__voices = [
    { name: 'Daniel', lang: 'en-GB', localService: true },
    { name: 'Mónica', lang: 'es-ES', localService: true },
    { name: 'Paulina', lang: 'es-MX', localService: true },
  ];
  class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; }
  }
  const synth = {
    speaking: false, pending: false,
    getVoices: () => window.__voices,
    speak(u) {
      window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name });
      setTimeout(() => u.onend && u.onend(), 0);
    },
    cancel() {},
    addEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = FakeUtterance;
};
const NO_VOICE = () => {
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  window.SpeechSynthesisUtterance = undefined;
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page(init, viewport = { width: 390, height: 760 }) {
  const ctx = await b.newContext({ viewport });
  await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto(URL_);
  await p.waitForTimeout(300);
  return { ctx, p };
}
const spoken = (p) => p.evaluate(() => window.__spoken.slice());
const lastSaid = async (p) => { const s = await spoken(p); return s[s.length - 1] || null; };
const said = async (p) => (await spoken(p)).length;
const card = (p) => p.evaluate(() => window.__card);
/* Every word in the teaching order up to n met, at one level, so the cards
   a round draws are all in the band that level is in. */
const seed = (p, n, level) => p.evaluate(([count, lv]) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: lv, timesSeen: 6,
      lastSeen: new Date(Date.now() - 30 * 864e5).toISOString() };
  }
  window.Idioma.Store.saveNow(st);
}, [n, level]);
const setMode = (p, m) => p.evaluate((mode) => {
  window.Idioma.state.settings.mode = mode; window.Idioma.Store.saveNow(window.Idioma.state);
}, m);
const answer = async (p, text) => { await p.fill('#answer', text); await p.click('#btn-submit'); await p.waitForTimeout(80); };
/* Step through a round until a card of the wanted band turns up, and report
   how much had been read out just before it arrived, so the test can tell
   what the card itself said on arrival. A round always opens with whatever
   new words are allowed, so the wanted band is rarely the first card. */
async function untilBand(p, key) {
  for (let i = 0; i < 40; i++) {
    const c = await card(p);
    if (c && c.band.key === key) return { c, before: null };
    const before = await said(p);
    if (!c || await p.isVisible('#btn-again')) { await p.click('#btn-again'); }
    else if (c.intro) { await p.click('#btn-got'); }
    else {
      if (await p.isVisible('#build')) await p.click('#btn-build-check').catch(() => {});
      else await answer(p, 'x');
      await p.click('#btn-next');
    }
    await p.waitForTimeout(80);
    const next = await card(p);
    if (next && next.band.key === key && await p.isHidden('#verdict')) return { c: next, before };
  }
  return { c: null, before: null };
}

console.log('the voice');
{
  const { ctx, p } = await page(FAKE_VOICE);
  ok('Mexican is preferred over Spain', await p.evaluate(() => window.Speech.pickVoice().name) === 'Paulina');
  await p.evaluate(() => { window.__voices.push({ name: 'Ximena', lang: 'es_CO', localService: true }); window.Speech.reload(); });
  ok('and Colombian over both, even written es_CO', await p.evaluate(() => window.Speech.pickVoice().name) === 'Ximena');
  await p.evaluate(() => { window.__voices.splice(0, window.__voices.length, { name: 'Daniel', lang: 'en-GB' }); window.Speech.reload(); });
  ok('with no Spanish voice it still asks for Spanish by language',
    await p.evaluate(() => { window.Speech.say('hola'); return window.__spoken.pop().lang; }) === 'es-CO');
  await p.click('#btn-menu');
  ok('and the menu says how to add one', /Spoken Content/.test(await p.textContent('#audio-blurb')));
  ok('braces and blanks are not read out',
    await p.evaluate(() => { window.Speech.say('Tengo {hambre} _____.'); return window.__spoken.pop().text; }) === 'Tengo hambre .');
  await ctx.close();
}

console.log('a new word, then the same word asked');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await p.click('#btn-start');
  await p.waitForTimeout(200);
  const c = await card(p);
  ok('the first card teaches a word', !!c.intro);
  let last = await lastSaid(p);
  ok('and reads it as it arrives', last && last.text === c.word.es, JSON.stringify(last));
  ok('in the chosen voice, a little under normal speed', last && last.voice === 'Paulina' && last.rate === 0.85);
  ok('the word has a speaker beside it', await p.getAttribute('#card-prompt .say-btn', 'data-say') === c.word.es);
  if (await p.isVisible('#btn-say-example')) {
    await p.click('#btn-say-example');
    last = await lastSaid(p);
    ok('the example sentence reads out whole', last.text === c.example.es);
  }
  await p.click('#btn-got');
  await p.waitForTimeout(150);
  const asked = await card(p);
  ok('then it is asked: Spanish shown, so it is read', asked.band.key === 'recognition'
    && (await lastSaid(p)).text === asked.word.es);
  const before = await said(p);
  await answer(p, 'definitely not it');
  ok('and not read again at the verdict', await said(p) === before);
  ok('though the verdict can play it', await p.getAttribute('#btn-say-answer', 'data-say') === asked.word.es
    && await p.isVisible('#btn-say-answer'));
  await ctx.close();
}

console.log('a card that asks for Spanish says nothing until it is answered');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await seed(p, 60, 5);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const { c, before } = await untilBand(p, 'production');
  ok('a production card', !!c && c.band.key === 'production');
  ok('reads nothing as it arrives', before !== null && await said(p) === before);
  ok('has no speaker on the English prompt', await p.$('#card-prompt .say-btn') === null);
  await answer(p, 'zzz');
  ok('and reads the Spanish at the verdict', (await lastSaid(p) || {}).text === c.reveal);
  await ctx.close();
}
{
  const { ctx, p } = await page(FAKE_VOICE);
  await seed(p, 60, 9);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const { c, before } = await untilBand(p, 'cloze');
  ok('a cloze card', !!c && c.band.key === 'cloze');
  ok('reads nothing, since the sentence holds the answer', before !== null && await said(p) === before);
  await answer(p, 'zzz');
  ok('and reads the whole sentence at the verdict, not just the word',
    (await lastSaid(p) || {}).text === c.revealContext.replace(/\s+/g, ' ').trim());
  await ctx.close();
}

console.log('a verb drill');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await setMode(p, 'verbs');
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const c = await card(p);
  ok('reads the infinitive it shows', (await lastSaid(p) || {}).text === c.prompt);
  await answer(p, 'zzz');
  ok('and the conjugated answer at the verdict, which is new Spanish',
    (await lastSaid(p) || {}).text === c.reveal && c.reveal !== c.prompt);
  await ctx.close();
}

console.log('reading aloud switched off');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await seed(p, 60, 2);
  await p.click('#btn-menu');
  await p.uncheck('#set-audio');
  await p.click('#btn-menu');
  ok('the choice is kept on this device', await p.evaluate(() =>
    JSON.parse(localStorage.getItem('idioma.audio.v1')).auto === false));
  ok('and not in the synced settings', await p.evaluate(() =>
    !JSON.stringify(window.Idioma.state.settings).includes('auto')));
  await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__spoken.length = 0; });
  await p.click('#btn-start'); await p.waitForTimeout(200);
  ok('a Spanish card arrives in silence', await said(p) === 0);
  await p.click('#card-prompt .say-btn');
  ok('but the speaker still plays it', await said(p) === 1);
  await answer(p, 'zzz');
  ok('and the verdict stays quiet too', await said(p) === 1);
  await ctx.close();
}

console.log('tapping a speaker keeps the keyboard up');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await seed(p, 60, 2);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  await p.focus('#answer');
  await p.click('#card-prompt .say-btn');
  ok('the answer box still has the focus', await p.evaluate(() => document.activeElement.id === 'answer'));
  await ctx.close();
}

console.log('listening, with nothing learned yet');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await setMode(p, 'listen');
  await p.reload(); await p.waitForTimeout(300);
  ok('the mode is offered', await p.isVisible('#modes [data-mode="listen"]'));
  ok('and says there is nothing yet', /Nothing to listen to yet/.test(await p.textContent('#start-blurb')));
  await p.click('#btn-start'); await p.waitForTimeout(150);
  ok('so a round does not start', await p.evaluate(() => window.Idioma.round === null));
  await ctx.close();
}

console.log('a listening round');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await seed(p, 250, 2);
  await setMode(p, 'listen');
  await p.reload(); await p.waitForTimeout(300);
  ok('the blurb counts what can be heard', /sentences you have the words for/.test(await p.textContent('#start-blurb')));
  const book = () => p.evaluate(() => JSON.stringify([window.Idioma.state.progress,
    window.Idioma.state.phrases, window.Idioma.state.stats]));
  const before = await book();
  const stored = await p.evaluate(() => localStorage.getItem('idioma.state.v1'));
  await p.click('#btn-start'); await p.waitForTimeout(200);

  let c = await card(p);
  ok('the card is a listening card', !!c.listen && c.band.key === 'listen');
  ok('it plays as it arrives', (await lastSaid(p) || {}).text === c.reveal);
  ok('with nothing of the answer written on it', !(await p.innerText('#card')).includes(c.reveal));
  ok('it says how many words to listen for',
    new RegExp(`Type what you hear · ${c.reveal.split(/\s+/).length} word`).test(await p.textContent('#card-hint')));
  ok('the accent keys are there, since the answer is Spanish', await p.isVisible('#accents'));
  await p.click('#btn-listen-slow');
  ok('Slower plays it again, slowly', (await lastSaid(p)).rate === 0.55 && (await lastSaid(p)).text === c.reveal);
  await p.click('#btn-listen-play');
  ok('and Play at the usual speed', (await lastSaid(p)).rate === 0.85);

  // Typed without accents, capitals or punctuation, the way a phone types.
  const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿¡?!.,]/g, '').toLowerCase();
  await answer(p, plain(c.reveal));
  ok('typed back without accents, it is right', (await p.textContent('#verdict-chip')) === 'Correct');
  const n = c.reveal.split(/\s+/).length;
  ok('and says all of it came through', (await p.textContent('#verdict-detail')).startsWith(`${n} of ${n}`));
  ok('the English appears at the verdict', (await p.textContent('#verdict-en')) === c.revealContext
    && await p.isVisible('#verdict-en'));
  ok('the Spanish plays once more with the words in view', (await lastSaid(p)).text === c.reveal);
  ok('there is no I was right, since nothing is being scored', await p.isHidden('#btn-override'));

  // Find a card long enough to drop a word from and still be close.
  let tries = 0;
  do {
    await p.click('#btn-next'); await p.waitForTimeout(120);
    c = await card(p); tries++;
    if (!c || c.reveal.split(/\s+/).length >= 4) break;
    await answer(p, 'x');
  } while (tries < 10);
  if (c && c.reveal.split(/\s+/).length >= 4) {
    const parts = c.reveal.split(/\s+/);
    await answer(p, parts.slice(0, -1).join(' '));
    ok('one word missed is almost', (await p.textContent('#verdict-chip')) === 'Almost');
    ok('and says how much came through', (await p.textContent('#verdict-detail'))
      .startsWith(`${parts.length - 1} of ${parts.length}`));
    ok('with the missing word marked', await p.isVisible('#verdict-diff ins'));
    const n0 = await said(p);
    await p.click('#btn-retry'); await p.waitForTimeout(100);
    ok('a second go plays it again', await said(p) === n0 + 1);
    await answer(p, 'nada que ver con nada');
  }
  ok('nothing like it is a miss, with the words it wanted shown',
    (await p.textContent('#verdict-chip')) !== 'Correct' && await p.isVisible('#verdict-diff'));

  // Through to the end of the round.
  for (let i = 0; i < 12 && await p.isVisible('#btn-next'); i++) {
    await p.click('#btn-next'); await p.waitForTimeout(100);
    if (await p.isVisible('#answer')) await answer(p, 'x');
  }
  ok('the round ends', await p.isVisible('#round-end'));
  ok('and says it was practice', /Listening is practice/.test(await p.textContent('#end-movers')));
  ok('no level, no sentence and no round count moved', await book() === before);
  ok('and nothing was written to storage', await p.evaluate(() => localStorage.getItem('idioma.state.v1')) === stored);
  await ctx.close();
}

console.log('marking what was heard');
{
  const { ctx, p } = await page(FAKE_VOICE);
  const r = (typed, said, opts) => p.evaluate(([t, s, o]) => {
    const x = window.Idioma.Engine.checkHeard(t, s, o || {});
    return { correct: x.correct, almost: x.almost, near: x.near, heard: x.heard, of: x.of };
  }, [typed, said, opts]);
  let x = await r('como estas', '¿Cómo estás?');
  ok('accents and question marks do not count', x.correct && x.heard === 2 && x.of === 2);
  x = await r('donde esta el bano', '¿Dónde está el baño?');
  ok('the right words, typed plainly, are right', x.correct);
  x = await r('donde esta el', '¿Dónde está el baño?');
  ok('one word in four missing is almost', x.almost && !x.correct && x.heard === 3);
  x = await r('donde el', '¿Dónde está el baño?');
  ok('two missing is not', !x.almost && !x.correct && x.heard === 2);
  x = await r('meza', 'mesa');
  ok('one letter out on a single word is almost', x.almost);
  x = await r('meza', 'mesa', { typoTolerance: true });
  ok('and with typo tolerance on, it passes', x.correct && x.near);
  x = await r('', 'mesa');
  ok('nothing typed is a miss', !x.correct && !x.almost && x.of === 1);
  await ctx.close();
}

console.log('the lessons read themselves');
{
  const { ctx, p } = await page(FAKE_VOICE);
  await p.click('[data-screen="lessons"]');
  await p.click('#verb-tenses details summary');
  const cell = p.locator('#verb-tenses td[data-say]').first();
  const form = await cell.getAttribute('data-say');
  await cell.click();
  ok('tapping a form in a table reads it', (await lastSaid(p) || {}).text === form, form);
  await p.click('#pron-rules details summary');
  const ex = p.locator('#pron-rules .example b[data-say]').first();
  const word = await ex.getAttribute('data-say');
  await ex.click();
  ok('and so does a pronunciation example', (await lastSaid(p)).text === word);
  await ctx.close();
}

console.log('a listening card on a phone');
{
  const { ctx, p } = await page(FAKE_VOICE, { width: 390, height: 660 });
  await seed(p, 250, 2);
  await setMode(p, 'listen');
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(200);
  const bottom = await p.evaluate(() => Math.round(document.getElementById('btn-submit').getBoundingClientRect().bottom));
  ok(`Check is on screen without scrolling (${bottom}px of 660)`, bottom <= 660);
  ok('and the pickers have folded away', await p.isHidden('#modes'));
  await ctx.close();
}

console.log('a browser with no voice at all');
{
  const { ctx, p } = await page(NO_VOICE);
  ok('Listen is not offered', await p.isHidden('#modes [data-mode="listen"]'));
  await setMode(p, 'listen');
  await p.reload(); await p.waitForTimeout(300);
  ok('a saved choice of it falls back to words', await p.evaluate(() =>
    document.querySelector('#modes .mode.on').dataset.mode) === 'words');
  await p.click('#btn-start'); await p.waitForTimeout(200);
  ok('words still work', await p.isVisible('#card'));
  ok('with no speaker buttons anywhere', await p.$$eval('.say-btn', (els) => els.filter((e) => e.offsetParent).length) === 0);
  await p.click('#btn-menu');
  ok('and the setting says why it is off', await p.isDisabled('#set-audio')
    && /cannot read Spanish aloud/.test(await p.textContent('#audio-blurb')));
  await p.click('#btn-menu');
  await p.click('[data-screen="lessons"]');
  ok('the lesson tables are not tappable', await p.$('#verb-tenses td[data-say]') === null);
  ok('and do not claim to be', await p.isHidden('.say-hint >> nth=0'));
  await ctx.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
