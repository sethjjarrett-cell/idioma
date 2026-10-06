/* Today's session and memory hooks, the two new things the saved state keeps.

   The session is a chain of ordinary rounds, so what matters is the order,
   that each step really is the round it claims to be, that finishing counts
   once a day, and that a missed day starts the streak again. Hooks are the
   learner's own words, so the part worth being strict about is that they are
   kept: across a reload, through a sync with a device that has none, and
   when a save from before either existed is loaded. */
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
const seed = (p, n, lv, extra = {}) => p.evaluate(([count, l, x]) => {
  const st = window.Idioma.state, E = window.Idioma.Engine;
  for (const id of window.TeachingOrder.TEACHING_ORDER.slice(0, count)) {
    st.progress[id] = { ...E.freshProgress(), level: l, timesSeen: 6,
      lastSeen: new Date(Date.now() - 30 * 864e5).toISOString(), ...x };
  }
  window.Idioma.Store.saveNow(st);
}, [n, lv, extra]);
const answer = async (p, text) => { await p.fill('#answer', text); await p.click('#btn-submit'); await p.waitForTimeout(60); };

/* Answer every card of the round in front of you, right or wrong. */
async function playRound(p, right = true) {
  for (let i = 0; i < 60 && await p.isHidden('#round-end'); i++) {
    const k = await card(p);
    if (k.intro) await p.click('#btn-got');
    else if (k.grammar) { await p.click(`#choices [data-choice="${right ? k.answer : k.options.find((o) => o !== k.answer)}"]`); await p.click('#btn-next'); }
    else if (await p.isVisible('#build')) {
      // The sentence's own tiles are keyed w0, w1... in order; the rest are decoys.
      const keys = k.tiles.map((t) => t.key).filter((x) => /^w\d+$/.test(x))
        .sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
      for (const key of right ? keys : keys.slice(0, 1)) await p.click(`#build-tray .tile[data-key="${key}"]`);
      await p.click('#btn-build-check'); await p.click('#btn-next');
    } else {
      await answer(p, right ? (k.accepted ? k.accepted[0] : k.reveal) : 'zzz');
      await p.click('#btn-next');
    }
    await p.waitForTimeout(40);
  }
}

console.log("today's session");
{
  const { c, p } = await page();
  await seed(p, 120, 3);
  await p.reload(); await p.waitForTimeout(300);
  ok('the start screen leads with it', await p.isVisible('#btn-today')
    && (await p.textContent('#btn-today')) === "Today's session"
    && await p.evaluate(() => document.getElementById('btn-today').classList.contains('primary')));
  ok('and says what is in it', /grammar questions/.test(await p.textContent('#today-blurb')));
  // Free-practice filters must not leak into the session.
  await p.click('#modes [data-mode="verbs"]');
  await p.click('#btn-today'); await p.waitForTimeout(100);
  let r = await p.evaluate(() => ({ drill: window.Idioma.round.drill, today: window.Idioma.round.today, grammar: !!window.Idioma.round.grammar }));
  ok('step one is a real words round, whatever mode was picked', r.today && !r.drill && !r.grammar);
  ok('the card says where in the session you are', /today 1 of 3/.test(await p.textContent('#card-band')));
  const rounds = await p.evaluate(() => window.Idioma.state.stats.rounds);
  await playRound(p, false);
  ok('it ends like a round and offers the next step', await p.isVisible('#btn-today-next')
    && /grammar \(2 of 3\)/.test(await p.textContent('#btn-today-next')));
  ok('with no Another round to wander off into', await p.isHidden('#btn-again'));
  ok('and counts as a round', await p.evaluate(() => window.Idioma.state.stats.rounds) === rounds + 1);
  ok('one step ticked', (await p.$$('#today-steps .tstep.done')).length === 1);
  // A second look in the middle keeps your place.
  await p.click('#btn-review'); await p.waitForTimeout(80);
  await playRound(p, true);
  ok('after a second look, the next step is still on offer', await p.isVisible('#btn-today-next')
    && /grammar/.test(await p.textContent('#btn-today-next')));
  await p.click('#btn-today-next'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ grammar: !!window.Idioma.round.grammar, n: window.Idioma.round.queue.length }));
  ok('step two is grammar, six questions', r.grammar && r.n === 6, JSON.stringify(r));
  await playRound(p, true);
  ok('grammar answers are recorded as in any grammar round', await p.evaluate(() => Object.keys(window.Idioma.state.grammar).length) >= 1);
  await p.click('#btn-today-next'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ s: !!window.Idioma.round.sentences, l: !!window.Idioma.round.listen }));
  ok('step three is sentences, with this many words met', r.s, JSON.stringify(r));
  ok('not done until the last step is', await p.evaluate(() => window.Idioma.state.stats.todayLast) === null);
  await playRound(p, true);
  const day = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const st = await p.evaluate(() => window.Idioma.state.stats);
  ok('finishing marks today done, streak of one', st.todayLast === day && st.todayStreak === 1, JSON.stringify(st));
  ok('and says so', /Today's session done/.test(await p.textContent('#today-steps')) && await p.isHidden('#btn-today-next')
    && await p.isVisible('#btn-again'));
  await p.click('#btn-again'); await p.waitForTimeout(80);
  ok('Another round is free practice again', await p.evaluate(() => window.Idioma.today) === null);
  await p.reload(); await p.waitForTimeout(300);
  ok('back on the start screen it reads as done', (await p.textContent('#btn-today')) === "Today's session again"
    && /Done for today/.test(await p.textContent('#today-blurb')));
  await c.close();
}

