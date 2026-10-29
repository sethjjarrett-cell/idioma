/* Chunks: the short everyday phrase each common word lives in.

   The data is checked the way the sentence bank is: the braced form has to
   be a form of the word it is filed under, and every other word in the
   phrase has to be one the bank knows, so tapping any of it explains it.
   Then the page: the teaching card leads with the chunk, and the verdict
   shows it once the word has been answered. */
import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page() {
  const c = await b.newContext({ viewport: { width: 390, height: 760 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  return { c, p };
}

console.log('the data');
{
  const { c, p } = await page();
  const r = await p.evaluate(() => {
    const st = window.Idioma.state, Store = window.Idioma.Store, E = window.Idioma.Engine;
    const words = new Map(Store.allWords(st).map((w) => [w.id, w]));
    const ids = new Set(words.keys());
    const forms = Store.sentenceIndex(st).forms;
    /* Forms nothing else can build, checked by hand: tercer is tercero
       shortened before a masculine noun. */
    const IRREGULAR = ['tercer'];
    const unknownId = [], badShape = [], wrongForm = [], loose = [];
    for (const [id, v] of Object.entries(window.CHUNKS)) {
      if (!ids.has(id)) { unknownId.push(id); continue; }
      if (!Array.isArray(v) || v.length !== 2 || !v[1] || (v[0].match(/\{/g) || []).length !== 1) { badShape.push(id); continue; }
      const braced = /\{([^}]+)\}/.exec(v[0])[1];
      // Against this word's own forms, not the shared index: there a form
      // goes to whichever word is taught first, so vemos reads as nos vemos.
      const w = words.get(id);
      const own = new Map(E.formsOfWord(w, (wid) => Store.allSentences(st).filter((s) => s.wordId === wid),
        Store.verbForms).map((f) => [f, id]));
      const whole = E.wordToken(braced);
      if (!IRREGULAR.includes(whole) && !(own.has(whole) || E.tokenise(braced).some((t) => E.wordForToken(t, own) === id))) {
        wrongForm.push(`${id}: {${braced}}`);
      }
      for (const t of E.tokenise(v[0])) if (!E.wordForToken(t, forms)) loose.push(`${id}: ${t}`);
    }
    return { n: Object.keys(window.CHUNKS).length, unknownId, badShape, wrongForm, loose };
  });
  ok(`every chunk is filed under a real word (${r.n})`, r.unknownId.length === 0, r.unknownId.join(', '));
  ok('each is [spanish, english] with exactly one braced form', r.badShape.length === 0, r.badShape.join(', '));
  ok('the braced form is a form of that word', r.wrongForm.length === 0, r.wrongForm.join(' | '));
  ok('every other word is in the bank, so it can be tapped', r.loose.length === 0, r.loose.join(' | '));
  const early = await p.evaluate(() => {
    const words = new Map(window.Idioma.Store.allWords(window.Idioma.state).map((w) => [w.id, w]));
    return window.TeachingOrder.TEACHING_ORDER.slice(0, 300)
      .filter((id) => { const w = words.get(id);
        // A set phrase is a chunk already; past ten, a number is just a number.
        return w && w.pos !== 'phrase' && w.pos !== 'number' && !/\s/.test(w.es) && !window.CHUNKS[id]; });
  });
  ok('the first 300 words taught all have one, set phrases aside', early.length === 0, early.join(', '));
  await c.close();
}

console.log('on the cards');
{
  const { c, p } = await page();
  // A fresh learner: tener is the third word taught.
  await p.click('#btn-start'); await p.waitForTimeout(150);
  let k = await p.evaluate(() => window.__card);
  for (let i = 0; i < 20 && !(k.intro && k.word.id === 'tener'); i++) {
    if (k.intro) await p.click('#btn-got');
    else {
      if (await p.isVisible('#answer')) { await p.fill('#answer', k.accepted[0]); await p.click('#btn-submit'); }
      await p.click('#btn-next');
    }
    await p.waitForTimeout(50);
    k = await p.evaluate(() => window.__card);
  }
  ok('the teaching card for tener leads with tengo hambre', k.intro && await p.isVisible('#teach-chunk')
    && (await p.textContent('#teach-chunk-es')).trim() === 'tengo hambre'
    && (await p.textContent('#teach-chunk-en')) === "I'm hungry");
  ok('with the form picked out', (await p.textContent('#teach-chunk-es b')) === 'tengo');
  ok('and every word of it tappable', (await p.$$('#teach-chunk-es .tap')).length === 2);
  const order = await p.evaluate(() => {
    const a = document.getElementById('teach-chunk'), b = document.getElementById('teach-note');
    return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok('above the note', order);
  await p.click('#btn-got'); await p.waitForTimeout(80);
  await p.fill('#answer', 'zzz'); await p.click('#btn-submit'); await p.waitForTimeout(80);
  ok('the verdict shows it in use', await p.isVisible('#verdict-chunk')
    && /tengo hambre/.test(await p.textContent('#verdict-chunk-es')));
  await c.close();
}
{
  const { c, p } = await page();
  await p.click('#modes [data-mode="grammar"]');
  await p.click('#btn-start'); await p.waitForTimeout(100);
  const k = await p.evaluate(() => window.__card);
  await p.click(`#choices [data-choice="${k.options[0]}"]`); await p.waitForTimeout(60);
  ok('a grammar question has no chunk line', await p.isHidden('#verdict-chunk'));
  await c.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
