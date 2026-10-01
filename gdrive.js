/* Sync through the learner's own Google Drive.

   Why this exists: progress lives in the browser's storage on one device, and
   on an iPhone a home-screen app's storage goes with the app. Delete the icon
   and the progress is gone. A copy somewhere else is the only real fix, and
   the learner already has somewhere else: their Google account.

   The copy goes in Drive's appDataFolder, a hidden folder that only this app
   can see. It does not show up in the learner's Drive, and the app cannot see
   anything else in it. One file, idioma-progress.json, merged on the way in
   with the same merge the other sync uses, so a fresh install that signs in
   gets everything back rather than pushing its empty state over the top.

   There is no server. Signing in is Google's browser flow for apps with no
   backend: the page goes to Google, Google comes back with an access token in
   the address fragment, and the token is good for an hour. Done as a page
   visit rather than a popup, because popups are unreliable in an installed
   iPhone app. Without a server there is no refresh token, so when the hour
   is up the app goes back through Google with prompt=none, which returns
   straight away for someone already signed in, and only does that between
   rounds, never in the middle of one. app.js decides when; this file says how.

   No DOM here. */

/* In its own scope: sync.js is loaded the same way and already has a
   configured() and a few constants of the same names. */
(function () {
  "use strict";

  /* The OAuth client ID from Google Cloud Console. Not a secret: it is in every
     page that uses it. Empty means the feature is not set up, and the app hides
     it. README.md, "Signing in with Google", has the steps to get one. The
     tests set IDIOMA_GOOGLE_CLIENT_ID on the page to switch it on. */
  const GOOGLE_CLIENT_ID = "";
  const clientId = () => window.IDIOMA_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;

  const GOOGLE_KEY = "idioma.google.v1";
  const PENDING_KEY = "idioma.google.pending.v1";
  const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email";
  const FILE = "idioma-progress.json";
  const BACKUP = "idioma-progress-previous.json";
  const API = "https://www.googleapis.com";

  const blankAuth = () => ({
    signedIn: false, token: null, expiresAt: 0, email: "",
    lastSyncedAt: null, lastError: null, lastBounce: 0, needsTap: false, replaceOwed: false,
  });

  /* Kept out of the synced state for the same reason the other sync's config
     is: a merge must never be able to rewrite who this device signs in as. */
  function loadAuth() {
    try {
      const raw = window.localStorage.getItem(GOOGLE_KEY);
      return raw ? { ...blankAuth(), ...JSON.parse(raw) } : blankAuth();
    } catch (e) {
      return blankAuth();
    }
  }

  function saveAuth(auth) {
    try { window.localStorage.setItem(GOOGLE_KEY, JSON.stringify(auth)); } catch (e) { /* private mode */ }
    return auth;
  }

  const configured = () => !!clientId();
  const tokenValid = (auth) => !!(auth && auth.token && Date.now() < auth.expiresAt);

  /* Has to match one of the redirect URIs registered against the client ID
     exactly, so the page is always named by its folder, never by index.html. */
  function redirectUri(loc) {
    return loc.origin + loc.pathname.replace(/index\.html$/, "");
  }

  function authUrl({ silent, hint, state, loc }) {
    const p = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: redirectUri(loc),
      response_type: "token",
      scope: SCOPES,
      include_granted_scopes: "true",
      state,
    });
    // Silent: come straight back, with a token or an error, and show nothing.
    // Not silent: let them pick the account, which is the point of tapping it.
    p.set("prompt", silent ? "none" : "select_account");
    if (hint) p.set("login_hint", hint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }

  /* Leave for Google. The state value comes back with the answer and has to
     match, so a link someone else made cannot sign this device into their
     account and start writing this learner's progress into it. */
  function begin({ silent = false, hint = "" } = {}, loc = window.location) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    const state = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify({ state, silent, at: Date.now() }));
    } catch (e) { /* the answer will not match, and will be ignored */ }
    window.location.assign(authUrl({ silent, hint, state, loc }));
  }

  /* What Google sent back, if this page load is the return trip. null for an
     ordinary page load. Otherwise { silent, token, expiresIn },
     { silent, error }, or { ignored } for a reply nobody here asked for. */
  function readReturn(hash) {
    const h = String(hash || "").replace(/^#/, "");
    if (!/(^|&)(access_token|error)=/.test(h)) return null;
    const p = new URLSearchParams(h);
    let pending = null;
    try {
      pending = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "null");
      window.localStorage.removeItem(PENDING_KEY);
    } catch (e) { /* treated as no match below */ }
    // Not a reply to anything this device asked for: dropped without a
    // word, and without touching the sign-in this device already has.
    if (!pending || pending.state !== p.get("state")) return { ignored: true };
    if (p.get("error")) return { silent: pending.silent, error: p.get("error") };
    return {
      silent: pending.silent,
      token: p.get("access_token"),
      expiresIn: Number(p.get("expires_in")) || 3600,
    };
  }

  /* ---------------------------------------------------------------
     Drive
     --------------------------------------------------------------- */

  async function call(token, url, init = {}) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
    } catch (e) {
      throw new Error("could not reach Google");
    }
    if (res.status === 401) {
      const e = new Error("the Google sign-in has run out");
      e.expired = true;
      throw e;
    }
    if (!res.ok) throw new Error(`Google said ${res.status}`);
    return res;
  }

  async function find(token, name) {
    const q = encodeURIComponent(`name='${name}' and trashed=false`);
    const res = await call(token,
      `${API}/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${q}`);
    const body = await res.json();
    return (body.files || [])[0] || null;
  }

  async function read(token, id) {
    const res = await call(token, `${API}/drive/v3/files/${id}?alt=media`, { cache: "no-store" });
    try {
      return await res.json();
    } catch (e) {
      throw new Error("the copy in Google Drive could not be read");
    }
  }

  /* Overwrite the file if there is one, create it in the hidden folder if not. */
  async function write(token, existing, name, data) {
    const json = JSON.stringify(data);
    if (existing) {
      await call(token, `${API}/upload/drive/v3/files/${existing.id}?uploadType=media`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: json,
      });
      return existing.id;
    }
    const b = `idioma${Date.now()}`;
    const body = `--${b}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n`
      + JSON.stringify({ name, parents: ["appDataFolder"] })
      + `\r\n--${b}\r\ncontent-type: application/json\r\n\r\n${json}\r\n--${b}--`;
    const res = await call(token, `${API}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: "POST", headers: { "content-type": `multipart/related; boundary=${b}` }, body,
    });
    return (await res.json()).id;
  }

  async function email(token) {
    const res = await call(token, "https://openidconnect.googleapis.com/v1/userinfo");
    return (await res.json()).email || "";
  }

  /* How much has been learned, as a count of words and sentences with a row. */
  const amount = (s) => Object.keys((s && s.progress) || {}).length
    + Object.keys((s && s.phrases) || {}).length;

  /* One sync: read Drive's copy, merge, write the result back.

     Two guards, because the whole reason this exists is that progress was lost
     once already:
     - The merge only ever adds rows, but if anything ever made the result
       smaller than what is in Drive, it is refused rather than written.
     - Once a day, before the first write, the copy in Drive is kept as
       idioma-progress-previous.json, so even a bad write can be undone.

     `replace` skips the merge and the size guard. Only Reset uses it: a reset
     merged with Drive would bring everything straight back. */
  async function run(token, local, { replace = false, today = new Date() } = {}) {
    const found = await find(token, FILE);
    const remote = found ? await read(token, found.id) : null;
    const merged = replace ? local : window.Sync.merge(local, remote);
    if (!replace && remote && amount(merged) < amount(remote)) {
      throw new Error("stopped: syncing would have lost progress");
    }
    if (remote && found.modifiedTime
        && found.modifiedTime.slice(0, 10) !== today.toISOString().slice(0, 10)) {
      await write(token, await find(token, BACKUP), BACKUP, remote);
    }
    await write(token, found, FILE, merged);
    return merged;
  }

  /* Fire and forget: a failed revoke still leaves this device signed out. */
  function revoke(token) {
    if (!token) return;
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: "POST" }).catch(() => {});
  }

  window.Drive = {
    GOOGLE_KEY, FILE, BACKUP, configured, tokenValid, loadAuth, saveAuth,
    redirectUri, authUrl, begin, readReturn, run, email, revoke, amount,
  };
})();