console.log('the streak');
{
  const { c, p } = await page();
  const run = (last, streak) => p.evaluate(([l, s]) => {
    const st = window.Idioma.state;
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    st.stats.todayLast = l === null ? null : d(l);
    st.stats.todayStreak = s;
    window.Idioma.Store.saveNow(st);
  }, [last, streak]);
  async function finish() {
    await p.reload(); await p.waitForTimeout(250);
    await p.click('#btn-today'); await p.waitForTimeout(60);
    for (let i = 0; i < 3 && await p.evaluate(() => !(window.Idioma.today || {}).finished); i++) {
      await playRound(p, true);
      if (await p.isVisible('#btn-today-next')) { await p.click('#btn-today-next'); await p.waitForTimeout(60); }
    }
    return p.evaluate(() => window.Idioma.state.stats.todayStreak);
  }
  await run(-1, 4);
  ok('done yesterday: the streak goes on', await finish() === 5);
  await run(-3, 4);
  ok('a day missed: it starts again', await finish() === 1);
  await run(0, 2);
  ok('done already today: going again does not count twice', await finish() === 2);
  await run(-1, 6);
  await p.reload(); await p.waitForTimeout(250);
  ok('the start screen mentions a live streak', /6 days running/.test(await p.textContent('#today-blurb')));
  await c.close();
}

