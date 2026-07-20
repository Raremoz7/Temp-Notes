/* =========================================================================
   app.js — orquestração do Do It Later
   Router de telas, renderização a partir do estado, roleta, formulários e
   overlays. Nenhuma regra de negócio mora aqui: isso está em models/store.
   ========================================================================= */

import {
  CATEGORIES, TIMES, ENERGIES, STATUS, FREE_LIMIT,
  categoryOf, timeOf, energyOf, metaLine, ageLabel, doneLabel,
} from "./models.js";
import { Store } from "./store.js";
import { candidates, pick, spin } from "./roulette.js";

const store = new Store();
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escape = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------------------------------------------------------- tema ---- */
function applyTheme() {
  const t = store.prefs.theme;
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  const dark = t === "dark" ||
    (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#070b18" : "#bcd0ec");
}

/* -------------------------------------------------------------- toast ----- */
let toastTimer;
function toast(msg, actionLabel, onAction) {
  const el = $("#toast"), m = $("#toastMsg"), a = $("#toastAction");
  m.textContent = msg;
  clearTimeout(toastTimer);
  if (actionLabel) {
    a.textContent = actionLabel; a.hidden = false;
    a.onclick = () => { hideToast(); onAction && onAction(); };
  } else { a.hidden = true; a.onclick = null; }
  el.classList.add("is-on");
  toastTimer = setTimeout(hideToast, 4200);
}
function hideToast() { $("#toast").classList.remove("is-on"); }

/* --------------------------------------------------------- navegação ------ */
let currentTab = "inbox";
function go(tab) {
  currentTab = tab;
  $$(".screen").forEach((s) => { s.hidden = s.dataset.screen !== tab; });
  $$(".nav__tab").forEach((t) => t.classList.toggle("is-on", t.dataset.tab === tab));
  $("#viewport").scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  if (tab === "roulette") { syncFilterUI(); renderRouletteState(); }
}
$("#nav").addEventListener("click", (e) => {
  const tab = e.target.closest(".nav__tab");
  if (tab) go(tab.dataset.tab);
});

/* ============================================================ GAVETA ====== */
let inboxCat = ""; // filtro de categoria da gaveta

function renderInbox() {
  const all = store.active;
  const list = inboxCat ? all.filter((t) => t.category === inboxCat) : all;

  // subtítulo + badge + contadores
  const n = all.length;
  $("#inboxSub").textContent = n === 0 ? "está vazia."
    : n === 1 ? "tem 1 coisa." : `tem ${n} coisas.`;
  const badge = $("#navBadge");
  badge.hidden = n === 0; badge.textContent = n;
  $("#throwCount").textContent = n === 1 ? "1 coisa na gaveta" : `${n} coisas na gaveta`;

  // chips de categoria (só as que têm tarefas)
  const bar = $("#inboxFilters");
  const used = new Set(all.map((t) => t.category));
  bar.innerHTML = `<button class="chip ${inboxCat === "" ? "is-on" : ""}" data-catfilter="" type="button">tudo</button>` +
    CATEGORIES.filter((c) => used.has(c.id)).map((c) =>
      `<button class="chip chip--${c.accent} ${inboxCat === c.id ? "is-on" : ""}" data-catfilter="${c.id}" type="button">${c.label.toLowerCase()}</button>`
    ).join("");

  const listEl = $("#inboxList"), empty = $("#inboxEmpty");
  if (all.length === 0) {
    listEl.innerHTML = ""; empty.hidden = false; return;
  }
  empty.hidden = true;
  listEl.innerHTML = list.map(taskCardHTML).join("");
}

function taskCardHTML(t) {
  const cat = categoryOf(t.category);
  const meta = [];
  const tm = timeOf(t.time);
  if (tm.value !== null) meta.push(tm.label);
  meta.push(energyOf(t.energy).short);
  const age = store.prefs.hideAge ? "" :
    `<span class="task__age">${ageLabel(t.createdAt).replace("guardada ", "")}</span>`;
  const out = t.outside ? `<span class="task__out">sair de casa</span>` : "";
  return `<button class="task" data-open="${t.id}" type="button" style="--task-accent:var(--${cat.accent})">
    <div class="task__top">
      <h3 class="task__title">${escape(t.title)}</h3>
      <span class="task__cat">${escape(cat.label)}</span>
    </div>
    <div class="task__meta">${meta.map((m) => `<span>${escape(m)}</span>`).join("")}${out}${age}</div>
  </button>`;
}

$("#inboxFilters").addEventListener("click", (e) => {
  const c = e.target.closest("[data-catfilter]");
  if (!c) return;
  inboxCat = c.dataset.catfilter;
  renderInbox();
});
$("#inboxList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-open]");
  if (b) openTaskForm(store.byId(b.dataset.open));
});
$$("[data-add]").forEach((b) => b.addEventListener("click", () => openTaskForm(null)));

