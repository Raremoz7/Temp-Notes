/* =========================================================================
   store.js — estado e persistência local
   Uma única fonte de verdade. As telas leem daqui e assinam mudanças; nada
   fala com o localStorage diretamente. Trocar por um backend no futuro é
   reimplementar só este arquivo.
   ========================================================================= */

import { makeTask, STATUS } from "./models.js";
import { seedTasks } from "./seed.js";

const KEY_TASKS = "doitlater:tasks";
const KEY_PREFS = "doitlater:prefs";
const KEY_SEEN  = "doitlater:onboarded";

const DEFAULT_PREFS = {
  theme: "auto",       // 'auto' | 'light' | 'dark'
  hideAge: false,      // Modo Sem Culpa (Pro): esconder "guardada há X"
  rouletteSuspense: true, // animação longa da roleta
  pro: false,          // simula ter o Pro (só afeta o protótipo)
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

export class Store {
  constructor() {
    const saved = read(KEY_TASKS, null);
    // Primeira visita: semeia a gaveta com os exemplos do briefing.
    this.tasks = (saved || seedTasks()).map(makeTask);
    this.prefs = Object.assign({}, DEFAULT_PREFS, read(KEY_PREFS, {}));
    this.onboarded = read(KEY_SEEN, false);
    this._subs = new Set();
    if (!saved) this._persistTasks();
  }

  /* ---- assinatura ---- */
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _emit() { this._subs.forEach((fn) => fn(this)); }
  _persistTasks() { write(KEY_TASKS, this.tasks); }
  _persistPrefs() { write(KEY_PREFS, this.prefs); }

  /* ---- consultas ---- */
  get active()  { return this.tasks.filter((t) => t.status === STATUS.ACTIVE); }
  get doing()   { return this.tasks.filter((t) => t.status === STATUS.DOING); }
  get done()    { return this.tasks.filter((t) => t.status === STATUS.DONE)
                              .sort((a, b) => b.completedAt - a.completedAt); }
  byId(id)      { return this.tasks.find((t) => t.id === id) || null; }
  get activeCount() { return this.active.length; }
  atLimit()     { return !this.prefs.pro && this.activeCount >= 30; }

  /* ---- mutações de tarefa ---- */
  add(data) {
    const task = makeTask(data);
    this.tasks.push(task);
    this._persistTasks(); this._emit();
    return task;
  }
  update(id, patch) {
    const t = this.byId(id);
    if (!t) return null;
    Object.assign(t, patch);
    this._persistTasks(); this._emit();
    return t;
  }
  remove(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this._persistTasks(); this._emit();
  }

  /* transições de estado — sem punição, sempre reversíveis */
  accept(id)   { return this.update(id, { status: STATUS.DOING }); }       // aceitar missão
  release(id)  { return this.update(id, { status: STATUS.ACTIVE }); }      // devolver p/ gaveta
  complete(id) { return this.update(id, { status: STATUS.DONE, completedAt: Date.now() }); }
  restore(id)  { return this.update(id, { status: STATUS.ACTIVE, completedAt: null }); }

  /* ---- preferências ---- */
  setPref(key, value) {
    this.prefs[key] = value;
    this._persistPrefs(); this._emit();
  }

  /* ---- onboarding ---- */
  markOnboarded() { this.onboarded = true; write(KEY_SEEN, true); }

  /* ---- reset (para demonstração) ---- */
  reset() {
    this.tasks = seedTasks().map(makeTask);
    this.prefs = Object.assign({}, DEFAULT_PREFS);
    this._persistTasks(); this._persistPrefs();
    write(KEY_SEEN, false); this.onboarded = false;
    this._emit();
  }
}