console.log('memory hooks');
{
  const { c, p } = await page();
  await seed(p, 40, 5);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(100);
  let k = await card(p);
  if (k.intro) { await p.click('#btn-got'); k = await card(p); }
  await answer(p, k.accepted[0]);
  ok('right, and no hook yet: nothing offered', await p.isHidden('#hook'));
  await p.click('#btn-next'); await p.waitForTimeout(60);
  k = await card(p);
  if (k.intro) { await p.click('#btn-got'); k = await card(p); }
  await answer(p, 'zzz');
  ok('missed: a hook is offered', await p.isVisible('#btn-hook')
    && (await p.textContent('#btn-hook')) === 'Make a memory hook');
  await p.click('#btn-hook');
  ok('which opens a box to write it in, with an example', await p.isVisible('#hook-input')
    && /cobija/.test(await p.textContent('#hook-edit')) && await p.evaluate(() => document.activeElement.id === 'hook-input'));
  const idx = await p.evaluate(() => window.Idioma.round.index);
  await p.fill('#hook-input', 'a daft picture');
  await p.press('#hook-input', 'Enter');
  ok('Enter in the box does not move on', await p.evaluate(() => window.Idioma.round.index) === idx && await p.isVisible('#hook-input'));
  await p.fill('#hook-input', 'a daft picture');
  await p.click('#btn-hook-save'); await p.waitForTimeout(250);
  const saved = await p.evaluate((id) => window.Idioma.state.hooks[id], k.word.id);
  ok('saved against the word, with a time', saved && saved.text === 'a daft picture' && !!saved.at);
  ok('and shown', /Your hook: a daft picture/.test(await p.textContent('#hook-text'))
    && (await p.textContent('#btn-hook')) === 'Change hook');
  await p.reload(); await p.waitForTimeout(300);
  ok('it survives a reload', await p.evaluate((id) => window.Idioma.Store.hookFor(window.Idioma.state, id), k.word.id) === 'a daft picture');

  // Shown when the word comes round again, even answered right.
  await p.evaluate((id) => { window.Idioma.state.progress = { [id]: { ...window.Idioma.state.progress[id], lastSeen: new Date(0).toISOString() } }; window.Idioma.Store.saveNow(window.Idioma.state); }, k.word.id);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(100);
  for (let i = 0; i < 20; i++) {
    const x = await card(p);
    if (x.word && x.word.id === k.word.id && !x.intro) break;
    if (x.intro) await p.click('#btn-got'); else { await answer(p, 'zzz'); await p.click('#btn-next'); }
    await p.waitForTimeout(40);
  }
  const again = await card(p);
  await answer(p, again.accepted[0]);
  ok('the next time the word comes up, right or wrong, the hook is there', again.word.id === k.word.id
    && await p.isVisible('#hook-text') && /a daft picture/.test(await p.textContent('#hook-text')));

  await p.click('#btn-hook');
  await p.fill('#hook-input', '');
  await p.click('#btn-hook-save'); await p.waitForTimeout(100);
  const cleared = await p.evaluate((id) => window.Idioma.state.hooks[id], k.word.id);
  ok('emptied, it is cleared but the row stays so the deletion syncs', cleared && cleared.text === '' && !!cleared.at
    && await p.isHidden('#hook-text'));
  await c.close();
}
{
  const { c, p } = await page();
  await seed(p, 40, 5, { lapses: 3 });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-sticking-start'); await p.waitForTimeout(100);
  let k = await card(p);
  if (k.intro) {
    ok('a word being taught again shows no hook line when it has none', await p.isHidden('#teach-hook'));
    await p.click('#btn-got'); k = await card(p);
  }
  await answer(p, 'zzz');
  ok('a word that keeps going wrong says so on the button', /^Missed \d+ times: make a memory hook$/.test(await p.textContent('#btn-hook')),
    await p.textContent('#btn-hook'));
  await c.close();
}
{
  const { c, p } = await page();
  await p.evaluate(() => { window.Idioma.Store.setHook(window.Idioma.state, 'ser', 'a hook for ser'); window.Idioma.Store.saveNow(window.Idioma.state); });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#btn-start'); await p.waitForTimeout(100);
  const k = await card(p);
  ok('the teaching card shows a hook the word already has', k.intro && k.word.id === 'ser'
    && /a hook for ser/.test(await p.textContent('#teach-hook')) && await p.isVisible('#teach-hook'));
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#modes [data-mode="grammar"]');
  await p.click('#btn-start'); await p.waitForTimeout(80);
  const g = await card(p);
  await p.click(`#choices [data-choice="${g.options.find((o) => o !== g.answer)}"]`);
  ok('a grammar question offers no hook', await p.isHidden('#hook'));
  await c.close();
}

