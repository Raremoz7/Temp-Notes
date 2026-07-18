/* =========================================================================
   app.js — orquestração de lapso
   Dois modos: "prazo" (contagem regressiva) e "desabafo" (a nota se esvai
   quando você para de escrever). Um único loop conduz calor, pavio e morte.
   ========================================================================= */

(function () {
  "use strict";

  var root   = document.documentElement;
  var text   = document.getElementById("text");
  var note   = document.getElementById("note");
  var dock   = document.getElementById("dock");
  var spanEl = document.getElementById("span");
  var readEl = document.getElementById("read");
  var timeEl = document.getElementById("time");
  var hintEl = document.getElementById("hint");
  var goneEl = document.getElementById("gone");
  var againEl = document.getElementById("again");
  var canvas = document.querySelector(".ash");

  var dissolve = window.createDissolve(canvas);

  // Constantes do modo desabafo
  var GRACE = 1900;   // fôlego antes de começar a se esvair
  var DRAIN = 6200;   // tempo até sumir de vez, parado

  var state = {
    mode: "timed",     // "timed" | "desabafo"
    durationMs: 60000, // duração escolhida no modo prazo
    running: false,    // já começou a correr?
    dead: false,
    startAt: 0,        // quando a contagem começou (timed)
    lastInput: 0,      // último toque de tecla (desabafo)
    momentum: 1        // fôlego restante (desabafo, 1..0)
  };

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

  function hasContent() {
    return text.value.trim().length > 0;
  }

  /* ---- seleção de tempo / modo ---- */

  function selectOption(btn) {
    var opts = spanEl.querySelectorAll(".span__opt");
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove("is-on");
      opts[i].setAttribute("aria-checked", "false");
    }
    btn.classList.add("is-on");
    btn.setAttribute("aria-checked", "true");

    if (btn.dataset.mode === "desabafo") {
      state.mode = "desabafo";
      hintEl.textContent = "não pare de escrever";
      timeEl.textContent = "∞";
    } else {
      state.mode = "timed";
      state.durationMs = parseInt(btn.dataset.secs, 10) * 1000;
      hintEl.textContent = "começa quando você escrever";
      timeEl.textContent = fmt(state.durationMs);
    }
    // Trocar de modo/tempo antes de começar reinicia o relógio.
    if (!state.running) resetClocks();
  }

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

  spanEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".span__opt");
    if (btn) selectOption(btn);
  });

  /* ---- ciclo de vida da escrita ---- */

  function begin() {
    if (state.running || state.dead) return;
    if (!hasContent()) return;
    state.running = true;
    state.startAt = performance.now();
    state.lastInput = state.startAt;
    readEl.classList.remove("is-idle");
    hintEl.textContent = state.mode === "desabafo" ? "respire e continue" : "sem volta";
  }

  text.addEventListener("input", function () {
    if (state.dead) return;
    if (!state.running) { begin(); return; }
    state.lastInput = performance.now();
    if (state.mode === "desabafo") {
      // escrever recupera fôlego
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
        // "tempo" aqui vira fôlego restante
        timeEl.textContent = "∞";
        applyTension(heatD, heatD, state.momentum, 0.42);
        if (state.momentum <= 0) die();
      }
    }
    loop._last = now;
    requestAnimationFrame(loop);
  }

  /* Converte calor em vinheta, pavio, tremor e pulso. */
  function applyTension(heat, burn, remaining, threshold) {
    setHeat(heat, burn);

    var urgency;
    if (state.mode === "timed") {
      urgency = remaining < threshold ? 1 - remaining / threshold : 0;
    } else {
      urgency = remaining < threshold ? 1 - remaining / threshold : 0;
    }
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
    // mantém o modo/tempo escolhido
    var active = spanEl.querySelector(".span__opt.is-on");
    if (active) {
      if (active.dataset.mode === "desabafo") { timeEl.textContent = "∞"; }
      else { timeEl.textContent = fmt(state.durationMs); }
    }
    hintEl.textContent = state.mode === "desabafo"
      ? "não pare de escrever" : "começa quando você escrever";
    text.focus();
  });

  /* ---- início ---- */

  window.addEventListener("resize", autoGrow);
  readEl.classList.add("is-idle");
  autoGrow();
  requestAnimationFrame(loop);

  // Foca a superfície de escrita — sem fricção, você já pode começar.
  window.addEventListener("load", function () {
    if (!("ontouchstart" in window)) text.focus();
  });
})();
