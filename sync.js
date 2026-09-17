/* Cross-device sync: one JSON blob, one secret code, no account.

   The design follows from what was already true. The whole of a learner's
   progress is a single serialisable object with a timestamp, because Export
   needed that anyway. So syncing is: put the blob somewhere both devices can
   reach, and merge on the way in. No schema, no migration, no login.

   localStorage stays the primary store. Sync is something that happens to it
   afterwards, opportunistically, and every failure is survivable: offline,
   endpoint down, code wrong, all of them leave the app working exactly as it
   does with no sync at all. Nothing here blocks a card.

   No DOM in this file, and no storage either; app.js supplies both. What is
   here is the merge, which is the only part that can lose someone's work and
   so the only part worth testing to death.

   The code is a capability: 110 bits from crypto.getRandomValues, and holding
   it is the whole of the authorisation. It is not a password to a named
   account, it is the name of an unguessable box. That is why the endpoint can
   allow any origin: knowing the code is the point, and guessing one is not
   feasible. Anyone you give it to has your progress, so treat it as a secret.
*/

const SYNC_KEY = "idioma.sync.v1";

/* Deliberately not inside the synced state. If the endpoint and the code
   travelled with the blob, a merge could rewrite where a device syncs to,
   and a bad merge would be unrecoverable rather than merely wrong. */
function loadConfig() {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    return raw ? JSON.parse(raw) : { url: "", code: "", rev: 0, lastSyncedAt: null, lastError: null };
  } catch (e) {
    return { url: "", code: "", rev: 0, lastSyncedAt: null, lastError: null };
  }
}

function saveConfig(cfg) {
  try { window.localStorage.setItem(SYNC_KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  return cfg;
}

/* Crockford-ish base32, no vowels, so a code cannot spell anything and
   cannot be misread between 0 and O or 1 and I. */
const ALPHABET = "0123456789bcdfghjkmnpqrstvwxyz";
function newCode() {
  const bytes = new Uint8Array(22);
  window.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/* ---------------------------------------------------------------
   The merge
   --------------------------------------------------------------- */

const later = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
};

/* When a progress row was last touched. lastSeen covers answering a card;
   changedAt covers everything else, which in practice means enabling or
   disabling a word. Without the second one, disabling a word on the laptop
   would be silently undone by the phone, because disabling does not change
   when the word was last seen. */
const touchedAt = (p) => later(p && p.lastSeen, p && p.changedAt);

/* Which of two rows for the same word is the truth. Whichever device touched
   it last, because that device is the one that knows. Not the higher level:
   a word that was got wrong has legitimately gone down, and taking the max
   would quietly undo every drop. */
function pickRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ta = touchedAt(a), tb = touchedAt(b);
  if (ta && tb && ta !== tb) return new Date(ta) > new Date(tb) ? a : b;
  if (ta && !tb) return a;
  if (tb && !ta) return b;
  // Never seen on either side, or seen at the same instant: prefer whichever
  // has been answered more, then the higher level, then leave it alone.
  if ((a.timesSeen || 0) !== (b.timesSeen || 0)) return (a.timesSeen || 0) > (b.timesSeen || 0) ? a : b;
  return (a.level || 0) >= (b.level || 0) ? a : b;
}

const byId = (list) => {
  const m = new Map();
  for (const x of list || []) if (x && x.id) m.set(x.id, x);
  return m;
};

/* Merge two whole states into one. Commutative in the parts that matter and
   safe to run repeatedly: merging a state with itself, or merging the same
   pair twice, gives the same answer. That is what makes it safe to run on
   every page load without keeping a history. */
function merge(local, remote) {
  if (!remote) return local;
  if (!local) return remote;

  // The younger save wins the things that have no per-item timestamp.
  const localNewer = new Date(local.savedAt || 0) >= new Date(remote.savedAt || 0);
  const fresher = localNewer ? local : remote;
  const staler = localNewer ? remote : local;

  const progress = {};
  for (const id of new Set([...Object.keys(local.progress || {}), ...Object.keys(remote.progress || {})])) {
    progress[id] = pickRow((local.progress || {})[id], (remote.progress || {})[id]);
  }

  // Additions from either device survive; on the same id the younger save
  // wins, which is the best guess available without per-word edit times.
  const words = new Map([...byId(staler.customWords), ...byId(fresher.customWords)]);
  const sentences = new Map([...byId(staler.customSentences), ...byId(fresher.customSentences)]);

  return {
    ...fresher,
    savedAt: later(local.savedAt, remote.savedAt),
    settings: { ...staler.settings, ...fresher.settings },
    progress,
    customWords: [...words.values()],
    customSentences: [...sentences.values()],
    editedWords: { ...staler.editedWords, ...fresher.editedWords },
    stats: {
      // Summed would double-count every time the same pair merged again.
      rounds: Math.max((local.stats || {}).rounds || 0, (remote.stats || {}).rounds || 0),
      lastRoundAt: later((local.stats || {}).lastRoundAt, (remote.stats || {}).lastRoundAt),
    },
  };
}

/* ---------------------------------------------------------------
   Transport
   --------------------------------------------------------------- */

const endpoint = (cfg) => `${String(cfg.url).replace(/\/+$/, "")}/v1/${cfg.code}`;

/* fetch rejects with "Failed to fetch" for every network problem there is,
   which tells a reader nothing. Anything that never reached the server is
   reported as not reaching the server. */
async function get(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new Error("could not reach the sync server");
  }
}

async function pull(cfg) {
  const res = await get(endpoint(cfg), { method: "GET", cache: "no-store" });
  if (res.status === 404) throw new Error("that URL is not a sync server");
  if (!res.ok) throw new Error(`the server said ${res.status}`);
  try {
    return await res.json();               // { rev, state }, and state may be null
  } catch (e) {
    throw new Error("the server sent something that is not a sync reply");
  }
}

async function push(cfg, state, rev) {
  const res = await get(endpoint(cfg), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rev, state }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const clash = new Error("conflict");
    clash.conflict = body;                 // carries the newer rev and state
    throw clash;
  }
  if (!res.ok) throw new Error(`the server said ${res.status}`);
  return res.json();                       // { rev }
}

/* One round trip: pull, merge, push the merged result back. Returns the state
   to adopt locally, or null when there was nothing to do.

   On a conflict it merges what the server handed back and tries once more.
   Once, not forever: a second conflict means another device is writing at the
   same moment, and the next sync will pick it up anyway. */
async function run(cfg, localState, { save }) {
  const remote = await pull(cfg);
  const merged = merge(localState, remote.state);
  let rev = remote.rev;
  try {
    const put = await push(cfg, merged, rev);
    rev = put.rev;
  } catch (e) {
    if (!e.conflict) throw e;
    const again = merge(merged, e.conflict.state);
    const put = await push(cfg, again, e.conflict.rev);
    rev = put.rev;
    save({ ...cfg, rev, lastSyncedAt: new Date().toISOString(), lastError: null });
    return again;
  }
  save({ ...cfg, rev, lastSyncedAt: new Date().toISOString(), lastError: null });
  return merged;
}

window.Sync = {
  SYNC_KEY, loadConfig, saveConfig, newCode,
  merge, pickRow, touchedAt, endpoint, pull, push, run,
  configured: (cfg) => !!(cfg && cfg.url && cfg.code),
};
