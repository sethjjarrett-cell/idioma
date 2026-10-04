/* The service worker. Two jobs: keep the app working with no signal, and
   hold a new version back until you say so.

   Everything the app needs is small and known in advance, so the whole of it
   is fetched into one cache when this worker installs, and served from there.
   Nothing is fetched a file at a time as it goes stale, which is how you end
   up with this week's app.js running against last week's engine.js.

   A new version is a new copy of this file. The deploy workflow stamps the
   commit into BUILD below, so every push to main changes this file by at
   least that line, and a changed file is what the browser looks for when it
   checks. The new worker then fetches the new files into a new cache and
   waits. The page sees it waiting and offers the update; tapping it sends
   "skip-waiting", this worker takes over, and the page reloads onto it.

   Progress is not in here. It lives in localStorage, which a new version
   neither sees nor touches. */
const BUILD = "__BUILD__";
const CACHE = `idioma-${BUILD}`;

const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "seed.js",
  "vocab.js",
  "equivalents.js",
  "topics.js",
  "order.js",
  "senses.js",
  "phrases.js",
  "grammar.js",
  "verbs.js",
  "pronounce.js",
  "speak.js",
  "engine.js",
  "store.js",
  "sync.js",
  "gdrive.js",
  "app.js",
  "pwa.js",
  "icons/fox.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // "reload" skips the HTTP cache. Pages serves files with ten minutes of
  // max-age, and a fresh worker full of stale files is no update at all.
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((k) => k.startsWith("idioma-") && k !== CACHE)
      .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
  if (e.data === "build" && e.source) e.source.postMessage({ build: BUILD });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Only this app's own files. The sync server and anything else on another
  // origin go straight to the network, as if this worker were not here.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then((hit) => {
      if (hit) return hit;
      // Opening the app from the home screen, or a pairing link with a hash:
      // any page load is the one page there is.
      if (req.mode === "navigate") {
        return caches.match("index.html", { cacheName: CACHE }).then((page) => page || fetch(req));
      }
      return fetch(req);
    })
  );
});