/* ============================================================ FEITAS ====== */
function renderDone() {
  const done = store.done;
  $("#statDone").textContent = done.length;
  $("#statStored").textContent = store.activeCount;
  const list = $("#doneList"), empty = $("#doneEmpty");
  if (!done.length) { list.innerHTML = ""; empty.hidden = false; return; }
  empty.hidden = true;
  list.innerHTML = done.map((t) => `
    <div class="done-item">
      <div class="done-item__text">
        <div class="done-item__title">${escape(t.title)}</div>
        <div class="done-item__when">${doneLabel(t.completedAt)}</div>
      </div>
      <button class="icon-btn" data-restore="${t.id}" type="button" aria-label="Restaurar para a gaveta" title="Devolver para a gaveta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5v5h5M4.5 10a8 8 0 1 1-1 5"/></svg>
      </button>
    </div>`).join("");
}
$("#doneList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-restore]");
  if (!b) return;
  store.restore(b.dataset.restore);
  toast("Voltou para a gaveta.");
});

/* ==================================================== FORM de tarefa ====== */
let draft = null;      // seleção atual do formulário
let editingId = null;

function chipRow(items, current, key) {
  return items.map((it) => {
    const accent = key === "cat" ? (it.accent || "blue") : "blue";
    const val = it.id;
    const label = (it.label || it.short || "").toLowerCase();
    const on = current === val ? "is-on" : "";
    const cls = key === "cat" ? `chip chip--${accent} ${on}` : `chip chip--blue ${on}`;
    return `<button class="${cls}" data-pick="${key}" data-val="${val}" type="button">${escape(label)}</button>`;
  }).join("");
}

function openTaskForm(task) {
  editingId = task ? task.id : null;
  // bloqueio do limite gratuito só ao criar
  if (!task && store.atLimit()) { openLimit(); return; }

  draft = task
    ? { category: task.category, time: task.time, energy: task.energy, outside: task.outside }
    : { category: "outros", time: "tnone", energy: "med", outside: false };

  $("#taskFormTitle").textContent = task ? "Editar pendência" : "Guardar uma pendência";
  $("#taskSubmit").textContent = task ? "Salvar" : "Guardar na gaveta";
  $("#fTitle").value = task ? task.title : "";
  $("#fNote").value = task ? task.note : "";
  $("#fOutside").checked = draft.outside;
  $("#taskDelete").hidden = !task;

  $("#fFormCat").innerHTML = chipRow(CATEGORIES, draft.category, "cat");
  $("#fFormTime").innerHTML = chipRow(TIMES, draft.time, "time");
  $("#fFormEnergy").innerHTML = chipRow(ENERGIES, draft.energy, "energy");

  openOverlay("#taskSheet");
  setTimeout(() => $("#fTitle").focus(), 120);
}

$("#taskForm").addEventListener("click", (e) => {
  const p = e.target.closest("[data-pick]");
  if (!p) return;
  const key = p.dataset.pick, val = p.dataset.val;
  const map = { cat: "category", time: "time", energy: "energy" };
  draft[map[key]] = val;
  const container = p.parentElement;
  $$(".chip", container).forEach((c) => c.classList.toggle("is-on", c === p));
});

$("#fOutside").addEventListener("change", (e) => { draft.outside = e.target.checked; });

$("#taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#fTitle").value.trim();
  if (!title) { $("#fTitle").focus(); return; }
  const note = $("#fNote").value.trim();
  const data = { title, note, ...draft };
  if (editingId) {
    store.update(editingId, data);
    toast("Pendência atualizada.");
  } else {
    store.add(data);
    toast("Guardado na gaveta.");
  }
  closeOverlay("#taskSheet");
});

