// components/checklist.js
// Checklist component adapted to the v1.2 architecture (Vanilla JS + Bootstrap)
// NOTE: Code in English; comentarios en español.

import Model from "../core/model.js"; // singleton
import { uid } from "../utils/id.js"; // id generator (timestamp+random)

// -- Constants ---------------------------------------------------------------
const COMPONENT_NAME = "checklist";
const NAMESPACE_PATH = `components.${COMPONENT_NAME}`;

// -- Local helpers (DOM) -----------------------------------------------------
/**
 * Creates a DOM element with attributes and children.
 * @param {string} tag
 * @param {object} [attrs]
 * @param {Array<Node|string>} [children]
 */
function el(tag, attrs = {}, children = []) {
  // crea un elemento DOM con atributos y contenido opcional
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

/**
 * Shallow clone immutable array of items.
 */
function clone(items) {
  // crea una copia inmutable superficial de la lista
  return items.map(i => ({ ...i }));
}

/**
 * Flash a tab/button briefly using inline backgroundColor (Bootstrap handles transition).
 */
function flash(el, color = "#f5d9ab", holdMs = 800, backMs = 250) {
  // resalta un elemento brevemente para guiar al usuario
  if (!el || !(el instanceof HTMLElement)) return;
  if (el.__flashHold) clearTimeout(el.__flashHold);
  if (el.__flashBack) clearTimeout(el.__flashBack);
  const prev = el.style.backgroundColor || "";
  // fuerza reflow
  void el.offsetWidth;
  el.style.backgroundColor = color;
  el.__flashHold = setTimeout(() => {
    void el.offsetWidth;
    el.style.backgroundColor = prev;
    el.__flashBack = setTimeout(() => {
      delete el.__flashHold; delete el.__flashBack;
    }, backMs);
  }, holdMs);
}

// -- Persistence helpers (Model namespace) ----------------------------------
function getItems(state) {
  // obtiene la lista desde el modelo y realiza migraciones ligeras de forma segura
  const list = (((state || {}).components || {})[COMPONENT_NAME]) || [];
  // migración: soporta antiguas claves {title, checked}
  return list.map(it => ({
    id: it.id || uid(),
    text: ("text" in it ? it.text : ("title" in it ? it.title : "")).trim(),
    completed: Boolean("completed" in it ? it.completed : ("checked" in it ? it.checked : false))
  }));
}

function setItems(model, items) {
  // persiste toda la lista en el path del componente
  model.update(NAMESPACE_PATH, clone(items));
}

// -- View renderer -----------------------------------------------------------
function renderLists(root, items) {
  // separa por estado y puebla ambas listas
  const pending = items.filter(i => !i.completed);
  const completed = items.filter(i => i.completed);

  const pendingList = root.querySelector("#checklist-pending-tab-pane .app-checklist");
  const completedList = root.querySelector("#checklist-completed-tab-pane .app-checklist");

  pendingList.innerHTML = "";
  completedList.innerHTML = "";

  // render pending items + new-entry row
  const fragP = document.createDocumentFragment();
  pending.forEach((item, idx) => fragP.appendChild(renderItem(item, idx)));
  fragP.appendChild(renderNewEntry());
  pendingList.appendChild(fragP);

  // render completed items
  const fragC = document.createDocumentFragment();
  completed.forEach((item, idx) => fragC.appendChild(renderItem(item, idx)));
  completedList.appendChild(fragC);
}

function renderItem(item, index) {
  // crea un <li> de tarea con DnD habilitado
  const li = el("li", { class: "list-group-item p-1 ps-2 d-flex align-items-center", draggable: "true" , dataset: { id: item.id } });
  const btnMove = el("button", { type:"button", class:"btn app-btn-move", "aria-label":"Move", title:"Move" }, [ el("i", { class:"bi bi-arrow-down-up" }) ]);
  const form = el("div", { class:"form-check position-relative flex-grow-1" });
  const input = el("input", { class:"form-check-input", type:"checkbox", id:`check-${item.id}` });
  input.checked = !!item.completed; // refleja estado
  const label = el("label", { class:"form-check-label stretched-link", for: input.id }, [ item.text ]);
  form.append(input, label);
  const btnEdit = el("button", { type:"button", class:"btn app-btn-edit position-relative z-3 pe-auto", title:"Edit", "aria-label":"Edit" }, [ el("i", { class:"bi bi-pencil-fill", "aria-hidden":"true" }) ]);
  li.append(btnMove, form, btnEdit);
  return li;
}

function renderNewEntry() {
  // crea la fila de nueva entrada (no draggable)
  const li = el("li", { class:"list-group-item p-2 d-flex gap-2 align-items-center bg-body-tertiary", dataset:{ role:"new-entry" } });
  const input = el("input", { type:"text", class:"form-control", placeholder:"Add new task and press Enter", "aria-label":"Add new task" });
  const btn = el("button", { type:"button", class:"btn app-btn-add", title:"Add new task", "aria-label":"Add new task" }, [ el("i", { class:"bi bi-plus-square-fill fs-3", "aria-hidden":"true" }) ]);
  li.append(input, btn);
  return li;
}

// -- Event wiring ------------------------------------------------------------
function bindEvents(container, model) {
  // registra listeners de UI y delega en funciones puras que mutan vía Model.update
  const pendingList = container.querySelector("#checklist-pending-tab-pane .app-checklist");
  const completedList = container.querySelector("#checklist-completed-tab-pane .app-checklist");

  // Create (Enter or button) — only on pending list new-entry
  const commitCreate = (text) => {
    // agrega una tarea nueva y re-enfoca input tras render (controlado vía data-flag)
    const state = model.getState();
    const items = getItems(state);
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    items.push({ id: uid(), text: trimmed, completed: false });
    container.dataset.refocusNew = "1"; // marca para devolver el foco tras render
    setItems(model, items);
  };

  pendingList.addEventListener("keydown", (e) => {
    const entry = e.target.closest("li[data-role='new-entry']");
    if (!entry || e.key !== "Enter") return;
    const input = entry.querySelector("input[type='text']");
    commitCreate(input.value);
  });

  pendingList.addEventListener("click", (e) => {
    const entry = e.target.closest("li[data-role='new-entry']");
    if (!entry) return;
    const btn = e.target.closest("button.app-btn-add");
    if (!btn) return;
    const input = entry.querySelector("input[type='text']");
    commitCreate(input.value);
  });

  // Toggle complete (both lists)
  const onToggle = (e) => {
    const input = e.target.closest(".form-check-input");
    if (!input) return;
    const li = input.closest("li.list-group-item");
    if (!li || !li.dataset.id) return;
    const state = model.getState();
    const items = getItems(state);
    const idx = items.findIndex(i => i.id === li.dataset.id);
    if (idx === -1) return;
    const next = clone(items);
    next[idx] = { ...next[idx], completed: !next[idx].completed };
    setItems(model, next);

    // flash the destination tab to guide the user
    const targetTabId = input.checked ? "checklist-completed-tab" : "checklist-pending-tab";
    const targetEl = document.getElementById(targetTabId);
    if (targetEl) flash(targetEl);
  };
  pendingList.addEventListener("change", onToggle);
  completedList.addEventListener("change", onToggle);

  // Edit text (inline)
  const startInlineEdit = (e) => {
    const btn = e.target.closest(".app-btn-edit");
    if (!btn) return;
    const li = btn.closest("li.list-group-item");
    if (!li || !li.dataset.id) return;
    const form = li.querySelector(".form-check");
    const label = form.querySelector("label");
    if (form.querySelector("input[type='text']")) return; // evita editores duplicados
    const editor = el("input", { type:"text", class:"form-control", "aria-label":"Edit task text" });
    editor.value = (label.textContent || "").trim();
    label.style.display = "none";
    form.appendChild(editor);
    editor.focus();

    let finished = false;
    const finalize = (mode) => {
      // asegura idempotencia entre blur y Enter
      if (finished) return; finished = true;
      editor.removeEventListener("keydown", onKeyDown);
      editor.removeEventListener("blur", onBlur);
      if (editor.parentNode === form) editor.remove();
      label.style.display = "";
      if (mode === "commit") {
        const nextText = editor.value.trim();
        const state = Model.getInstance().getState();
        const items = getItems(state);
        const idx = items.findIndex(i => i.id === li.dataset.id);
        if (idx === -1) return;
        if (!nextText) {
          // elimina si queda vacío
          const next = items.filter(i => i.id !== li.dataset.id);
          setItems(Model.getInstance(), next);
        } else if (nextText !== items[idx].text) {
          const next = clone(items);
          next[idx] = { ...next[idx], text: nextText };
          setItems(Model.getInstance(), next);
        }
      }
    };
    const onKeyDown = (ke) => { if (ke.key === "Enter") finalize("commit"); else if (ke.key === "Escape") finalize("cancel"); };
    const onBlur = () => finalize("commit");
    editor.addEventListener("keydown", onKeyDown);
    editor.addEventListener("blur", onBlur, { once: true });
  };
  pendingList.addEventListener("click", startInlineEdit);
  completedList.addEventListener("click", startInlineEdit);

  // Drag & Drop within each list
  const attachDnD = (ul) => {
    const state = { draggingId: null, overId: null, overPos: null };
    const clearMarkers = () => ul.querySelectorAll("li.list-group-item").forEach(li => li.classList.remove("border-top", "border-bottom", "opacity-50"));

    ul.addEventListener("dragstart", (e) => {
      const li = e.target.closest("li.list-group-item");
      if (!li || !li.dataset.id || li.dataset.role === "new-entry") return;
      state.draggingId = li.dataset.id; li.classList.add("opacity-50");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", state.draggingId);
    });

    ul.addEventListener("dragover", (e) => {
      if (!state.draggingId) return; e.preventDefault();
      const li = e.target.closest("li.list-group-item");
      if (!li || !li.dataset.id || li.dataset.role === "new-entry") {
        clearMarkers(); state.overId = null; state.overPos = "after-end"; return;
      }
      const rect = li.getBoundingClientRect();
      const before = (e.clientY - rect.top) < (rect.height / 2);
      clearMarkers(); state.overId = li.dataset.id; state.overPos = before ? "before" : "after";
      li.classList.add(before ? "border-top" : "border-bottom");
    });

    ul.addEventListener("dragleave", (e) => {
      const li = e.target.closest("li.list-group-item"); if (!li) return; li.classList.remove("border-top", "border-bottom", "opacity-50");
    });

    ul.addEventListener("drop", (e) => {
      if (!state.draggingId) return; e.preventDefault();
      const stateAll = Model.getInstance().getState();
      const items = getItems(stateAll);
      // limitar reordenamiento al subconjunto de esta lista (pendientes o completadas)
      const isCompletedList = ul.closest("#checklist-completed-tab-pane") !== null;
      const group = items.filter(i => i.completed === isCompletedList);
      const others = items.filter(i => i.completed !== isCompletedList);
      const domItems = [...ul.querySelectorAll("li.list-group-item[data-id]")];
      let toIndex;
      if (state.overPos === "after-end" || state.overId === null) toIndex = group.length; else {
        const targetLi = domItems.find(li => li.dataset.id === state.overId);
        const targetIndex = domItems.indexOf(targetLi);
        toIndex = state.overPos === "before" ? targetIndex : targetIndex + 1;
      }
      const from = group.findIndex(i => i.id === state.draggingId);
      if (from !== -1) {
        const reordered = [...group];
        const [moved] = reordered.splice(from, 1);
        if (toIndex > from) toIndex -= 1; // ajusta desplazamiento
        reordered.splice(Math.max(0, Math.min(reordered.length, toIndex)), 0, moved);
        // fusiona de vuelta manteniendo el orden relativo del otro grupo
        const next = isCompletedList ? [...others, ...reordered] : [...reordered, ...others];
        setItems(Model.getInstance(), next);
      }
      clearMarkers(); state.draggingId = state.overId = state.overPos = null;
    });

    ul.addEventListener("dragend", () => { clearMarkers(); state.draggingId = state.overId = state.overPos = null; });
  };

  attachDnD(pendingList);
  attachDnD(completedList);
}

function focusNewInput(container) {
  // busca el input de nueva tarea en la lista de pendientes y aplica foco sin scroll
  const input = container.querySelector("#checklist-pending-tab-pane li[data-role='new-entry'] input[type='text']");
  if (input) input.focus({ preventScroll: true });
}

// -- Component API -----------------------------------------------------------
const ChecklistComponent = {
  name: COMPONENT_NAME,

  /**
   * Mounts the component under `root` and wires event listeners.
   * @param {HTMLElement} root
   * @param {ReturnType<Model.getInstance>} model
   */
  mount(root, model) {
    // crea el contenedor estructural del componente una sola vez por sesión
    this.model = model || Model.getInstance();
    this.root = root;

    // crea markup base (tabs + lists). El layout general ya existe por el app-coordinator
    // (usa clases con prefijo app- y el contenedor .checklist-container)
    this.container = el("section", { class: "checklist-container" });

    // Tabs header
    const tabs = el("ul", { class: "nav nav-tabs mb-2" });
    const tabPending = el("li", { class: "nav-item" }, [
      el("button", { id:"checklist-pending-tab", class:"nav-link active", "data-bs-toggle":"tab", "data-bs-target":"#checklist-pending-tab-pane", type:"button", role:"tab", "aria-controls":"checklist-pending-tab-pane", "aria-selected":"true" }, ["Pending"]) ]);
    const tabCompleted = el("li", { class: "nav-item" }, [
      el("button", { id:"checklist-completed-tab", class:"nav-link", "data-bs-toggle":"tab", "data-bs-target":"#checklist-completed-tab-pane", type:"button", role:"tab", "aria-controls":"checklist-completed-tab-pane", "aria-selected":"false" }, ["Completed"]) ]);
    tabs.append(tabPending, tabCompleted);

    // Tab panes
    const panes = el("div", { class: "tab-content" });
    const panePending = el("div", { id:"checklist-pending-tab-pane", class:"tab-pane fade show active", role:"tabpanel", "aria-labelledby":"checklist-pending-tab" }, [
      el("ul", { class:"list-group app-checklist" })
    ]);
    const paneCompleted = el("div", { id:"checklist-completed-tab-pane", class:"tab-pane fade", role:"tabpanel", "aria-labelledby":"checklist-completed-tab" }, [
      el("ul", { class:"list-group app-checklist" })
    ]);
    panes.append(panePending, paneCompleted);

    this.container.append(tabs, panes);
    root.appendChild(this.container);

    // initial render
    renderLists(this.container, getItems(this.model.getState()));

    // event wiring
    bindEvents(this.container, this.model);

    // subscribe to model changes
    this._onModelChange = (e) => this.onModelChange(e);
    window.addEventListener("model:change", this._onModelChange);
  },

  /**
   * Called when Model emits a change. Re-renders if path affects this component.
   * @param {CustomEvent} e
   */
  onModelChange(e) {
    // ignora cambios de otro plan si el modelo lo indica (guardia defensiva)
    // nota: se asume que Model emite planId en detail; si no existe, se continúa sin filtrar
    const { path } = e.detail || {};
    if (typeof path === "string" && !path.startsWith(NAMESPACE_PATH) && path !== "*") return;

    // re-render the lists
    renderLists(this.container, getItems(this.model.getState()));

    // restore focus to new-entry input if flagged by a create action
    if (this.container.dataset.refocusNew === "1") {
      focusNewInput(this.container);
      delete this.container.dataset.refocusNew;
    }
  },

  /**
   * Unmounts the component and cleans up listeners and DOM.
   */
  unmount() {
    // limpia listeners y DOM local
    if (this._onModelChange) window.removeEventListener("model:change", this._onModelChange);
    this._onModelChange = null;
    if (this.container && this.container.parentNode === this.root) this.root.removeChild(this.container);
    this.container = null; this.root = null; this.model = null;
  }
};

export default ChecklistComponent;
