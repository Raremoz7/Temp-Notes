/* =========================================================================
   dissolve.js — motor de partículas
   Captura o texto renderizado, transforma cada glifo em brasa e cinza,
   e deixa o vento levar as palavras embora. Sem dependências.
   ========================================================================= */

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;
  var EMBER = ["#ff7a3c", "#ffa24b", "#ffcf85"];   // fagulhas que brilham
  var ASH   = ["#e7e0d0", "#c6bdac", "#b0a794"];   // cinza que se apaga

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }

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

    /* Quebra o texto em linhas respeitando a largura de conteúdo do editor,
       para que a cinza nasça exatamente onde as palavras estavam. */
    function wrap(text, maxWidth) {
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

    /* Dissolve o conteúdo de `sourceEl` (um textarea ou elemento de texto). */
    function run(sourceEl, onDone) {
      var reduce = global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches;

      var rect = sourceEl.getBoundingClientRect();
      var cs = getComputedStyle(sourceEl);
      var fontSize = parseFloat(cs.fontSize);
      var lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.6;
      var font = cs.fontStyle + " " + cs.fontWeight + " " + fontSize + "px " + cs.fontFamily;
      var padL = parseFloat(cs.paddingLeft) || 0;
      var padT = parseFloat(cs.paddingTop) || 0;
      var contentW = rect.width - padL - (parseFloat(cs.paddingRight) || 0);

      var text = (sourceEl.value != null ? sourceEl.value : sourceEl.textContent) || "";
      text = text.replace(/[ \t]+$/gm, "");

      ctx.font = font;
      var lines = wrap(text, contentW);

      var startX = rect.left + padL;
      var startY = rect.top + padT;

      // Densidade de amostragem — abre a malha em textos longos p/ manter fluidez.
      var len = text.length;
      var gap = 3;
      if (len > 320) gap = 4;
      if (len > 800) gap = 5;
      if (len > 1600) gap = 6;

      var particles = [];
      var buf = document.createElement("canvas");
      var bctx = buf.getContext("2d");

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        if (!line) continue;
        var w = Math.ceil(ctx.measureText(line).width) + 2;
        var h = Math.ceil(lineHeight) + 2;
        if (w < 2) continue;
        buf.width = w; buf.height = h;
        bctx.clearRect(0, 0, w, h);
        bctx.font = font;
        bctx.textBaseline = "alphabetic";
        bctx.fillStyle = "#fff";
        // baseline aproximado dentro da caixa de linha
        var baseline = (lineHeight + fontSize * 0.72) / 2;
        bctx.fillText(line, 0, baseline);

        var data = bctx.getImageData(0, 0, w, h).data;
        var lineTop = startY + li * lineHeight;

        for (var y = 0; y < h; y += gap) {
          for (var x = 0; x < w; x += gap) {
            if (data[(y * w + x) * 4 + 3] > 90) {
              particles.push(makeParticle(
                startX + x + rand(-gap * 0.4, gap * 0.4),
                lineTop + y + rand(-gap * 0.4, gap * 0.4),
                x / Math.max(contentW, 1),
                gap
              ));
            }
          }
        }
      }

      // Esconde o texto real; a cinza assume o lugar dele.
      sourceEl.style.color = "transparent";
      sourceEl.style.caretColor = "transparent";

      if (!particles.length || reduce) {
        // Sem partículas (nota vazia) ou movimento reduzido: um fade sóbrio.
        fadeOut(sourceEl, onDone);
        return;
      }

      animate(particles, onDone);
    }

    function makeParticle(x, y, xFrac, gap) {
      var isEmber = Math.random() < 0.16;
      // O vento varre da esquerda para a direita.
      var delay = xFrac * 620 + rand(0, 220);
      return {
        x: x, y: y,
        color: isEmber ? pick(EMBER) : pick(ASH),
        ember: isEmber,
        delay: delay,
        life: rand(820, 1500) + (isEmber ? 260 : 0),
        rise: rand(38, 128) + (isEmber ? 60 : 0),
        drift: rand(10, 46),
        amp: rand(5, 20),
        freq: rand(1.4, 3.0),
        seed: rand(0, TAU),
        size: gap * rand(0.72, 1.18)
      };
    }

    function animate(particles, onDone) {
      var maxTail = 0;
      for (var i = 0; i < particles.length; i++) {
        maxTail = Math.max(maxTail, particles[i].delay + particles[i].life);
      }
      var t0 = null;

      function frame(now) {
        if (t0 === null) t0 = now;
        var t = now - t0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var tp = t - p.delay;

          if (tp < 0) {
            // Ainda "palavra": desenha parada até o vento chegar.
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            continue;
          }

          var k = tp / p.life;
          if (k >= 1) continue;

          var ease = k * (2 - k);                 // easeOutQuad p/ o fade
          var up = p.rise * (k * k * 0.55 + k * 0.45);
          var sway = p.amp * Math.sin(p.seed + k * p.freq * TAU) * k
                   + p.drift * k * 0.4;
          var px = p.x + sway;
          var py = p.y - up;
          var r = p.size * (1 - 0.45 * k);

          if (p.ember) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = (1 - ease) * 0.95;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = (5 + (1 - k) * 9);
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = (1 - ease) * 0.85;
            ctx.shadowBlur = 0;
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
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (onDone) onDone();
        }
      }
      global.requestAnimationFrame(frame);
    }

    // Fallback elegante p/ movimento reduzido / nota vazia.
    function fadeOut(sourceEl, onDone) {
      sourceEl.style.color = "";
      var prev = sourceEl.style.transition;
      sourceEl.style.transition = "opacity 640ms ease";
      // força reflow para a transição valer
      void sourceEl.offsetWidth;
      sourceEl.style.opacity = "0";
      setTimeout(function () {
        sourceEl.style.opacity = "";
        sourceEl.style.transition = prev;
        if (onDone) onDone();
      }, 700);
    }

    return { run: run };
  }

  global.createDissolve = createDissolve;
})(window);
