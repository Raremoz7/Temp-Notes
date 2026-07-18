/* =========================================================================
   app.js — orquestração de lapso
   Dois modos: "prazo" (contagem regressiva) e "desabafo" (a nota se esvai
   quando você para de escrever). Um único loop conduz calor, pavio e morte.
   A escolha de tempo é uma roda horizontal com snap — o valor no centro é o
   escolhido, como o seletor do timer do celular, deitado.
   ========================================================================= */

(function () {
  "use strict";

  var root   = document.documentElement;
  var text   = document.getElementById("text");
  var note   = document.getElementById("note");
  var wheel  = document.getElementById("wheel");
  var track  = document.getElementById("wheelTrack");
  var readEl = document.getElementById("read");
  var timeEl = document.getElementById("time");
  var hintEl = document.getElementById("hint");
  var goneEl = document.getElementById("gone");
  var againEl = document.getElementById("again");
  var canvas = document.querySelector(".ash");

  var items = Array.prototype.slice.call(track.querySelectorAll(".wheel__item"));
  var dissolve = window.createDissolve(canvas);

  function prefersReduce() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Constantes do modo desabafo
  var GRACE = 1900;   // fôlego antes de começar a se esvair
  var DRAIN = 6200;   // tempo até sumir de vez, parado

  var state = {
    mode: "timed",
    durationMs: 60000,
    running: false,
    dead: false,
    startAt: 0,
    lastInput: 0,
    momentum: 1
  };

  var selected = null;

  /* ---- utilidades ---- */

  function fmt(ms) {
    if (ms < 0) ms = 0;
    var total = Math.ceil(ms / 1000);
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

  /* ---- a roda de tempo ---- */

  function setSelected(item) {
    if (!item || item === selected) return;
    selected = item;
    for (var i = 0; i < items.length; i++) {
      var on = items[i] === item;
      items[i].classList.toggle("is-on", on);
      items[i].setAttribute("aria-checked", on ? "true" : "false");
    }
    if (item.dataset.mode === "desabafo") {
      state.mode = "desabafo";
    } else {
      state.mode = "timed";
      state.durationMs = parseInt(item.dataset.secs, 10) * 1000;
    }
    if (!state.running) {
      resetClocks();
      timeEl.textContent = state.mode === "desabafo" ? "∞" : fmt(state.durationMs);
      hintEl.textContent = state.mode === "desabafo"
        ? "não pare de escrever" : "começa quando você escrever";
    }
  }

  // Profundidade + detecção do item central. Roda a cada frame de scroll.
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
      inline: "center",
      block: "nearest",
      behavior: (instant || prefersReduce()) ? "auto" : "smooth"
    });
  }

  // Clique num item leva ele ao centro
  items.forEach(function (it) {
    it.addEventListener("click", function () {
      if (state.running) return;
      centerItem(it);
    });
  });

  // Roda do mouse (vertical) move a roda na horizontal — útil no desktop
  wheel.addEventListener("wheel", function (e) {
    if (state.running) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      wheel.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  // Arraste com o mouse (o toque já rola nativamente)
  var dragging = false, dragX = 0, dragLeft = 0;
  wheel.addEventListener("pointerdown", function (e) {
    if (state.running || e.pointerType !== "mouse") return;
    dragging = true;
    dragX = e.clientX;
    dragLeft = wheel.scrollLeft;
    try { wheel.setPointerCapture(e.pointerId); } catch (_) {}
  });
  wheel.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    wheel.scrollLeft = dragLeft - (e.clientX - dragX);
  });
  function endDrag() { dragging = false; }
  wheel.addEventListener("pointerup", endDrag);
  wheel.addEventListener("pointercancel", endDrag);

  // Teclado: setas movem a seleção
  wheel.addEventListener("keydown", function (e) {
    if (state.running) return;
    var idx = items.indexOf(selected);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < items.length - 1) centerItem(items[idx + 1]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) centerItem(items[idx - 1]);
    } else if (e.key === "Home") {
      e.preventDefault(); centerItem(items[0]);
    } else if (e.key === "End") {
      e.preventDefault(); centerItem(items[items.length - 1]);
    }
  });

  wheel.addEventListener("scroll", onScroll, { passive: true });

  /* ---- ciclo de vida da escrita ---- */

  function begin() {
    if (state.running || state.dead) return;
    if (!hasContent()) return;
    state.running = true;
    state.startAt = performance.now();
    state.lastInput = state.startAt;
    readEl.classList.remove("is-idle");
    wheel.classList.add("is-locked");
    hintEl.textContent = state.mode === "desabafo" ? "respire e continue" : "sem volta";
  }

  text.addEventListener("input", function () {
    if (state.dead) return;
    if (!state.running) { begin(); return; }
    state.lastInput = performance.now();
    if (state.mode === "desabafo") {
      state.momentum = Math.min(1, state.momentum + 0.06);
    }
    autoGrow();
  });

  function autoGrow() {
    text.style.height = "auto";
    text.style.height = text.scrollHeight + "px";
  }

  /* ---- o loop ---- */

  function loop(now) {
    if (state.running && !state.dead) {
      if (state.mode === "timed") {
        var elapsed = now - state.startAt;
        var remaining = state.durationMs - elapsed;
        var progress = Math.min(1, elapsed / state.durationMs);
        var heat = Math.pow(progress, 2.2);
        timeEl.textContent = fmt(remaining);
        applyTension(heat, progress, remaining, 10000);
        if (remaining <= 0) die();
      } else {
        var idle = now - state.lastInput;
        if (idle > GRACE) {
          state.momentum -= (now - (loop._last || now)) / DRAIN;
        }
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
    text.setAttribute("readonly", "readonly");
    text.blur();
    dissolve.run(text, afterDeath);
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

  /* ---- recomeçar ---- */

  againEl.addEventListener("click", function () {
    goneEl.hidden = true;
    state.dead = false;
    text.style.display = "";
    text.removeAttribute("readonly");
    text.value = "";
    autoGrow();
    resetClocks();
    wheel.classList.remove("is-locked");
    timeEl.textContent = state.mode === "desabafo" ? "∞" : fmt(state.durationMs);
    hintEl.textContent = state.mode === "desabafo"
      ? "não pare de escrever" : "começa quando você escrever";
    text.focus();
  });

  /* ---- início ---- */

  function recenter(instant) {
    centerItem(selected, instant);
    requestAnimationFrame(updateWheel);
  }

  window.addEventListener("resize", function () { autoGrow(); recenter(true); });

  // seleção inicial = item marcado no HTML (1 min)
  var initial = track.querySelector('.wheel__item[aria-checked="true"]') || items[0];
  setSelected(initial);
  readEl.classList.add("is-idle");
  autoGrow();
  requestAnimationFrame(function () { recenter(true); });
  requestAnimationFrame(loop);

  // recentra depois que as fontes carregam (métricas mudam)
  window.addEventListener("load", function () {
    recenter(true);
    if (!("ontouchstart" in window)) text.focus();
  });
})();
