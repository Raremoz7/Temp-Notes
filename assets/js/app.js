/* =========================================================================
   app.js — orquestração de lapso
   Mural de notas vivas: várias notas com prazo, cada uma contando o próprio
   tempo. A tela central lista as que ainda vivem; quando o prazo acaba, a
   nota se desfaz e some para sempre. Persistência local só enquanto vivas.
   Modo "desabafo" continua transiente (não vai para o mural).
   ========================================================================= */

(function () {
  "use strict";

  var root   = document.documentElement;
  var text   = document.getElementById("text");
  var note   = document.getElementById("note");
  var stage  = document.getElementById("stage");
  var muralEl = document.getElementById("mural");
  var grid   = document.getElementById("grid");
  var muralEmpty = document.getElementById("muralEmpty");
  var emptyNew = document.getElementById("emptyNew");
  var dock   = document.getElementById("dock");
  var wheel  = document.getElementById("wheel");
  var track  = document.getElementById("wheelTrack");
  var readEl = document.getElementById("read");
  var timeEl = document.getElementById("time");
  var hintEl = document.getElementById("hint");
  var goneEl = document.getElementById("gone");
  var againEl = document.getElementById("again");
  var canvas = document.querySelector(".ash");
  var gear   = document.getElementById("gear");
  var sheet  = document.getElementById("sheet");
  var scrim  = document.getElementById("scrim");
  var sheetClose = document.getElementById("sheetClose");
  var previewCanvas = document.getElementById("previewCanvas");
  var optsEl = document.getElementById("opts");
  var newBtn = document.getElementById("newBtn");
  var muralBtn = document.getElementById("muralBtn");
  var home = document.querySelector(".mark");

  var items = Array.prototype.slice.call(track.querySelectorAll(".wheel__item"));
  var dissolve = window.createDissolve(canvas);
  var previewer = window.createPreviewer(previewCanvas, text);

  function prefersReduce() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---- armazenamento ---- */

  var STORE_STYLE = "lapso:endStyle";
  var STORE_NOTES = "lapso:notes";

  function loadStyle() { try { return localStorage.getItem(STORE_STYLE) || "brasa"; } catch (_) { return "brasa"; } }
  function saveStyle(v) { try { localStorage.setItem(STORE_STYLE, v); } catch (_) {} }
  var endStyle = loadStyle();

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(STORE_NOTES) || "[]"); } catch (_) { return []; }
  }
  function saveNotes(arr) {
    try { localStorage.setItem(STORE_NOTES, JSON.stringify(arr)); } catch (_) {}
  }
  function aliveNotes() {
    var now = Date.now();
    var all = loadNotes();
    var alive = all.filter(function (n) { return n.deathAt && n.deathAt > now; });
    if (alive.length !== all.length) saveNotes(alive);
    alive.sort(function (a, b) { return a.deathAt - b.deathAt; });
    return alive;
  }
  function upsertNote(n) {
    var a = loadNotes();
    var i = -1;
    for (var k = 0; k < a.length; k++) { if (a[k].id === n.id) { i = k; break; } }
    if (i >= 0) a[i] = n; else a.push(n);
    saveNotes(a);
  }
  function removeNote(id) {
    saveNotes(loadNotes().filter(function (n) { return n.id !== id; }));
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---- estado do editor ---- */

  var state = {
    mode: "timed",
    durationMs: 60000,
    running: false,
    dead: false,
    startAt: 0,
    lastInput: 0,
    momentum: 1
  };
  var current = null;       // nota aberta no editor
  var selected = null;      // item selecionado na roda
  var paused = false;       // congela a contagem com as configurações abertas

  var GRACE = 1900, DRAIN = 6200;

  /* ---- utilidades ---- */

  function fmt(ms) {
    if (ms < 0) ms = 0;
    var total = Math.ceil(ms / 1000);
    if (total >= 3600) {
      var h = Math.floor(total / 3600);
      var mm = Math.floor((total % 3600) / 60);
      return h + "h" + (mm < 10 ? "0" + mm : mm);
    }
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }
  function setHeat(heat, burn) {
    root.style.setProperty("--heat", heat.toFixed(3));
    root.style.setProperty("--burn", burn.toFixed(3));
  }
  function hasContent() { return text.value.trim().length > 0; }

  function resetClocks() {
    state.running = false;
    state.startAt = 0;
    state.lastInput = 0;
    state.momentum = 1;
    setHeat(0, 0);
    note.classList.remove("is-restless");
    readEl.classList.add("is-idle");
    timeEl.classList.remove("pulse");
  }

  /* ---- roda de tempo ---- */

  function markWheel(item) {
    for (var i = 0; i < items.length; i++) {
      var on = items[i] === item;
      items[i].classList.toggle("is-on", on);
      items[i].setAttribute("aria-checked", on ? "true" : "false");
    }
    selected = item;
  }

  function applyWheelToState() {
    if (!selected) return;
    if (selected.dataset.mode === "desabafo") state.mode = "desabafo";
    else { state.mode = "timed"; state.durationMs = parseInt(selected.dataset.secs, 10) * 1000; }
  }

  function setSelected(item) {
    if (!item || item === selected) return;
    markWheel(item);
    if (item.dataset.mode === "desabafo") {
      state.mode = "desabafo";
    } else {
      state.mode = "timed";
      state.durationMs = parseInt(item.dataset.secs, 10) * 1000;
      if (current) current.durationMs = state.durationMs;
    }
    if (!state.running) {
      resetClocks();
      timeEl.textContent = state.mode === "desabafo" ? "∞" : fmt(state.durationMs);
      hintEl.textContent = state.mode === "desabafo"
        ? "não pare de escrever" : "começa quando você escrever";
    }
  }

  var rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; updateWheel(); });
  }
  function updateWheel() {
    var wr = wheel.getBoundingClientRect();
    var cx = wr.left + wr.width / 2;
    var half = wr.width / 2 || 1;
    var nearest = null, best = Infinity;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var ic = r.left + r.width / 2;
      var dist = Math.abs(ic - cx);
      var norm = Math.min(1, dist / half);
      items[i].style.opacity = (1 - norm * 0.72).toFixed(3);
      items[i].style.transform = "scale(" + (1 - norm * 0.34).toFixed(3) + ")";
      if (dist < best) { best = dist; nearest = items[i]; }
    }
    if (!state.running) setSelected(nearest);
  }
  function centerItem(item, instant) {
    if (!item) return;
    item.scrollIntoView({
      inline: "center", block: "nearest",
      behavior: (instant || prefersReduce()) ? "auto" : "smooth"
    });
  }
  function selectWheelByDuration(ms) {
    var secs = Math.round(ms / 1000);
    var it = track.querySelector('.wheel__item[data-secs="' + secs + '"]');
    if (it) { markWheel(it); centerItem(it, true); requestAnimationFrame(updateWheel); }
  }

  items.forEach(function (it) {
    it.addEventListener("click", function () { if (!state.running) centerItem(it); });
  });
  wheel.addEventListener("wheel", function (e) {
    if (state.running) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { wheel.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  var dragging = false, dragX = 0, dragLeft = 0;
  wheel.addEventListener("pointerdown", function (e) {
    if (state.running || e.pointerType !== "mouse") return;
    dragging = true; dragX = e.clientX; dragLeft = wheel.scrollLeft;
    try { wheel.setPointerCapture(e.pointerId); } catch (_) {}
  });
  wheel.addEventListener("pointermove", function (e) {
    if (!dragging) return; wheel.scrollLeft = dragLeft - (e.clientX - dragX);
  });
  function endDrag() { dragging = false; }
  wheel.addEventListener("pointerup", endDrag);
  wheel.addEventListener("pointercancel", endDrag);
  wheel.addEventListener("keydown", function (e) {
    if (state.running) return;
    var idx = items.indexOf(selected);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); if (idx < items.length - 1) centerItem(items[idx + 1]); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); if (idx > 0) centerItem(items[idx - 1]); }
    else if (e.key === "Home") { e.preventDefault(); centerItem(items[0]); }
    else if (e.key === "End") { e.preventDefault(); centerItem(items[items.length - 1]); }
  });
  wheel.addEventListener("scroll", onScroll, { passive: true });

  /* ---- ciclo de vida da escrita ---- */

  function begin() {
    if (state.running || state.dead) return;
    if (!hasContent()) return;
    state.running = true;
    if (state.mode === "timed") {
      current.createdAt = Date.now();
      current.durationMs = state.durationMs;
      current.deathAt = Date.now() + state.durationMs;
      saveCurrent();
    } else {
      state.startAt = performance.now();
      state.lastInput = performance.now();
    }
    readEl.classList.remove("is-idle");
    wheel.classList.add("is-locked");
    hintEl.textContent = state.mode === "desabafo" ? "respire e continue" : "sem volta";
  }

  var saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 400);
  }
  function saveCurrent() {
    if (!current || state.mode !== "timed" || !current.deathAt) return;
    current.text = text.value;
    upsertNote({
      id: current.id, text: current.text, durationMs: current.durationMs,
      deathAt: current.deathAt, createdAt: current.createdAt
    });
  }
  function persistCurrent() {
    if (current && state.mode === "timed" && current.deathAt && text.value.trim()) saveCurrent();
  }

  text.addEventListener("input", function () {
    if (state.dead) return;
    if (!state.running) { begin(); return; }
    if (state.mode === "desabafo") {
      state.lastInput = performance.now();
      state.momentum = Math.min(1, state.momentum + 0.06);
    } else {
      current.text = text.value;
      scheduleSave();
    }
    autoGrow();
  });

  function autoGrow() {
    text.style.height = "auto";
    text.style.height = text.scrollHeight + "px";
  }

  /* ---- loop do editor ---- */

  function loop(now) {
    var dt = now - (loop._last || now);
    if (state.running && !state.dead) {
      if (state.mode === "timed") {
        if (paused && current) current.deathAt += dt;
        var remaining = current.deathAt - Date.now();
        var progress = Math.max(0, Math.min(1, 1 - remaining / current.durationMs));
        var heat = Math.pow(progress, 2.2);
        timeEl.textContent = fmt(remaining);
        applyTension(heat, progress, remaining, 10000);
        if (remaining <= 0) die();
      } else {
        if (paused) state.lastInput += dt;
        var idle = now - state.lastInput;
        if (idle > GRACE) state.momentum -= dt / DRAIN;
        state.momentum = Math.max(0, Math.min(1, state.momentum));
        var heatD = 1 - state.momentum;
        timeEl.textContent = "∞";
        applyTension(heatD, heatD, state.momentum, 0.42);
        if (state.momentum <= 0) die();
      }
    }
    loop._last = now;
    requestAnimationFrame(loop);
  }

  function applyTension(heat, burn, remaining, threshold) {
    setHeat(heat, burn);
    var urgency = remaining < threshold ? 1 - remaining / threshold : 0;
    urgency = Math.max(0, Math.min(1, urgency));
    if (urgency > 0.02) {
      note.classList.add("is-restless");
      root.style.setProperty("--shake", (urgency * 1.6).toFixed(2));
      timeEl.classList.add("pulse");
    } else {
      note.classList.remove("is-restless");
      timeEl.classList.remove("pulse");
    }
  }

  /* ---- a morte ---- */

  function die() {
    if (state.dead) return;
    state.dead = true;
    state.running = false;
    note.classList.remove("is-restless");
    timeEl.classList.remove("pulse");
    timeEl.textContent = state.mode === "timed" ? "0:00" : "—";
    if (current && state.mode === "timed" && current.deathAt) removeNote(current.id);
    text.setAttribute("readonly", "readonly");
    text.blur();
    dissolve.run(text, endStyle, afterDeath);
  }
  function afterDeath() {
    text.value = "";
    text.style.color = "";
    text.style.caretColor = "";
    text.style.height = "auto";
    text.style.display = "none";
    setHeat(0, 0);
    goneEl.hidden = false;
  }

  againEl.addEventListener("click", function () { showEditor(null); });

  /* ---- configurações: animação do fim ---- */

  var sheetOpen = false;

  (function buildOpts() {
    var styles = window.LAPSO_STYLES || [];
    styles.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "opt"; b.type = "button";
      b.setAttribute("role", "radio"); b.dataset.style = s.id;
      b.innerHTML = '<span class="opt__name">' + s.name + '</span>' +
                    '<span class="opt__desc">' + s.desc + '</span>';
      b.addEventListener("mouseenter", function () { if (sheetOpen) previewer.play(s.id); });
      b.addEventListener("focus", function () { if (sheetOpen) previewer.play(s.id); });
      b.addEventListener("mouseleave", function () { if (sheetOpen) previewer.play(endStyle); });
      b.addEventListener("click", function () { chooseStyle(s.id); });
      optsEl.appendChild(b);
    });
  })();
  function markStyle() {
    var opts = optsEl.querySelectorAll(".opt");
    for (var i = 0; i < opts.length; i++) {
      var on = opts[i].dataset.style === endStyle;
      opts[i].classList.toggle("is-sel", on);
      opts[i].setAttribute("aria-checked", on ? "true" : "false");
    }
  }
  markStyle();
  function chooseStyle(id) { endStyle = id; saveStyle(id); markStyle(); previewer.play(id); }
  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true; paused = true;
    sheet.hidden = false; markStyle();
    requestAnimationFrame(function () { previewer.play(endStyle); });
    sheetClose.focus();
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; paused = false;
    previewer.stop(); sheet.hidden = true; gear.focus();
  }
  gear.addEventListener("click", openSheet);
  scrim.addEventListener("click", closeSheet);
  sheetClose.addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetOpen) closeSheet(); });

  /* ---- roteamento: editor <-> mural ---- */

  function loadEditor(noteObj) {
    stopMuralLoop();
    state.dead = false;
    text.removeAttribute("readonly");
    text.style.display = "";
    text.style.color = "";
    text.style.caretColor = "";
    goneEl.hidden = true;

    if (noteObj) {
      // nota existente, contando o tempo
      current = {
        id: noteObj.id, text: noteObj.text || "", durationMs: noteObj.durationMs,
        deathAt: noteObj.deathAt, createdAt: noteObj.createdAt
      };
      state.mode = "timed";
      state.durationMs = current.durationMs;
      state.running = true;
      text.value = current.text;
      wheel.classList.add("is-locked");
      selectWheelByDuration(current.durationMs);
      readEl.classList.remove("is-idle");
      hintEl.textContent = "sem volta";
      timeEl.textContent = fmt(current.deathAt - Date.now());
    } else {
      // nota nova
      applyWheelToState();
      current = {
        id: newId(), text: "",
        durationMs: state.mode === "timed" ? state.durationMs : 0,
        deathAt: 0, createdAt: 0
      };
      state.running = false;
      state.momentum = 1;
      text.value = "";
      wheel.classList.remove("is-locked");
      setHeat(0, 0);
      readEl.classList.add("is-idle");
      timeEl.textContent = state.mode === "desabafo" ? "∞" : fmt(state.durationMs);
      hintEl.textContent = state.mode === "desabafo"
        ? "não pare de escrever" : "começa quando você escrever";
    }
    autoGrow();
    requestAnimationFrame(function () { recenter(true); });
  }

  function showEditor(noteObj) {
    muralEl.hidden = true;
    stage.hidden = false;
    dock.hidden = false;
    newBtn.hidden = true;
    muralBtn.hidden = false;
    loadEditor(noteObj);
    if (!("ontouchstart" in window)) text.focus();
  }

  function showMural() {
    persistCurrent();
    state.running = false;
    state.dead = false;
    stage.hidden = true;
    dock.hidden = true;
    muralEl.hidden = false;
    newBtn.hidden = false;
    muralBtn.hidden = true;
    renderMural();
    startMuralLoop();
  }

  /* ---- mural: render + loop ---- */

  function buildCard(n) {
    var b = document.createElement("button");
    b.className = "card"; b.type = "button"; b.dataset.id = n.id;
    var preview = (n.text || "").trim();
    var pv = document.createElement("p");
    pv.className = "card__text";
    if (preview) {
      pv.textContent = preview.length > 220 ? preview.slice(0, 220) + "…" : preview;
    } else {
      pv.className += " card__text--empty";
      pv.textContent = "(sem palavras)";
    }
    var foot = document.createElement("div");
    foot.className = "card__foot";
    var t = document.createElement("span");
    t.className = "card__time";
    var sp = document.createElement("span");
    sp.className = "card__spark";
    foot.appendChild(t); foot.appendChild(sp);
    b.appendChild(pv); b.appendChild(foot);
    b.addEventListener("click", function () { openNote(n.id); });
    b._note = n; b._timeEl = t;
    return b;
  }

  function renderMural() {
    var notes = aliveNotes();
    grid.innerHTML = "";
    if (!notes.length) {
      muralEmpty.hidden = false;
      grid.hidden = true;
      return;
    }
    muralEmpty.hidden = true;
    grid.hidden = false;
    notes.forEach(function (n) { grid.appendChild(buildCard(n)); });
  }

  function openNote(id) {
    var n = null, all = loadNotes();
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) { n = all[i]; break; } }
    if (!n) { renderMural(); return; }
    showEditor(n);
  }

  var muralRaf = null;
  function muralTick() {
    if (muralEl.hidden) { muralRaf = null; return; }
    var now = Date.now();
    var cards = grid.children;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var n = card._note;
      if (!n) continue;
      var remaining = n.deathAt - now;
      if (remaining <= 0) {
        if (!card.classList.contains("card--dying")) {
          card.classList.add("card--dying");
          removeNote(n.id);
          bindCardEnd(card);
        }
        continue;
      }
      var progress = Math.max(0, Math.min(1, 1 - remaining / n.durationMs));
      card.style.setProperty("--heat", Math.pow(progress, 2.2).toFixed(3));
      card._timeEl.textContent = fmt(remaining);
    }
    muralRaf = requestAnimationFrame(muralTick);
  }
  function bindCardEnd(card) {
    card.addEventListener("animationend", function () {
      if (card.parentNode) card.parentNode.removeChild(card);
      if (!grid.children.length) { muralEmpty.hidden = false; grid.hidden = true; }
    }, { once: true });
  }
  function startMuralLoop() { if (!muralRaf) muralRaf = requestAnimationFrame(muralTick); }
  function stopMuralLoop() { if (muralRaf) { cancelAnimationFrame(muralRaf); muralRaf = null; } }

  newBtn.addEventListener("click", function () { showEditor(null); });
  emptyNew.addEventListener("click", function () { showEditor(null); });
  muralBtn.addEventListener("click", showMural);
  if (home) home.addEventListener("click", function (e) { e.preventDefault(); showMural(); });

  /* ---- início ---- */

  function recenter(instant) {
    centerItem(selected, instant);
    requestAnimationFrame(updateWheel);
  }

  window.addEventListener("resize", function () { autoGrow(); recenter(true); });

  var initial = track.querySelector('.wheel__item[aria-checked="true"]') || items[0];
  markWheel(initial);
  applyWheelToState();
  requestAnimationFrame(loop);

  if (aliveNotes().length) showMural();
  else showEditor(null);

  window.addEventListener("load", function () {
    recenter(true);
    if (!muralEl.hidden) return;
    if (!("ontouchstart" in window)) text.focus();
  });
})();