$("#taskDelete").addEventListener("click", () => {
  if (!editingId) return;
  const t = store.byId(editingId);
  const snapshot = { ...t };
  store.remove(editingId);
  closeOverlay("#taskSheet");
  toast("Excluída.", "desfazer", () => store.add(snapshot));
});

/* ======================================================= ROLETA / filtros = */
const filters = { time: "", energy: "", place: "", category: "" };

function buildCategoryFilterChips() {
  $("#fCategory").innerHTML =
    `<button class="chip ${filters.category === "" ? "is-on" : ""}" data-fcat="" type="button">todas</button>` +
    CATEGORIES.map((c) =>
      `<button class="chip chip--${c.accent} ${filters.category === c.id ? "is-on" : ""}" data-fcat="${c.id}" type="button">${c.label.toLowerCase()}</button>`
    ).join("");
}

function syncFilterUI() {
  const setSeg = (id, key, attr) => $$(`#${id} .seg__opt`).forEach((o) =>
    o.classList.toggle("is-on", (o.dataset[attr] || "") === filters[key]));
  setSeg("fTime", "time", "time");
  setSeg("fEnergy", "energy", "energy");
  setSeg("fPlace", "place", "place");
  buildCategoryFilterChips();
  updateFilterSummary();
}

function updateFilterSummary() {
  const parts = [];
  if (filters.time) parts.push("até " + timeOf(filters.time).label.replace("+1 h", "mais de 1 h"));
  if (filters.energy) parts.push(energyOf(filters.energy).short);
  if (filters.place === "home") parts.push("sem sair de casa");
  if (filters.place === "out") parts.push("na rua");
  if (filters.category) parts.push(categoryOf(filters.category).label.toLowerCase());
  const el = $("#filterSummary");
  el.textContent = parts.length
    ? "Só o que dá pra fazer com " + parts.join(", ") + "."
    : "Qualquer coisa serve.";
}

function renderRouletteState() {
  const list = candidates(store.tasks, filters);
  const btn = $("#throwBtn"), empty = $("#rouletteEmpty");
  btn.disabled = list.length === 0;
  empty.hidden = list.length !== 0;
  $("#throwCount").textContent = list.length === 1
    ? "1 combina com os filtros" : `${list.length} combinam com os filtros`;
}

$("#fTime").addEventListener("click", (e) => segPick(e, "time", "time"));
$("#fEnergy").addEventListener("click", (e) => segPick(e, "energy", "energy"));
$("#fPlace").addEventListener("click", (e) => segPick(e, "place", "place"));
function segPick(e, key, attr) {
  const o = e.target.closest(".seg__opt");
  if (!o) return;
  filters[key] = o.dataset[attr] || "";
  syncFilterUI(); renderRouletteState();
}
$("#fCategory").addEventListener("click", (e) => {
  const c = e.target.closest("[data-fcat]");
  if (!c) return;
  filters.category = c.dataset.fcat;
  syncFilterUI(); renderRouletteState();
});

/* -------------------------------------------------------- o sorteio ------- */
let lastWinnerId = null;

async function throwMission() {
  const list = candidates(store.tasks, filters);
  if (!list.length) return;
  const winner = pick(list, list.length > 1 ? lastWinnerId : null);
  lastWinnerId = winner.id;
  openMission(winner, list);
}

$("#throwBtn").addEventListener("click", throwMission);

/* ===================================================== MISSÃO (modal) ===== */
let missionTask = null;

function openMission(winner, pool) {
  missionTask = winner;
  renderMissionDraw(winner);
  openOverlay("#missionModal");
  const titleEl = $("#missionTitle");
  const stage = $("#missionStage");
  stage.classList.add("is-active");
  spin(titleEl, pool, winner, { suspense: store.prefs.rouletteSuspense })
    .then(() => {
      stage.classList.remove("is-active");
      const reveal = $("#missionReveal");
      if (reveal) reveal.classList.add("is-revealed");
    });
}

function missionMetaHTML(t) {
  const cat = categoryOf(t.category);
  const tm = timeOf(t.time);
  const pills = [`<span class="pill pill--cat">${escape(cat.label)}</span>`];
  if (tm.value !== null) pills.push(`<span class="pill">${tm.label}</span>`);
  pills.push(`<span class="pill">${energyOf(t.energy).short}</span>`);
  if (t.outside) pills.push(`<span class="pill pill--out">sair de casa</span>`);
  return pills.join("");
}

