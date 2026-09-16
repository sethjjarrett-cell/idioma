/* UI wiring: three screens over the engine and the store.

   Nothing here decides anything about mastery; it asks Engine for a card,
   hands the result back, and draws what comes out. Keeping the rules out
   of the view is what makes the rules easy to change later.
*/

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loaded = Store.load();
  let state = loaded.state;

  /* Round state lives in memory only; an interrupted round is not worth
     persisting, and the per-word progress behind it already is. */
  let round = null;
  let card = null;
  let lastResult = null;

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */

  let toastTimer = null;
  function toast(message, bad) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("bad", !!bad);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const words = () => Store.allWords(state);
  const sentences = () => Store.allSentences(state);
  // Reads go through peek so that merely drawing a screen never creates a
  // progress row; only answering a card or toggling a word writes one.
  const prog = (id) => Store.peekProgress(state, id);
  const progWrite = (id) => Store.progressFor(state, id);
  const sentencesFor = (wordId) => sentences().filter((s) => s.wordId === wordId);
  const commit = () => Store.save(state);

  function accuracy(p) {
    const n = p.totalCorrect + p.totalWrong;
    return n ? Math.round((p.totalCorrect / n) * 100) : null;
  }

  /* An id that stays readable in the JSON, since the file is meant to be
     hand-edited. Falls back to a counter if the slug is taken. */
  function makeWordId(es) {
    const base = Engine.normalise(es).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "word";
    const taken = new Set(words().map((w) => w.id));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  }
  function makeSentenceId() {
    const taken = new Set(sentences().map((s) => s.id));
    let n = sentences().length + 1;
    let id = `c${String(n).padStart(3, "0")}`;
    while (taken.has(id)) { n++; id = `c${String(n).padStart(3, "0")}`; }
    return id;
  }

  /* ------------------------------------------------------------------
     Screens
     ------------------------------------------------------------------ */

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("on"));
    $("screen-" + name).classList.add("on");
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.screen === name));
    if (name === "manage") renderBank();
    if (name === "progress") renderProgress();
  }

  $("tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) showScreen(tab.dataset.screen);
  });

  /* ------------------------------------------------------------------
     Menu, settings, backup
     ------------------------------------------------------------------ */

  $("btn-menu").addEventListener("click", () => {
    const m = $("menu");
    m.hidden = !m.hidden;
    if (!m.hidden) refreshMenu();
  });

  function refreshMenu() {
    $("set-typo").checked = !!state.settings.typoTolerance;
    $("set-round").value = state.settings.roundSize;
    $("saved-at").textContent = state.savedAt
      ? `Last saved ${new Date(state.savedAt).toLocaleString("en-GB")}`
      : "Nothing saved yet.";
  }

  $("set-typo").addEventListener("change", (e) => {
    state.settings.typoTolerance = e.target.checked;
    commit();
    toast(e.target.checked
      ? "Typo tolerance on; a single-letter slip will now pass."
      : "Typo tolerance off.");
  });

  $("set-round").addEventListener("change", (e) => {
    const n = Math.max(1, Math.min(100, Number(e.target.value) || Engine.CONFIG.ROUND_SIZE));
    state.settings.roundSize = n;
    e.target.value = n;
    commit();
    updateStartBlurb();
  });

  $("btn-export").addEventListener("click", () => {
    Store.saveNow(state);
    Store.downloadExport(state);
    toast("Backup downloaded.");
  });

  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = Store.parseImport(await file.text());
      state = next;
      Store.saveNow(state);
      round = null; card = null;
      resetPracticeView();
      refreshMenu();
      updateStartBlurb();
      toast(`Imported ${Object.keys(state.progress).length} words of progress.`);
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("btn-reset").addEventListener("click", () => {
    if (!window.confirm("Reset every level, streak and count? Words and sentences you added are kept. This cannot be undone, so export a backup first if you want one.")) return;
    state.progress = {};
    state.stats = { rounds: 0, lastRoundAt: null };
    Store.saveNow(state);
    round = null; card = null;
    resetPracticeView();
    updateStartBlurb();
    toast("Progress reset.");
  });

  /* ------------------------------------------------------------------
     Practice
     ------------------------------------------------------------------ */

  function updateStartBlurb() {
    const all = words();
    const enabled = all.filter((w) => prog(w.id).enabled !== false);
    const unseen = enabled.filter((w) => !prog(w.id).lastSeen).length;
    $("start-blurb").textContent =
      `${enabled.length} words in play, ${unseen} not yet seen. `
      + `A round is ${state.settings.roundSize} cards, picked by level and by how long since you last saw them.`;
  }

  function resetPracticeView() {
    $("card").hidden = true;
    $("round-bar").hidden = true;
    $("round-end").hidden = true;
    $("round-start").hidden = false;
  }

  function startRound() {
    const picked = Engine.pickRound(words(), (id) => prog(id), new Date().toISOString(), state.settings.roundSize);
    if (!picked.length) {
      toast("No words are enabled, so there is nothing to practise.", true);
      return;
    }
    round = { queue: picked, index: 0, results: [], movers: [] };
    $("round-start").hidden = true;
    $("round-end").hidden = true;
    $("round-bar").hidden = false;
    nextCard();
  }

  function nextCard() {
    if (!round || round.index >= round.queue.length) return endRound();
    const word = round.queue[round.index];
    card = Engine.buildCard(word, prog(word.id), sentencesFor);
    lastResult = null;

    const p = prog(word.id);
    $("card-band").textContent = card.band.label + (card.fellBack ? " (no sentence yet)" : "");
    $("card-level").textContent = `L${p.level}`;
    $("card-prompt").innerHTML = card.band.key === "cloze"
      ? esc(card.prompt).replace("_____", '<span class="blank">_____</span>')
      : esc(card.prompt);
    $("card-hint").textContent = card.band.key === "cloze"
      ? card.promptHint
      : (card.promptHint ? card.promptHint : "");
    $("card-hint").hidden = !$("card-hint").textContent;

    $("answer").value = "";
    $("answer").disabled = false;
    $("btn-submit").disabled = false;
    $("verdict").hidden = true;
    $("card").hidden = false;
    $("round-count").textContent = `${round.index + 1} / ${round.queue.length}`;
    $("round-fill").style.width = `${(round.index / round.queue.length) * 100}%`;
    $("answer").focus();
    window.__card = card;   // handy for debugging and for the UI test
  }

  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!card || !$("verdict").hidden) return;
    grade($("answer").value);
  });

  function grade(typed) {
    const res = Engine.checkAnswer(typed, card.accepted, {
      typoTolerance: state.settings.typoTolerance,
    });
    applyAndShow(res.correct, res.near, typed);
  }

  function applyAndShow(wasCorrect, near, typed) {
    const id = card.word.id;
    const applied = Engine.applyResult(progWrite(id), wasCorrect, new Date().toISOString());
    state.progress[id] = applied.progress;
    commit();

    lastResult = { id, wasCorrect, applied, typed };
    round.results.push({ id, wasCorrect });
    if (applied.movedUp || applied.movedDown) {
      // Keep only the latest move per word, so a word that bounced up and
      // down inside one round reports where it ended up.
      round.movers = round.movers.filter((m) => m.id !== id);
      round.movers.push({
        id, up: applied.movedUp, es: card.word.es,
        from: applied.levelBefore, to: applied.levelAfter,
        bandChanged: applied.bandChanged,
      });
    }

    $("verdict-chip").textContent = wasCorrect ? "Correct" : "Not quite";
    $("verdict-chip").className = "chip " + (wasCorrect ? "good" : "bad");

    let detail = "";
    if (wasCorrect && near) detail = "accepted with typo tolerance";
    else if (!wasCorrect && typed.trim()) detail = `you typed "${typed.trim()}"`;
    if (applied.movedUp) detail += `${detail ? " · " : ""}L${applied.levelBefore} to L${applied.levelAfter}`;
    if (applied.movedDown) detail += `${detail ? " · " : ""}dropped to L${applied.levelAfter}`;
    if (wasCorrect && !applied.movedUp && Engine.isBoundaryLevel(applied.levelBefore)) {
      detail += `${detail ? " · " : ""}one more in a row to move up a band`;
    }
    $("verdict-detail").textContent = detail;

    $("verdict-answer").textContent = card.reveal;
    $("verdict-context").textContent = card.revealContext || "";
    $("verdict-context").hidden = !card.revealContext;

    const note = card.word.note;
    $("verdict-note").textContent = note || "";
    $("verdict-note").hidden = !note;

    // The override only makes sense on a wrong answer, and only when
    // something was actually typed.
    $("btn-override").hidden = wasCorrect || !typed.trim();

    $("answer").disabled = true;
    $("btn-submit").disabled = true;
    $("verdict").hidden = false;
    $("btn-next").focus();
  }

  /* Reverse the last result and re-apply it as correct. The word is put
     back to the progress it had before this card, so an override cannot
     leave a doubled count behind. */
  $("btn-override").addEventListener("click", () => {
    if (!lastResult || lastResult.wasCorrect) return;
    const id = lastResult.id;
    const p = state.progress[id];
    const restored = {
      ...p,
      level: lastResult.applied.levelBefore,
      totalWrong: Math.max(0, p.totalWrong - 1),
      timesSeen: Math.max(0, p.timesSeen - 1),
      correctStreak: lastResult.applied.progress.correctStreak,
    };
    // correctStreak was zeroed by the wrong answer; the original streak is
    // not recoverable from here, so it restarts at this card.
    restored.correctStreak = 0;
    state.progress[id] = restored;
    round.results.pop();
    round.movers = round.movers.filter((m) => m.id !== id);
    applyAndShow(true, false, lastResult.typed);
    toast("Marked correct.");
  });

  $("btn-next").addEventListener("click", () => {
    round.index += 1;
    nextCard();
  });

  function endRound() {
    $("card").hidden = true;
    $("round-bar").hidden = true;
    $("round-fill").style.width = "100%";

    const n = round.results.length;
    const right = round.results.filter((r) => r.wasCorrect).length;
    const pct = n ? Math.round((right / n) * 100) : 0;

    state.stats.rounds += 1;
    state.stats.lastRoundAt = new Date().toISOString();
    Store.saveNow(state);

    $("end-stats").innerHTML = [
      stat(pct + "%", "accuracy"),
      stat(`${right}/${n}`, "correct"),
      stat(round.movers.filter((m) => m.up).length, "levelled up"),
      stat(round.movers.filter((m) => !m.up).length, "dropped"),
    ].join("");

    $("end-movers").innerHTML = round.movers.length
      ? round.movers.map((m) => `
          <div class="mover ${m.up ? "up" : "down"}">
            <span class="arrow">${m.up ? "&#9650;" : "&#9660;"}</span>
            <span>${esc(m.es)}</span>
            ${m.bandChanged ? '<span class="flag">new band</span>' : ""}
            <span class="lv">L${m.from} to L${m.to}</span>
          </div>`).join("")
      : '<p class="muted small">No level changes this round.</p>';

    $("round-end").hidden = false;
    updateStartBlurb();
  }

  const stat = (value, label) => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;

  $("btn-start").addEventListener("click", startRound);
  $("btn-again").addEventListener("click", startRound);

  /* ------------------------------------------------------------------
     Manage
     ------------------------------------------------------------------ */

  let bankFilter = "all";
  let editingId = null;

  $("quick-filters").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    bankFilter = pill.dataset.filter;
    document.querySelectorAll("#quick-filters .pill").forEach((p) => p.classList.toggle("on", p === pill));
    renderBank();
  });

  $("filter").addEventListener("input", renderBank);

  function renderBank() {
    const q = Engine.normalise($("filter").value);
    const withSentence = new Set(sentences().map((s) => s.wordId));
    const rows = words().filter((w) => {
      const p = prog(w.id);
      const band = Engine.bandForLevel(p.level);
      if (bankFilter === "disabled" && p.enabled !== false) return false;
      if (bankFilter !== "disabled" && bankFilter !== "all" && p.enabled === false) return false;
      if (bankFilter === "recognition" && band.key !== "recognition") return false;
      if (bankFilter === "production" && band.key !== "production") return false;
      if (bankFilter === "cloze" && band.key !== "cloze") return false;
      if (bankFilter === "nosentence" && !(band.key === "cloze" && !withSentence.has(w.id))) return false;
      if (q) {
        const hay = Engine.normalise([w.es, ...(w.es_alt || []), ...w.en, w.note || ""].join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => prog(b.id).level - prog(a.id).level || a.es.localeCompare(b.es, "es"));

    $("bank-body").innerHTML = rows.map((w) => {
      const p = prog(w.id);
      const band = Engine.bandForLevel(p.level);
      const needsSentence = band.key === "cloze" && !withSentence.has(w.id);
      const acc = accuracy(p);
      if (editingId === w.id) return editRow(w);
      return `
        <tr class="${p.enabled === false ? "off" : ""}" data-id="${esc(w.id)}">
          <td class="es">${esc(w.es)}${needsSentence ? '<span class="flag">needs a sentence</span>' : ""}
            ${(w.es_alt || []).length ? `<div class="muted small">${esc(w.es_alt.join(", "))}</div>` : ""}</td>
          <td>${esc(w.en.join(", "))}
            ${w.note ? `<div class="muted small">${esc(w.note)}</div>` : ""}</td>
          <td class="lvl">${p.level}</td>
          <td class="small">${esc(band.label)}</td>
          <td class="mono small">${p.timesSeen}</td>
          <td class="mono small">${p.totalCorrect}</td>
          <td class="mono small">${p.totalWrong}${acc === null ? "" : `<div class="muted">${acc}%</div>`}</td>
          <td><div class="row-actions">
            <button class="btn" data-act="edit">Edit</button>
            <button class="btn" data-act="toggle">${p.enabled === false ? "Enable" : "Disable"}</button>
          </div></td>
        </tr>`;
    }).join("") || '<tr><td colspan="8" class="muted small">Nothing matches that filter.</td></tr>';
  }

  function editRow(w) {
    return `
      <tr class="edit-row" data-id="${esc(w.id)}"><td colspan="8">
        <div class="edit-grid">
          <label class="field"><span>Spanish</span><input data-f="es" value="${esc(w.es)}"></label>
          <label class="field"><span>Other accepted Spanish</span><input data-f="es_alt" value="${esc((w.es_alt || []).join(", "))}"></label>
          <label class="field"><span>English</span><input data-f="en" value="${esc(w.en.join(", "))}"></label>
          <label class="field"><span>Part of speech</span><input data-f="pos" value="${esc(w.pos || "")}"></label>
          <label class="field"><span>Note</span><input data-f="note" value="${esc(w.note || "")}"></label>
          <label class="field"><span>Level</span><input data-f="level" type="number" min="1" max="${Engine.CONFIG.LEVEL_CEILING}" value="${prog(w.id).level}"></label>
        </div>
        <div class="row-actions" style="margin-top:10px">
          <button class="btn primary" data-act="save">Save</button>
          <button class="btn" data-act="cancel">Cancel</button>
        </div>
      </td></tr>`;
  }

  $("bank-body").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr.dataset.id;

    if (btn.dataset.act === "toggle") {
      const p = progWrite(id);
      p.enabled = p.enabled === false;
      commit(); renderBank(); updateStartBlurb();
      return;
    }
    if (btn.dataset.act === "edit") { editingId = id; renderBank(); return; }
    if (btn.dataset.act === "cancel") { editingId = null; renderBank(); return; }

    if (btn.dataset.act === "save") {
      const get = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
      const es = get("es");
      const en = get("en").split(",").map((s) => s.trim()).filter(Boolean);
      if (!es || !en.length) { toast("A word needs Spanish and at least one English answer.", true); return; }
      state.editedWords[id] = {
        es,
        es_alt: get("es_alt").split(",").map((s) => s.trim()).filter(Boolean),
        en,
        pos: get("pos"),
        note: get("note"),
      };
      const lvl = Number(get("level"));
      if (Number.isFinite(lvl)) {
        progWrite(id).level = Math.max(Engine.CONFIG.LEVEL_MIN, Math.min(Engine.CONFIG.LEVEL_CEILING, Math.round(lvl)));
      }
      editingId = null;
      commit(); renderBank(); refreshWordSelect();
      toast("Saved.");
    }
  });

  $("add-word").addEventListener("submit", (e) => {
    e.preventDefault();
    const es = $("nw-es").value.trim();
    const en = $("nw-en").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!es || !en.length) { toast("A word needs Spanish and at least one English answer.", true); return; }
    const clash = words().find((w) => Engine.normalise(w.es) === Engine.normalise(es));
    if (clash && !window.confirm(`"${clash.es}" is already in the bank. Add it again anyway?`)) return;

    state.customWords.push({
      id: makeWordId(es),
      es,
      es_alt: $("nw-alt").value.split(",").map((s) => s.trim()).filter(Boolean),
      en,
      pos: $("nw-pos").value.trim(),
      note: $("nw-note").value.trim(),
    });
    commit();
    e.target.reset();
    renderBank(); refreshWordSelect(); updateStartBlurb();
    toast(`Added "${es}".`);
  });

  function refreshWordSelect() {
    const sel = $("ns-word");
    const keep = sel.value;
    const withSentence = new Set(sentences().map((s) => s.wordId));
    const list = words().slice().sort((a, b) => {
      // Words with no sentence first; those are the ones blocking cloze.
      const an = withSentence.has(a.id) ? 1 : 0;
      const bn = withSentence.has(b.id) ? 1 : 0;
      return an - bn || a.es.localeCompare(b.es, "es");
    });
    sel.innerHTML = list.map((w) =>
      `<option value="${esc(w.id)}">${esc(w.es)}${withSentence.has(w.id) ? "" : "  (no sentence yet)"}</option>`).join("");
    if (keep) sel.value = keep;
  }

  $("add-sentence").addEventListener("submit", (e) => {
    e.preventDefault();
    const es = $("ns-es").value.trim();
    const en = $("ns-en").value.trim();
    const wordId = $("ns-word").value;
    const m = es.match(/\{([^}]+)\}/);
    if (!m) { toast("Wrap the target form in curly braces, for example {comemos}.", true); return; }
    if (!en) { toast("Give the sentence an English translation.", true); return; }
    state.customSentences.push({ id: makeSentenceId(), wordId, es, answer: m[1].trim(), en });
    commit();
    e.target.reset();
    refreshWordSelect(); renderBank();
    toast(`Sentence added for "${(words().find((w) => w.id === wordId) || {}).es || wordId}".`);
  });

  /* ------------------------------------------------------------------
     Progress
     ------------------------------------------------------------------ */

  function renderProgress() {
    const all = words();
    const counts = { recognition: 0, production: 0, cloze: 0 };
    let seen = 0, right = 0, wrong = 0, atCeiling = 0;
    for (const w of all) {
      const p = prog(w.id);
      counts[Engine.bandForLevel(p.level).key] += 1;
      if (p.timesSeen) seen += 1;
      right += p.totalCorrect;
      wrong += p.totalWrong;
      if (p.level >= Engine.CONFIG.BAND_CLOZE_TOP) atCeiling += 1;
    }
    const total = all.length || 1;

    $("band-bars").innerHTML = [
      ["Recognition", "L1 to L3", counts.recognition, ""],
      ["Production", "L4 to L7", counts.production, "b2"],
      ["Cloze", "L8 and up", counts.cloze, "b3"],
    ].map(([name, range, n, cls]) => `
      <div class="band-row">
        <div class="band-name">${name}<div class="muted small">${range}</div></div>
        <div class="band-track"><i class="${cls}" style="width:${(n / total) * 100}%"></i></div>
        <div class="band-count">${n}</div>
      </div>`).join("");

    const answered = right + wrong;
    $("progress-stats").innerHTML = [
      stat(all.length, "words in bank"),
      stat(seen, "words seen"),
      stat(atCeiling, "at level 10 or above"),
      stat(answered ? Math.round((right / answered) * 100) + "%" : "-", "lifetime accuracy"),
      stat(answered, "cards answered"),
      stat(state.stats.rounds, "rounds done"),
    ].join("");

    const streaks = all
      .map((w) => ({ w, p: prog(w.id) }))
      .filter((x) => x.p.correctStreak > 0)
      .sort((a, b) => b.p.correctStreak - a.p.correctStreak || b.p.level - a.p.level)
      .slice(0, 12);

    $("streak-body").innerHTML = streaks.length
      ? streaks.map(({ w, p }) => `
          <tr>
            <td class="es">${esc(w.es)}</td>
            <td>${esc(w.en.join(", "))}</td>
            <td class="lvl">${p.level}</td>
            <td class="mono">${p.correctStreak}</td>
            <td class="mono small">${accuracy(p) === null ? "-" : accuracy(p) + "%"}</td>
          </tr>`).join("")
      : '<tr><td colspan="5" class="muted small">No streaks yet; answer a few cards.</td></tr>';
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  if (loaded.warning) toast(loaded.warning, true);
  refreshMenu();
  refreshWordSelect();
  updateStartBlurb();
  resetPracticeView();

  // Enter moves on from the verdict as well as submitting the answer, so a
  // round can be done without touching the mouse.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if ($("verdict").hidden || $("card").hidden) return;
    e.preventDefault();
    $("btn-next").click();
  });

  window.addEventListener("beforeunload", () => Store.saveNow(state));

  // Handy in the console while extending the bank by hand.
  window.Idioma = { get state() { return state; }, Engine, Store };
})();
