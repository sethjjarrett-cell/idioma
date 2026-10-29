/* Write it: whole sentences typed from English, basic to hard.

   The data: every item complete, three levels, and every word of every
   answer either in the bank (so it can be hinted and tapped) or glossed in
   the item itself. Then the marking, which has to be fair to a whole
   sentence: the subject pronoun may come or go, the listed alternatives
   pass, and a miss says where. Then the round, its levels, and old saves. */
import { chromium } from 'playwright';

let pass = 0, fail = 0;
const ok = (what, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok ' : '  !! '} ${what}${cond || !extra ? '' : '  ' + extra}`);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let pe = 0;
async function page(ctx) {
  const c = ctx || await b.newContext({ viewport: { width: 390, height: 760 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => { pe++; console.log('  !! PAGEERROR:', e.message); });
  await p.goto('file:///home/user/idioma/index.html');
  await p.waitForTimeout(300);
  return { c, p };
}
const card = (p) => p.evaluate(() => window.__card);
const answer = async (p, text) => { await p.fill('#answer', text); await p.click('#btn-submit'); await p.waitForTimeout(60); };

console.log('the data');
{
  const { c, p } = await page();
  const r = await p.evaluate(() => {
    const W = window.WRITING, E = window.Idioma.Engine, st = window.Idioma.state;
    const forms = window.Idioma.Store.sentenceIndex(st).forms;
    const NAMES = new Set(['sam', 'bogota', 'medellin', 'cali', 'cartagena', 'andres']);
    const levels = new Set(W.levels.map((l) => l.id));
    const ids = new Set(), dup = [], shape = [], loose = [], same = [];
    const per = {};
    for (const x of W.items) {
      if (ids.has(x.id)) dup.push(x.id); ids.add(x.id);
      per[x.level] = (per[x.level] || 0) + 1;
      if (!levels.has(x.level) || !x.context || !x.en || !x.es) shape.push(x.id);
      for (const a of x.alt || []) if (E.normalise(a) === E.normalise(x.es)) same.push(x.id);
      const own = new Set((x.help || []).map(([es]) => E.wordToken(es)));
      for (const t of E.tokenise(x.es)) {
        if (NAMES.has(t) || own.has(t)) continue;
        if (!E.wordForToken(t, forms)) loose.push(`${x.id}: ${t}`);
      }
    }
    // Basic is short; medium and hard differ more in grammar than in length.
    const avg = (lvl) => { const xs = W.items.filter((x) => x.level === lvl); return xs.reduce((n, x) => n + E.tokenise(x.es).length, 0) / xs.length; };
    return { per, dup, shape, loose, same, avg: [avg('basic'), avg('medium'), avg('hard')] };
  });
  ok('three levels, forty sentences each', JSON.stringify(r.per) === '{"basic":40,"medium":40,"hard":40}', JSON.stringify(r.per));
  ok('ids are unique, and every item has a level, a context, English and Spanish', !r.dup.length && !r.shape.length, r.dup.concat(r.shape).join(', '));
  ok('no alternative is the answer again', !r.same.length, r.same.join(', '));
  ok('every word is in the bank or glossed in the item', !r.loose.length, r.loose.join(' | '));
  ok(`and basic is shorter than the rest: ${r.avg.map((x) => x.toFixed(1)).join(', ')} words`, r.avg[0] < r.avg[1] && r.avg[0] < r.avg[2]);
  await c.close();
}

console.log('a round');
{
  const { c, p } = await page();
  await p.click('#modes [data-mode="write"]');
  ok('a mode of its own, with the levels as pills, Basic first', await p.isVisible('#filters')
    && (await p.textContent('#filter-label')) === 'Level'
    && (await p.textContent('#filter-pills .pill.on')).startsWith('Basic'));
  ok('the start screen says what it is', /typed out/.test(await p.textContent('#start-blurb')));
  await p.click('#btn-start'); await p.waitForTimeout(100);
  const r = await p.evaluate(() => ({ write: window.Idioma.round.write, n: window.Idioma.round.queue.length,
    levels: [...new Set(window.Idioma.round.queue.map((x) => x.level))] }));
  ok('a round of basic sentences, four new to begin with', r.write && r.n === 4 && r.levels.join() === 'basic', JSON.stringify(r));
  let k = await card(p);
  ok('the card shows the English and where you are', (await p.textContent('#card-prompt')).includes(k.item.en)
    && (await p.textContent('#card-hint')) === k.item.context);
  ok('labelled with its level, on the card and in the bar above it', /Write it · Basic/.test(await p.textContent('#card-band'))
    && /Write it · Basic/.test(await p.textContent('#picker-summary')));
  ok('always typed, never tiles', await p.isVisible('#answer') && await p.isHidden('#build'));
  ok('a fresh learner is shown the words they have not met', await p.isVisible('#card-help')
    && (await p.$$('#card-help .hchip')).length > 0);

  await answer(p, k.item.es);
  ok('the answer typed right is correct', (await p.textContent('#verdict-chip')) === 'Correct');
  ok('and it moves that sentence\'s own level', await p.evaluate((id) => window.Idioma.state.writing[id].level, k.item.id) === 2);
  ok('without touching any word', await p.evaluate(() => Object.keys(window.Idioma.state.progress).length) === 0);
  ok('no I know this, no memory hook, no chunk', await p.isHidden('#btn-sure') && await p.isHidden('#hook') && await p.isHidden('#verdict-chunk'));
  await p.click('#btn-next'); await p.waitForTimeout(60);

  k = await card(p);
  await answer(p, 'esto no es nada');
  ok('a wrong answer says where, word by word', (await p.textContent('#verdict-chip')) === 'Not quite'
    && await p.isVisible('#verdict-diff'));
  await p.click('#btn-override'); await p.waitForTimeout(60);
  ok('I was right remembers it for that sentence', await p.evaluate((id) => (window.Idioma.state.accepted[id] || {}).es, k.item.id)
    .then((x) => JSON.stringify(x) === '["esto no es nada"]'));
  await c.close();
}

console.log('marking a whole sentence');
{
  const { c, p } = await page();
  // Marked through the same function the card uses, against a named item.
  const mark = async (id, typed) => p.evaluate(([i, t]) => window.__writeMark(i, t), [id, typed]);
  await p.evaluate(() => {
    window.__writeMark = (id, typed) => {
      const item = window.WRITING.items.find((x) => x.id === id);
      window.Idioma.state.settings.writeLevel = item.level;
      return window.Idioma.markWrite(item, typed);
    };
  });
  const v = async (id, t) => (await mark(id, t));
  ok('the answer itself', (await v('wb23', '¿Habla inglés?')).correct);
  ok('with the subject pronoun added', (await v('wb23', '¿Usted habla inglés?')).correct);
  ok('with it taken away', (await v('wb30', 'Es mi amiga.')).correct);
  ok('accents, capitals and punctuation do not count', (await v('wb12', 'no entiendo mas despacio por favor')).correct);
  ok('a listed alternative passes', (await v('wm28', 'El bus no vino, así que caminé.')).correct);
  ok('one letter out is amber', (await v('wb08', 'No como carme.')).almost);
  ok('a different sentence is wrong, with a diff', await mark('wb08', 'Me gusta la carne.').then((x) => !x.correct && !x.almost && !!x.diff));
  await c.close();
}

console.log('levels and old saves');
{
  const { c, p } = await page();
  await p.click('#modes [data-mode="write"]');
  await p.click('#filter-pills [data-value="hard"]');
  await p.click('#btn-start'); await p.waitForTimeout(80);
  ok('Hard draws hard sentences', await p.evaluate(() => window.Idioma.round.queue.every((x) => x.level === 'hard')));
  const k = await card(p);
  ok('and shows glosses for what the bank lacks', !(k.item.help || []).length
    || (await p.textContent('#card-help')).includes(k.item.help[0][1]));
  await c.close();
}
{
  const ctx = await b.newContext();
  const { p } = await page(ctx);
  const old = {
    version: 1, savedAt: '2026-09-01T10:00:00.000Z', settings: { mode: 'sentences', roundSize: 15 },
    progress: { mesa: { level: 6, correctStreak: 2, totalCorrect: 9, totalWrong: 2, lastSeen: '2026-09-01T10:00:00.000Z', timesSeen: 11, lapses: 0, enabled: true } },
    phrases: { p001: { level: 3, timesSeen: 2 } }, customWords: [], customSentences: [], editedWords: {},
    stats: { rounds: 12, lastRoundAt: '2026-09-01T10:00:00.000Z' },
  };
  await p.evaluate((s) => localStorage.setItem('idioma.state.v1', JSON.stringify(s)), old);
  await p.close({ runBeforeUnload: false });
  const { p: q } = await page(ctx);
  const st = await q.evaluate(() => window.Idioma.state);
  ok('a save from before Write it keeps its progress', st.progress.mesa.level === 6 && st.phrases.p001.level === 3 && st.settings.mode === 'sentences');
  ok('and starts with an empty book on Basic', JSON.stringify(st.writing) === '{}' && st.settings.writeLevel === 'basic');
  await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('idioma.state.v1')); s.writing = { wb01: { level: 4 }, wb02: 'broken' }; localStorage.setItem('idioma.state.v1', JSON.stringify(s)); });
  await q.close({ runBeforeUnload: false });
  const { p: r } = await page(ctx);
  const w = await r.evaluate(() => window.Idioma.state.writing);
  ok('a hand-edited book keeps the good rows, filled out', Object.keys(w).join() === 'wb01' && w.wb01.level === 4 && w.wb01.timesSeen === 0);
  const m = await r.evaluate(() => {
    const S = window.Sync;
    const base = { savedAt: '2026-10-01T00:00:00Z', settings: {}, progress: {}, phrases: {}, customWords: [], customSentences: [], editedWords: {}, accepted: {}, stats: { rounds: 1, lastRoundAt: null } };
    const a = { ...base, writing: { wb01: { level: 5, lastSeen: '2026-10-02T00:00:00Z', timesSeen: 3 } } };
    return { none: !('writing' in S.merge(base, base)), kept: S.merge(base, a).writing.wb01.level };
  });
  ok('sync: old saves gain nothing, and a sentence\'s row survives', m.none && m.kept === 5);
  await ctx.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