/* estado 1: acabou de sortear */
function renderMissionDraw(t) {
  const cat = categoryOf(t.category);
  const age = store.prefs.hideAge ? "" : `<p class="said" style="margin-top:0.8rem">${ageLabel(t.createdAt)}.</p>`;
  const note = t.note ? `<p class="mission__note">"${escape(t.note)}"</p>` : "";
  $("#missionBody").style.setProperty("--task-accent", `var(--${cat.accent})`);
  $("#missionBody").innerHTML = `
    <p class="mission__kicker">Uma coisa para fazer</p>
    <div class="mission__stage" id="missionStage">
      <h2 class="mission__title is-spinning" id="missionTitle">${escape(t.title)}</h2>
    </div>
    <div class="mission__reveal" id="missionReveal">
      ${age}
      ${note}
      <div class="mission__meta">${missionMetaHTML(t)}</div>
      <div class="mission__actions">
        <button class="btn btn--primary btn--lg btn--block" data-m="accept" type="button">Aceitar missão</button>
        <div class="mission__secondary">
          <button class="btn" data-m="again" type="button">Sortear de novo</button>
          <button class="btn" data-m="release" type="button">Devolver</button>
        </div>
        <button class="btn btn--ghost btn--block" data-m="done" type="button">Já fiz isso</button>
      </div>
    </div>`;
}

/* estado 2: missão aceita, em andamento */
function renderMissionDoing(t) {
  const cat = categoryOf(t.category);
  const note = t.note ? `<p class="mission__note">"${escape(t.note)}"</p>` : "";
  $("#missionBody").style.setProperty("--task-accent", `var(--${cat.accent})`);
  $("#missionBody").innerHTML = `
    <p class="mission__kicker" style="color:var(--yellow)">Missão em andamento</p>
    <div class="mission__stage">
      <h2 class="mission__title">${escape(t.title)}</h2>
    </div>
    ${note}
    <div class="mission__meta">${missionMetaHTML(t)}</div>
    <div class="mission__actions">
      <button class="btn btn--yellow btn--lg btn--block" data-m="done" type="button">Concluir missão</button>
      <button class="btn btn--ghost btn--block" data-m="release" type="button">Devolver para a gaveta</button>
    </div>`;
}

/* estado 3: concluída — confirmação leve, sem festa exagerada */
function renderMissionDone(t) {
  $("#missionBody").innerHTML = `
    <div class="done-flash">
      <div class="done-flash__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12.5l5 5 11-11"/></svg></div>
      <p class="done-flash__line">Saiu da sua cabeça.</p>
      <p class="said">"${escape(t.title)}" foi pra pilha das concluídas.</p>
      <button class="btn btn--block" data-m="close" type="button">Fechar</button>
    </div>`;
}

$("#missionModal").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]");
  if (!b || !missionTask) return;
  const act = b.dataset.m;
  if (act === "accept") {
    store.accept(missionTask.id);
    renderMissionDoing(store.byId(missionTask.id));
  } else if (act === "again") {
    const list = candidates(store.tasks, filters);
    if (!list.length) { closeOverlay("#missionModal"); renderRouletteState(); return; }
    const next = pick(list, list.length > 1 ? missionTask.id : null);
    lastWinnerId = next.id;
    openMission(next, list);
  } else if (act === "release") {
    store.release(missionTask.id);
    closeOverlay("#missionModal");
    toast("De volta para a gaveta. Sem culpa.");
  } else if (act === "done") {
    store.complete(missionTask.id);
    renderMissionDone(missionTask);
  } else if (act === "close") {
    closeOverlay("#missionModal");
  }
});

/* ===================================================== limite / pro ======= */
function openLimit() { openOverlay("#limitModal"); }
$("#limitPro").addEventListener("click", () => { closeOverlay("#limitModal"); openPro(); });
$("#openPro").addEventListener("click", () => openPro());

const PERKS = [
  ["Tarefas ilimitadas", "Sem o teto de 30 pendências na gaveta."],
  ["Filtros completos", "Tempo, energia, categoria, tags e localização."],
  ["Tags personalizadas", "Organize do seu jeito, além das categorias."],
  ["Temas e skins", "Novas peles visuais além do claro e do escuro."],
  ["Modo Sem Culpa", "Some com prazos, sequências e qualquer cobrança."],
  ["Widgets e backup", "Sua gaveta na tela inicial e sincronizada."],
];
function openPro() {
  $("#proPerks").innerHTML = PERKS.map(([t, d]) => `
    <div class="perk">
      <span class="perk__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12.5l5 5 11-11"/></svg></span>
      <div><div class="perk__t">${t}</div><div class="perk__d">${d}</div></div>
    </div>`).join("");
  openOverlay("#proSheet");
}
$("#proBuy").addEventListener("click", () => {
  closeOverlay("#proSheet");
  toast("É só um protótipo — nada foi cobrado. 😌");
});