console.log('a save from before any of this');
{
  const ctx = await b.newContext();
  const { p } = await page(ctx);
  const old = {
    version: 1, savedAt: '2026-09-01T10:00:00.000Z',
    settings: { typoTolerance: false, introduceNew: true, roundSize: 15, mode: 'words' },
    progress: { mesa: { level: 6, correctStreak: 2, totalCorrect: 9, totalWrong: 2, lastSeen: '2026-09-01T10:00:00.000Z', timesSeen: 11, lapses: 0, enabled: true } },
    phrases: {}, customWords: [], customSentences: [], editedWords: {},
    stats: { rounds: 12, lastRoundAt: '2026-09-01T10:00:00.000Z' },
  };
  await p.evaluate((s) => localStorage.setItem('idioma.state.v1', JSON.stringify(s)), old);
  // Closed without the save the page does on unload, so what loads is the old save.
  await p.close({ runBeforeUnload: false });
  const { p: q } = await page(ctx);
  const st = await q.evaluate(() => window.Idioma.state);
  ok('progress is kept', st.progress.mesa.level === 6 && st.stats.rounds === 12);
  ok('hooks start empty', JSON.stringify(st.hooks) === '{}');
  ok('and the session has never been done', st.stats.todayLast === null && st.stats.todayStreak === 0);
  ok('the start screen draws', await q.isVisible('#btn-today') && (await q.textContent('#btn-today')) === "Today's session");
  // Bad rows from a hand-edited backup are dropped, good ones kept.
  await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('idioma.state.v1')); s.hooks = { mesa: { text: 'fine', at: 'x' }, silla: 'broken', casa: { at: 1 } }; localStorage.setItem('idioma.state.v1', JSON.stringify(s)); });
  await q.close({ runBeforeUnload: false });
  const { p: r } = await page(ctx);
  ok('a hand-edited hook record keeps what it can', await r.evaluate(() => JSON.stringify(Object.keys(window.Idioma.state.hooks))) === '["mesa"]');
  await ctx.close();
}

console.log('across devices');
{
  const { c, p } = await page();
  const r = await p.evaluate(() => {
    const S = window.Sync;
    const base = { savedAt: '2026-10-01T00:00:00Z', settings: {}, progress: {}, phrases: {}, customWords: [], customSentences: [], editedWords: {}, accepted: {} };
    const old = { ...base, stats: { rounds: 3, lastRoundAt: null } };
    const a = { ...base, stats: { rounds: 3, lastRoundAt: null, todayLast: '2026-10-05', todayStreak: 4 },
      hooks: { mesa: { text: 'old', at: '2026-10-01T00:00:00Z' }, casa: { text: 'kept', at: '2026-10-01T00:00:00Z' } } };
    const b = { ...base, stats: { rounds: 3, lastRoundAt: null, todayLast: '2026-10-06', todayStreak: 5 },
      hooks: { mesa: { text: '', at: '2026-10-02T00:00:00Z' } } };
    const m = S.merge(a, b);
    return {
      oldSelf: JSON.stringify(S.merge(old, old)) === JSON.stringify({ ...old, savedAt: old.savedAt }),
      noHooksKey: !('hooks' in S.merge(old, old)),
      fromOld: S.merge(old, a).hooks.casa.text,
      deleted: m.hooks.mesa.text, kept: m.hooks.casa.text,
      day: m.stats.todayLast, streak: m.stats.todayStreak,
      same: S.merge({ ...a, stats: { ...a.stats, todayLast: '2026-10-06', todayStreak: 2 } }, b).stats.todayStreak,
    };
  });
  ok('two old saves merge to exactly themselves', r.oldSelf && r.noHooksKey);
  ok('a hook survives a sync with a device that has none', r.fromOld === 'kept');
  ok('the later edit wins, and a deletion is an edit', r.deleted === '' && r.kept === 'kept');
  ok('the later day finished wins, with its streak', r.day === '2026-10-06' && r.streak === 5);
  ok('the same day on both: the longer streak', r.same === 5);
  await c.close();
}

ok('pageerror = 0', pe === 0);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
