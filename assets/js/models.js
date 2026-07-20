/* =========================================================================
   models.js — vocabulário do Do It Later
   Define o que é uma tarefa, as categorias, tempos, energias e os helpers
   de formatação/filtro. Nenhuma tela deve inventar esses valores: importa daqui.
   ========================================================================= */

/* ---- Estados ------------------------------------------------------------- */
export const STATUS = {
  ACTIVE: "active",  // na gaveta, disponível para sorteio
  DOING:  "doing",   // missão aceita, em andamento
  DONE:   "done",    // concluída, foi para o histórico
};

/* ---- Limite da versão gratuita ------------------------------------------ */
export const FREE_LIMIT = 30;

/* ---- Categorias básicas (as do plano gratuito) --------------------------- */
export const CATEGORIES = [
  { id: "casa",     label: "Casa",     accent: "blue"   },
  { id: "pessoas",  label: "Pessoas",  accent: "red"    },
  { id: "corpo",    label: "Corpo",    accent: "yellow" },
  { id: "estudar",  label: "Estudar",  accent: "blue"   },
  { id: "resolver", label: "Resolver", accent: "red"    },
  { id: "outros",   label: "Outros",   accent: "yellow" },
];

/* ---- Tempo estimado ------------------------------------------------------ */
/* value em minutos; null = sem estimativa */
export const TIMES = [
  { id: "t5",   value: 5,    label: "5 min"      },
  { id: "t15",  value: 15,   label: "15 min"     },
  { id: "t30",  value: 30,   label: "30 min"     },
  { id: "t60",  value: 60,   label: "1 h"        },
  { id: "t60p", value: 999,  label: "+1 h"       },
  { id: "tnone",value: null, label: "sem estimar"},
];

/* ---- Nível de energia ---------------------------------------------------- */
export const ENERGIES = [
  { id: "low",  value: 1, label: "Pouca energia", short: "pouca energia" },
  { id: "med",  value: 2, label: "Energia média", short: "energia média" },
  { id: "high", value: 3, label: "Muita energia", short: "muita energia" },
];

/* ---- Fábrica de tarefa --------------------------------------------------- */
export function makeTask(data = {}) {
  return {
    id:        data.id || genId(),
    title:     (data.title || "").trim(),
    note:      (data.note || "").trim(),
    category:  data.category || "outros",
    time:      data.time || "tnone",   // id de TIMES
    energy:    data.energy || "med",   // id de ENERGIES
    outside:   !!data.outside,         // exige sair de casa?
    tags:      Array.isArray(data.tags) ? data.tags : [],  // Pro
    status:    data.status || STATUS.ACTIVE,
    createdAt: data.createdAt || Date.now(),
    completedAt: data.completedAt || null,
  };
}

export function genId() {
  return "t_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/* ---- Lookups ------------------------------------------------------------- */
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];
export const timeOf     = (id) => TIMES.find((t) => t.id === id)      || TIMES[5];
export const energyOf   = (id) => ENERGIES.find((e) => e.id === id)   || ENERGIES[1];

/* ---- Formatação humana --------------------------------------------------- */

/* "Guardada há 12 dias" — sempre leve, nunca "atrasada". */
export function ageLabel(createdAt) {
  const ms = Date.now() - createdAt;
  const min = Math.floor(ms / 60000);
  if (min < 1)  return "guardada agora mesmo";
  if (min < 60) return `guardada há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `guardada há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1)  return "guardada há 1 dia";
  if (d < 30)   return `guardada há ${d} dias`;
  const mo = Math.floor(d / 30);
  return mo === 1 ? "guardada há 1 mês" : `guardada há ${mo} meses`;
}

export function doneLabel(completedAt) {
  const ms = Date.now() - completedAt;
  const d = Math.floor(ms / 86400000);
  if (d < 1)  return "feita hoje";
  if (d === 1) return "feita ontem";
  if (d < 30) return `feita há ${d} dias`;
  return "feita há um tempo";
}

/* Etiqueta curta "15 min · pouca energia" para os cartões */
export function metaLine(task) {
  const t = timeOf(task.time);
  const e = energyOf(task.energy);
  const parts = [];
  if (t.value !== null) parts.push(t.label);
  parts.push(e.short);
  if (task.outside) parts.push("sair de casa");
  return parts.join(" · ");
}

/* ---- Filtro da roleta ---------------------------------------------------- */
/* filters: { time: 'tX'|null, energy: 'low'|null, category: id|null,
             place: 'home'|'out'|null }
   Regra de tempo: a tarefa cabe se o tempo dela <= tempo disponível.
   Regra de energia: a tarefa cabe se exige <= energia disponível. */
export function matchesFilters(task, filters = {}) {
  if (task.status !== STATUS.ACTIVE) return false;

  if (filters.time) {
    const avail = timeOf(filters.time).value;
    const need = timeOf(task.time).value;
    // "sem estimar" (need null) entra em qualquer tempo; +1h (999) só no +1h
    if (avail !== null && need !== null && need > avail) return false;
  }
  if (filters.energy) {
    const avail = energyOf(filters.energy).value;
    if (energyOf(task.energy).value > avail) return false;
  }
  if (filters.category && task.category !== filters.category) return false;

  if (filters.place === "home" && task.outside) return false;
  if (filters.place === "out"  && !task.outside) return false;

  return true;
}