/* ===================================================== overlays genéricos = */
function openOverlay(sel) { const el = $(sel); el.hidden = false; document.body.style.overflow = "hidden"; }
function closeOverlay(sel) { const el = $(sel); el.hidden = true; if (!anyOverlayOpen()) document.body.style.overflow = ""; }
function anyOverlayOpen() { return $$(".overlay").some((o) => !o.hidden); }
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-close]");
  if (c) { const ov = c.closest(".overlay"); if (ov) closeOverlay("#" + ov.id); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { const open = $$(".overlay").find((o) => !o.hidden); if (open) closeOverlay("#" + open.id); }
});

/* ===================================================== PERFIL / prefs ===== */
function syncPrefsUI() {
  $$("#themeSeg .seg__opt").forEach((o) =>
    o.classList.toggle("is-on", o.dataset.themeOpt === store.prefs.theme));
  $("#prefSuspense").checked = store.prefs.rouletteSuspense;
  $("#prefHideAge").checked = store.prefs.hideAge;
  $("#prefPro").checked = store.prefs.pro;
}
$("#themeSeg").addEventListener("click", (e) => {
  const o = e.target.closest("[data-theme-opt]");
  if (!o) return;
  store.setPref("theme", o.dataset.themeOpt);
  applyTheme();
});
$("#prefSuspense").addEventListener("change", (e) => store.setPref("rouletteSuspense", e.target.checked));
$("#prefHideAge").addEventListener("change", (e) => store.setPref("hideAge", e.target.checked));
$("#prefPro").addEventListener("change", (e) => {
  store.setPref("pro", e.target.checked);
  toast(e.target.checked ? "Pro simulado ativado." : "De volta ao gratuito.");
});
$("#resetDemo").addEventListener("click", () => {
  store.reset();
  toast("Demonstração recomeçada.");
  applyTheme(); syncPrefsUI();
  startOnboarding();
});

/* ===================================================== onboarding ========= */
let slide = 0;
const SLIDES = 3;
function startOnboarding() {
  slide = 0;
  const dots = $("#onbDots");
  dots.innerHTML = Array.from({ length: SLIDES }, (_, i) =>
    `<span class="onb__dot ${i === 0 ? "is-on" : ""}"></span>`).join("");
  showSlide(0);
  $("#onb").hidden = false;
  $("#app").hidden = true;
}
function showSlide(i) {
  $$(".onb__slide").forEach((s, idx) => {
    s.classList.toggle("is-on", idx === i);
    s.classList.toggle("is-past", idx < i);
  });
  $$("#onbDots .onb__dot").forEach((d, idx) => d.classList.toggle("is-on", idx === i));
  $("#onbNext").textContent = i === SLIDES - 1 ? "Começar" : "Próximo";
  $("#onbSkip").style.visibility = i === SLIDES - 1 ? "hidden" : "visible";
}
$("#onbNext").addEventListener("click", () => {
  if (slide < SLIDES - 1) { slide++; showSlide(slide); }
  else finishOnboarding();
});
$("#onbSkip").addEventListener("click", finishOnboarding);
function finishOnboarding() {
  store.markOnboarded();
  $("#onb").hidden = true;
  $("#app").hidden = false;
  go("inbox");
}

/* ===================================================== render global ====== */
function renderAll() {
  renderInbox();
  renderDone();
  if (currentTab === "roulette") renderRouletteState();
}
store.subscribe(renderAll);

/* ===================================================== boot =============== */
function boot() {
  applyTheme();
  syncPrefsUI();
  syncFilterUI();
  renderAll();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (store.prefs.theme === "auto") applyTheme();
  });

  // splash -> onboarding ou app
  setTimeout(() => {
    $("#splash").hidden = true;
    if (store.onboarded) { $("#app").hidden = false; go("inbox"); }
    else startOnboarding();
  }, 850);
}
boot();
