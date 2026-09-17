/* The merge, which is the only part of sync that can lose someone's work.
   No network here and no browser: merge is a pure function of two states. */
import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = {
  window: { localStorage: { getItem: () => null, setItem: () => {} },
            crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37) % 256; } } },
  console, Math, Date, JSON, fetch: () => { throw new Error('no network in this test'); },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../sync.js', import.meta.url), 'utf8'), ctx);
const S = ctx.window.Sync;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('!! FAIL', name, extra); } };

const T0 = '2026-09-17T09:00:00.000Z';
const T1 = '2026-09-17T10:00:00.000Z';
const T2 = '2026-09-17T11:00:00.000Z';

const row = (o = {}) => ({ level: 1, correctStreak: 0, totalCorrect: 0, totalWrong: 0,
  totalAlmost: 0, lastSeen: null, timesSeen: 0, enabled: true, ...o });
const state = (o = {}) => ({ version: 1, savedAt: T1, settings: { roundSize: 15, typoTolerance: false },
  progress: {}, customWords: [], customSentences: [], editedWords: {},
  stats: { rounds: 0, lastRoundAt: null }, ...o });

console.log('--- a word answered on two devices ---');
const phone = state({ savedAt: T2, progress: { mesa: row({ level: 5, timesSeen: 9, lastSeen: T2 }) } });
const laptop = state({ savedAt: T1, progress: { mesa: row({ level: 3, timesSeen: 4, lastSeen: T1 }) } });
ok('the device that touched it last wins', S.merge(laptop, phone).progress.mesa.level === 5);
ok('and it wins in either direction', S.merge(phone, laptop).progress.mesa.level === 5);

console.log('--- a level that went down must stay down ---');
const dropped = state({ savedAt: T2, progress: { mesa: row({ level: 2, timesSeen: 10, lastSeen: T2, totalWrong: 3 }) } });
const older = state({ savedAt: T1, progress: { mesa: row({ level: 7, timesSeen: 9, lastSeen: T1 }) } });
ok('a newer drop beats an older high level',
  S.merge(older, dropped).progress.mesa.level === 2,
  'taking the higher level would undo every wrong answer');
ok('and the newer counts come with it', S.merge(older, dropped).progress.mesa.totalWrong === 3);

console.log('--- words only one device has ever seen ---');
const a = state({ progress: { mesa: row({ level: 4, timesSeen: 2, lastSeen: T1 }) } });
const b = state({ progress: { silla: row({ level: 6, timesSeen: 5, lastSeen: T1 }) } });
const both = S.merge(a, b);
ok('nothing is lost from either side', both.progress.mesa.level === 4 && both.progress.silla.level === 6);
ok('and no extra words appear', Object.keys(both.progress).length === 2);

console.log('--- disabling a word, which does not change lastSeen ---');
const off = state({ savedAt: T2, progress: { mesa: row({ enabled: false, changedAt: T2, lastSeen: T0, timesSeen: 3 }) } });
const on = state({ savedAt: T1, progress: { mesa: row({ enabled: true, lastSeen: T1, timesSeen: 3 }) } });
ok('a disable made after the last answer survives the merge',
  S.merge(on, off).progress.mesa.enabled === false,
  'without changedAt this would be silently switched back on');
ok('but an answer given after the disable wins',
  S.merge(off, state({ savedAt: T2, progress: { mesa: row({ enabled: true, lastSeen: '2026-09-17T12:00:00.000Z' }) } }))
    .progress.mesa.enabled === true);

console.log('--- words and sentences added on either device ---');
const withWord = state({ savedAt: T1, customWords: [{ id: 'w1', es: 'uno' }], customSentences: [{ id: 's1', wordId: 'w1' }] });
const withOther = state({ savedAt: T2, customWords: [{ id: 'w2', es: 'dos' }] });
const m = S.merge(withWord, withOther);
ok('both additions survive', m.customWords.length === 2 && m.customWords.map((w) => w.id).sort().join() === 'w1,w2');
ok('a sentence added on only one device survives', m.customSentences.length === 1);
const clash1 = state({ savedAt: T1, customWords: [{ id: 'w1', es: 'old' }] });
const clash2 = state({ savedAt: T2, customWords: [{ id: 'w1', es: 'new' }] });
ok('on the same id the younger save wins', S.merge(clash1, clash2).customWords[0].es === 'new');

console.log('--- settings, edits and counters ---');
ok('the younger save decides the settings',
  S.merge(state({ savedAt: T1, settings: { roundSize: 15 } }),
          state({ savedAt: T2, settings: { roundSize: 30 } })).settings.roundSize === 30);
ok('a setting only one side has is kept',
  S.merge(state({ savedAt: T2, settings: { roundSize: 20 } }),
          state({ savedAt: T1, settings: { roundSize: 15, typoTolerance: true } })).settings.typoTolerance === true);
ok('hand edits from both sides are kept',
  Object.keys(S.merge(state({ editedWords: { a: {} } }), state({ editedWords: { b: {} } })).editedWords).length === 2);
ok('the round count is the higher, not the sum',
  S.merge(state({ stats: { rounds: 10 } }), state({ stats: { rounds: 7 } })).stats.rounds === 10,
  'summing would inflate it every time the same pair merged again');

console.log('--- merging is safe to repeat ---');
const once = S.merge(phone, laptop);
const twice = S.merge(once, laptop);
ok('merging the same pair again changes nothing',
  JSON.stringify(once) === JSON.stringify(twice));
ok('a state merged with itself is unchanged',
  JSON.stringify(S.merge(phone, phone)) === JSON.stringify(phone));
const roundTrip = S.merge(S.merge(laptop, phone), S.merge(phone, laptop));
ok('and the order of merging does not decide the outcome',
  roundTrip.progress.mesa.level === 5);

console.log('--- nothing and rubbish ---');
ok('a first sync with an empty server keeps the local state',
  S.merge(phone, null) === phone);
ok('a first sync on a new device takes the server state',
  S.merge(null, phone) === phone);
ok('a state with no progress section does not throw',
  Object.keys(S.merge(state({ progress: undefined }), phone).progress).length === 1);
ok('a state with no custom lists does not throw',
  S.merge(state({ customWords: undefined }), phone).customWords.length === 0);

console.log('--- the sync code ---');
const code = S.newCode();
ok('is long enough to be unguessable', code.length >= 20, 'length ' + code.length);
ok('has no vowels, so it cannot spell anything', !/[aeiou]/i.test(code));
ok('avoids the characters people misread', !/[lLoOiI1]/.test(code.replace(/1/g, '')) || !/[loi]/i.test(code));
ok('is url safe', /^[0-9a-z]+$/.test(code));
ok('not configured until both the url and the code are set',
  !S.configured({ url: '', code }) && !S.configured({ url: 'x', code: '' }) && S.configured({ url: 'x', code }));
ok('the endpoint is built from the url and the code',
  S.endpoint({ url: 'https://x.dev/', code: 'abc' }) === 'https://x.dev/v1/abc');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
