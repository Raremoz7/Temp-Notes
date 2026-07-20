/* =========================================================================
   roulette.js — o ritual de deixar o app escolher
   Sorteio justo entre as tarefas compatíveis + a animação do "reel": os
   títulos passam rápido e vão desacelerando até parar num deles. Sem cassino:
   é um objeto girando e um respiro antes da missão aparecer.
   ========================================================================= */

import { matchesFilters } from "./models.js";

/* Retorna as tarefas ativas que passam pelos filtros. */
export function candidates(tasks, filters) {
  return tasks.filter((t) => matchesFilters(t, filters));
}

/* Escolhe uma ao acaso; opcionalmente evita repetir a última. */
export function pick(list, avoidId = null) {
  if (!list.length) return null;
  let pool = list;
  if (avoidId && list.length > 1) {
    const filtered = list.filter((t) => t.id !== avoidId);
    if (filtered.length) pool = filtered;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Anima o embaralhar dos títulos no elemento `el` e resolve quando para.
   Desaceleração por passo crescente (efeito de roleta perdendo força).
   Respeita prefers-reduced-motion: nesse caso, só revela o vencedor. */
export function spin(el, pool, winner, { suspense = true } = {}) {
  return new Promise((resolve) => {
    const reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || pool.length <= 1) {
      el.textContent = winner.title;
      el.classList.remove("is-spinning");
      resolve();
      return;
    }

    el.classList.add("is-spinning");
    const titles = pool.map((t) => t.title);
    // total de trocas e ritmo dependem do "suspense"
    const steps = suspense ? 22 : 13;
    let i = 0;
    let delay = suspense ? 42 : 34;

    const tick = () => {
      // nos últimos passos, garante que estamos "mirando" no vencedor
      const remaining = steps - i;
      let label;
      if (remaining <= 1) label = winner.title;
      else label = titles[(Math.random() * titles.length) | 0];

      el.textContent = label;
      el.animate(
        [{ opacity: 0.25, transform: "translateY(6px)" },
         { opacity: 1, transform: "translateY(0)" }],
        { duration: Math.min(delay, 160), easing: "ease-out" }
      );

      i++;
      if (i >= steps) {
        el.textContent = winner.title;
        el.classList.remove("is-spinning");
        el.classList.add("is-landed");
        setTimeout(() => el.classList.remove("is-landed"), 700);
        resolve();
        return;
      }
      // desacelera: cada passo um pouco mais lento perto do fim (com teto)
      if (i > steps * 0.55) delay = Math.min(delay * 1.2, 260);
      setTimeout(tick, delay);
    };
    tick();
  });
}
