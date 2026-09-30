/* Installing and updating. The worker itself is in sw.js; this is the page's
   half: register it, notice when a newer one is waiting, and swap to it only
   when asked.

   An installed app on a phone is rarely closed. It is put in the background
   and brought back, sometimes for weeks, so waiting for a fresh load to
   check for a new version would mean it almost never checked. It checks on
   load, whenever it comes back into view, and when asked from the menu. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const toast = (msg, bad) => window.Idioma && window.Idioma.toast(msg, bad);

  // A worker needs http(s). Opened as a file, the app works as it always
  // did, just without installing or updating.
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  // Said once, after the reload an update asked for, so the tap visibly did something.
  try {
    if (sessionStorage.getItem("idioma.updated")) {
      sessionStorage.removeItem("idioma.updated");
      toast("Updated. Your progress is as you left it.");
    }
  } catch (e) { /* private mode */ }

  const sw = navigator.serviceWorker;
  let reg = null;
  let asked = false;        // an update was chosen, so a new controller means reload
  let lastCheck = 0;

  const offer = () => { $("update-bar").hidden = false; };

  function watch(worker) {
    worker.addEventListener("statechange", () => {
      // No controller means this is the first install, not an update.
      if (worker.state === "installed" && sw.controller) offer();
    });
  }

  function check() {
    if (!reg) return Promise.resolve();
    lastCheck = Date.now();
    return reg.update().catch(() => { /* offline: try again next time */ });
  }

  sw.register("sw.js").then((r) => {
    reg = r;
    $("app-version-row").hidden = false;
    if (r.waiting && sw.controller) offer();
    if (r.installing) watch(r.installing);
    r.addEventListener("updatefound", () => watch(r.installing));
    lastCheck = Date.now();   // registering has just checked
    showBuild();
  }).catch(() => { /* not fatal: the app runs without it */ });

  sw.addEventListener("controllerchange", () => {
    if (asked) location.reload();
  });

  sw.addEventListener("message", (e) => {
    if (e.data && e.data.build) {
      const b = e.data.build;
      $("app-version").textContent = b === "__BUILD__" ? "Development copy" : `Version ${b.slice(0, 7)}`;
    }
  });

  function showBuild() {
    if (sw.controller) sw.controller.postMessage("build");
  }

  document.addEventListener("visibilitychange", () => {
    // A minute apart at most; flicking between apps should not mean a request each time.
    if (document.visibilityState === "visible" && Date.now() - lastCheck > 60 * 1000) check();
  });

  $("btn-update").addEventListener("click", () => {
    asked = true;
    $("update-bar").hidden = true;
    try { sessionStorage.setItem("idioma.updated", "1"); } catch (e) { /* private mode */ }
    if (reg && reg.waiting) reg.waiting.postMessage("skip-waiting");
    else location.reload();
  });

  $("btn-update-later").addEventListener("click", () => { $("update-bar").hidden = true; });

  $("btn-check-update").addEventListener("click", () => {
    if (!navigator.onLine) return toast("You are offline, so there is nothing to check against.", true);
    const btn = $("btn-check-update");
    btn.disabled = true;
    check().then(() => {
      btn.disabled = false;
      if (reg.waiting) offer();
      else if (reg.installing) toast("Downloading the new version. It will offer itself when it is ready.");
      else toast("This is the latest version.");
    });
  });
})();
