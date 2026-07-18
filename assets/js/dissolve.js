/* =========================================================================
   dissolve.js — motor de dissolução com múltiplos estilos
   Captura o texto renderizado e o desfaz de quatro jeitos: brasa, vapor,
   poeira e glitch. Serve tanto para a morte real da nota quanto para os
   previews ao vivo do painel de configurações. Sem dependências.
   ========================================================================= */

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  // Catálogo exposto para a UI montar as opções
  var CATALOG = [
    { id: "brasa",  name: "brasa",  desc: "vira fagulha e cinza levada pelo vento" },
    { id: "vapor",  name: "vapor",  desc: "desfoca, sobe e evapora como fumaça" },
    { id: "poeira", name: "poeira", desc: "as letras se esfarelam ao vento" },
    { id: "glitch", name: "glitch", desc: "corrompe, se parte e colapsa" }
  ];

  // Parâmetros de cada estilo baseado em partículas
  var STYLES = {
    brasa: {
      ember: 0.16, delayBy: "x", sweep: 620, jitter: 220,
      colors: ["#e7e0d0", "#c6bdac", "#b0a794"],
      emberColors: ["#ff7a3c", "#ffa24b", "#ffcf85"],
      life: [820, 1500], emberLife: 260,
      rise: [38, 128], driftX: [-6, 18], gravity: 0,
      sway: [5, 20], grow: 0, alphaMul: 0.9, blur: false
    },
    vapor: {
      ember: 0, delayBy: "y", sweep: 520, jitter: 320,
      colors: ["#dfe6ea", "#cdd8de", "#eef3f5"],
      emberColors: ["#dfe6ea"],
      life: [1200, 2050], emberLife: 0,
      rise: [70, 176], driftX: [-12, 12], gravity: 0,
      sway: [6, 16], grow: 1.5, alphaMul: 0.62, blur: true
    },
    poeira: {
      ember: 0, delayBy: "x", sweep: 480, jitter: 140,
      colors: ["#d8cfbd", "#b8b0a0", "#9a9184"],
      emberColors: ["#d8cfbd"],
      life: [680, 1180], emberLife: 0,
      rise: [4, 28], driftX: [120, 320], gravity: 46,
      sway: [2, 8], grow: 0, alphaMul: 0.92, blur: false
    }
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }

  function prefersReduce() {
    return global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---- quebra de linha ---- */

  function wrap(ctx, text, maxWidth) {
    var out = [];
    var paras = String(text).split("\n");
    for (var p = 0; p < paras.length; p++) {
      var para = paras[p];
      if (para === "") { out.push(""); continue; }
      var tokens = para.split(/(\s+)/);
      var line = "";
      for (var i = 0; i < tokens.length; i++) {
        var next = line + tokens[i];
        if (ctx.measureText(next).width > maxWidth && line.trim() !== "") {
          out.push(line.replace(/\s+$/, ""));
          line = tokens[i].replace(/^\s+/, "");
        } else {
          line = next;
        }
      }
      out.push(line.replace(/\s+$/, ""));
    }
    return out;
  }

  /* ---- amostragem de partículas ---- */

  function sampleParticles(ctx, m, sp) {
    ctx.font = m.font;
    var lines = wrap(ctx, m.text, m.contentW);

    var len = m.text.length;
    var gap = 3;
    if (len > 320) gap = 4;
    if (len > 800) gap = 5;
    if (len > 1600) gap = 6;

    var blockH = Math.max(1, lines.length * m.lineHeight);
    var particles = [];
    var buf = document.createElement("canvas");
    var bctx = buf.getContext("2d");

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (!line) continue;
      var w = Math.ceil(ctx.measureText(line).width) + 2;
      var h = Math.ceil(m.lineHeight) + 2;
      if (w < 2) continue;
      buf.width = w; buf.height = h;
      bctx.clearRect(0, 0, w, h);
      bctx.font = m.font;
      bctx.textBaseline = "alphabetic";
      bctx.fillStyle = "#fff";
      bctx.fillText(line, 0, (m.lineHeight + m.fontSize * 0.72) / 2);

      var data = bctx.getImageData(0, 0, w, h).data;
      var lineTop = m.originY + li * m.lineHeight;

      for (var y = 0; y < h; y += gap) {
        for (var x = 0; x < w; x += gap) {
          if (data[(y * w + x) * 4 + 3] > 90) {
            var gx = m.originX + x + rand(-gap * 0.4, gap * 0.4);
            var gy = lineTop + y + rand(-gap * 0.4, gap * 0.4);
            particles.push(makeParticle(
              gx, gy,
              x / Math.max(m.contentW, 1),
              (li * m.lineHeight + y) / blockH,
              gap, sp
            ));
          }
        }
      }
    }
    return particles;
  }

  function makeParticle(x, y, xFrac, yFrac, gap, sp) {
    var ember = Math.random() < sp.ember;
    var frac = sp.delayBy === "y" ? yFrac : xFrac;
    var delay = (sp.delayBy === "none" ? 0 : frac * sp.sweep) + rand(0, sp.jitter);
    return {
      x: x, y: y,
      color: ember ? pick(sp.emberColors) : pick(sp.colors),
      ember: ember,
      delay: delay,
      life: rand(sp.life[0], sp.life[1]) + (ember ? sp.emberLife : 0),
      vy: rand(sp.rise[0], sp.rise[1]) * (ember ? 1.3 : 1),
      vx: rand(sp.driftX[0], sp.driftX[1]),
      gravity: sp.gravity,
      amp: rand(sp.sway[0], sp.sway[1]),
      freq: rand(1.4, 3.0),
      seed: rand(0, TAU),
      size: gap * rand(0.72, 1.18),
      grow: sp.grow
    };
  }

  function animateParticles(ctx, dims, particles, sp, onDone) {
    var maxTail = 0;
    for (var i = 0; i < particles.length; i++) {
      maxTail = Math.max(maxTail, particles[i].delay + particles[i].life);
    }
    var t0 = null;

    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var tp = t - p.delay;

        if (tp < 0) {
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          ctx.shadowBlur = 0;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          continue;
        }

        var k = tp / p.life;
        if (k >= 1) continue;

        var ease = k * (2 - k);
        var up = p.vy * (k * k * 0.55 + k * 0.45);
        var down = p.gravity * k * k;
        var sway = p.amp * Math.sin(p.seed + k * p.freq * TAU) * k;
        var px = p.x + p.vx * k + sway;
        var py = p.y - up + down;
        var r = p.grow ? p.size * (1 + p.grow * k) : p.size * (1 - 0.45 * k);

        if (p.ember) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - ease) * 0.95;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 5 + (1 - k) * 9;
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = (1 - ease) * sp.alphaMul;
          if (sp.blur) { ctx.shadowColor = p.color; ctx.shadowBlur = 4 + (1 - k) * 9; }
          else ctx.shadowBlur = 0;
        }
        ctx.fillStyle = p.color;
        ctx.fillRect(px, py, r, r);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (t < maxTail + 40) {
        global.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, dims.w, dims.h);
        if (onDone) onDone();
      }
    }
    global.requestAnimationFrame(frame);
  }

  /* ---- glitch ---- */

  function tint(src, color) {
    var c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    var cx = c.getContext("2d");
    cx.drawImage(src, 0, 0);
    cx.globalCompositeOperation = "source-in";
    cx.fillStyle = color;
    cx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function buildGlitch(ctx, m) {
    ctx.font = m.font;
    var lines = wrap(ctx, m.text, m.contentW);
    var maxW = 2;
    for (var i = 0; i < lines.length; i++) {
      maxW = Math.max(maxW, ctx.measureText(lines[i]).width);
    }
    var w = Math.ceil(maxW) + 4;
    var h = Math.ceil(lines.length * m.lineHeight) + 4;

    var white = document.createElement("canvas");
    white.width = w; white.height = h;
    var wc = white.getContext("2d");
    wc.font = m.font;
    wc.textBaseline = "alphabetic";
    wc.fillStyle = "#f4efe4";
    for (var l = 0; l < lines.length; l++) {
      if (lines[l]) wc.fillText(lines[l], 0, l * m.lineHeight + (m.lineHeight + m.fontSize * 0.72) / 2);
    }
    return {
      white: white,
      red: tint(white, "#ff2d3b"),
      cyan: tint(white, "#31e9ff"),
      w: w, h: h, x: m.originX, y: m.originY
    };
  }

  function animateGlitch(ctx, dims, g, onDone) {
    var DUR = 1300;
    var t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;
      var k = Math.min(1, t / DUR);
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);

      var dx = 2 + k * 15;

      // aberração cromática
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(g.red, g.x - dx * (0.6 + Math.random() * 0.8), g.y);
      ctx.drawImage(g.cyan, g.x + dx * (0.6 + Math.random() * 0.8), g.y);

      // fatias horizontais deslocadas
      var bands = 15;
      var bh = g.h / bands;
      for (var i = 0; i < bands; i++) {
        var shift = (Math.random() < 0.32 + k * 0.5) ? rand(-dx * 2.4, dx * 2.4) * (0.5 + k) : 0;
        ctx.drawImage(g.white, 0, i * bh, g.w, bh, g.x + shift, g.y + i * bh, g.w, bh);
      }

      // buracos / dropout
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      if (k > 0.28) {
        for (var d = 0; d < 4; d++) {
          if (Math.random() < k) {
            ctx.fillStyle = "#000";
            ctx.fillRect(g.x + rand(-4, g.w), g.y + rand(0, g.h), rand(12, 70), rand(2, bh + 2));
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      if (t < DUR) {
        global.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, dims.w, dims.h);
        if (onDone) onDone();
      }
    }
    global.requestAnimationFrame(frame);
  }

  /* ---- despacho por estilo ---- */

  function runStyle(ctx, dims, m, style, onDone) {
    if (style === "glitch") {
      animateGlitch(ctx, dims, buildGlitch(ctx, m), onDone);
    } else {
      var sp = STYLES[style] || STYLES.brasa;
      animateParticles(ctx, dims, sampleParticles(ctx, m, sp), sp, onDone);
    }
  }

  function metricsFromEl(el) {
    var rect = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var fontSize = parseFloat(cs.fontSize);
    var lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.6;
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padT = parseFloat(cs.paddingTop) || 0;
    var text = (el.value != null ? el.value : el.textContent) || "";
    return {
      text: text.replace(/[ \t]+$/gm, ""),
      font: cs.fontStyle + " " + cs.fontWeight + " " + fontSize + "px " + cs.fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      originX: rect.left + padL,
      originY: rect.top + padT,
      contentW: rect.width - padL - (parseFloat(cs.paddingRight) || 0),
      color: cs.color
    };
  }

  /* ---- morte real da nota (canvas de tela cheia) ---- */

  function createDissolve(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = 1;
    function fit() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(global.innerWidth * dpr);
      canvas.height = Math.floor(global.innerHeight * dpr);
      canvas.style.width = global.innerWidth + "px";
      canvas.style.height = global.innerHeight + "px";
    }
    fit();
    global.addEventListener("resize", fit);

    function fadeOut(el, onDone) {
      el.style.color = "";
      var prev = el.style.transition;
      el.style.transition = "opacity 640ms ease";
      void el.offsetWidth;
      el.style.opacity = "0";
      setTimeout(function () {
        el.style.opacity = ""; el.style.transition = prev;
        if (onDone) onDone();
      }, 700);
    }

    function run(el, style, onDone) {
      var m = metricsFromEl(el);
      el.style.color = "transparent";
      el.style.caretColor = "transparent";
      if (!m.text.trim() || prefersReduce()) { fadeOut(el, onDone); return; }
      runStyle(ctx, { dpr: dpr, w: global.innerWidth, h: global.innerHeight }, m, style, onDone);
    }

    return { run: run };
  }

  /* ---- previewer (canvas pequeno, em loop) ---- */

  function createPreviewer(canvas, refEl) {
    var ctx = canvas.getContext("2d");
    var dpr = 1, cssW = 0, cssH = 0;
    var running = false, style = "brasa", word = "lembrança";
    var timers = [];

    function fit() {
      var r = canvas.getBoundingClientRect();
      cssW = r.width; cssH = r.height;
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }

    function metrics() {
      var cs = getComputedStyle(refEl);
      var serif = cs.fontFamily;
      var fontSize = Math.min(cssH * 0.4, (cssW * 0.82) / (word.length * 0.5));
      fontSize = Math.max(20, Math.min(46, fontSize));
      var lineHeight = fontSize * 1.35;
      var font = "italic 400 " + fontSize + "px " + serif;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = font;
      var tw = ctx.measureText(word).width;
      return {
        text: word, font: font, fontSize: fontSize, lineHeight: lineHeight,
        originX: (cssW - tw) / 2,
        originY: cssH / 2 - lineHeight / 2,
        contentW: tw + 4, color: cs.color
      };
    }

    function showWord(m) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.font = m.font;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#ece5d6";
      ctx.fillText(word, m.originX, m.originY + (m.lineHeight + m.fontSize * 0.72) / 2);
    }

    function clearTimers() {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
    }

    function cycle() {
      if (!running) return;
      var m = metrics();
      showWord(m);
      timers.push(setTimeout(function () {
        if (!running) return;
        runStyle(ctx, { dpr: dpr, w: cssW, h: cssH }, m, style, function () {
          if (!running) return;
          timers.push(setTimeout(cycle, 560));
        });
      }, 720));
    }

    function play(nextStyle) {
      style = nextStyle || style;
      clearTimers();
      running = true;
      fit();
      cycle();
    }

    function stop() {
      running = false;
      clearTimers();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
    }

    return { play: play, stop: stop };
  }

  global.createDissolve = createDissolve;
  global.createPreviewer = createPreviewer;
  global.LAPSO_STYLES = CATALOG;
})(window);
