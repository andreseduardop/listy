/**
 * @fileoverview Checklist UI module.
 * @module components/checklist
 *
 * @description
 * Construye e inicializa una checklist completa **dentro del contenedor recibido**.
 * Crea el layout (tabs + listas), renderiza items desde `localStorage` y conecta
 * edición inline, creación, marcado de completado y reordenamiento por drag & drop.
 *
 * @requires ../utils/helpers.js
 * Importa y usa helpers existentes:
 *   - `el(tag, opts)`        // Crea nodos HTML
 *   - `qs(root, sel)`        // Busca un único elemento
 *   - `qsa(root, sel)`       // Busca múltiples elementos
 *   - `visibility.{show,hide}` // Cambia visibilidad con clases
 *   - `flashBackground(el)`  // Destaca visualmente un elemento
 *
 * @requires ../utils/drag-and-drop.js
 *   - `attachListReorder(ul, options)` // Habilita reordenamiento con DnD
 *
 * @version 1.0.0
 *
 * @exports initChecklist
 * Expone la función pública para inicializar el módulo.
 *
 * @typedef {Object} ChecklistItem
 * @property {string} id        - Identificador único (genera id corto).
 * @property {string} text      - Texto visible de la tarea.
 * @property {boolean} completed - Indica si la tarea está completada.
 *
 * @callback ReorderHandler
 * @param {string} draggedId - Id del item arrastrado.
 * @param {number} toIndex   - Índice destino donde se inserta.
 *
 * @constant
 * @default
 * @name STORAGE_KEY
 * @type {string}
 * @description
 * Usa la clave `"checklist"` en `localStorage` para persistir el estado.
 *
 * @function initChecklist
 * @param {HTMLElement} containerEl - Contenedor **dentro del cual** se construye todo el UI.
 * @returns {void}
 * @description
 * Valida el contenedor, construye el layout (card, tabs y listas), monta la vista/controlador,
 * carga y renderiza el estado desde `localStorage`, y conecta manejadores de eventos.
 *
 * @example <caption>Uso típico desde main.js</caption>
 * // Code in English; comentarios en español
 * import { initChecklist } from "./components/checklist.js";
 * const container = document.getElementById("app-container-1"); // Comentario: obtiene contenedor
 * initChecklist(container); // Comentario: crea el layout y arranca la checklist dentro del contenedor
 *
 * @remarks
 * - Accesibilidad: asigna atributos ARIA a tabs y controles; evita saltos de línea en edición inline.
 * - DnD: `attachListReorder` ignora la fila de “nueva entrada” y reenvía cambios al modelo.
 * - Persistencia: guarda automáticamente tras crear/editar/toggle/reordenar/eliminar.
 * - Vacíos: cuando no hay completadas, muestra placeholder “No tasks completed.” en la pestaña de Completed.
 *
 * @since 1.0.0
 *
 * @browser Compatibilidad moderna (ES2020+). Requiere soporte de `class`, `modules` y `localStorage`.
 */

import { el, qs, qsa, visibility, flashBackground } from "../utils/helpers.js";
import { attachListReorder } from "../utils/drag-and-drop.js";

/* ================================
 * Model (localStorage)
 * ================================ */
class ChecklistModel extends EventTarget {
  // Comentario: define clave de almacenamiento
  static STORAGE_KEY = "checklist";

  constructor() {
    super();
    // Comentario: carga estado inicial
    this.items = this.#read();
  }

  // Comentario: lee JSON desde localStorage de forma segura
  #read() {
    try {
      const raw = localStorage.getItem(ChecklistModel.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Comentario: escribe y notifica cambios
  #write() {
    try {
      localStorage.setItem(
        ChecklistModel.STORAGE_KEY,
        JSON.stringify(this.items)
      );
      this.dispatchEvent(
        new CustomEvent("change", { detail: { items: this.getAll() } })
      );
    } catch (e) {
      console.error("[checklist] persist error", e);
    }
  }

  // Comentario: genera id corto y estable
  #uid() {
    const s =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return s.slice(0, 12);
  }

  getAll() {
    // Comentario: devuelve copia para evitar mutaciones externas
    return this.items.map((i) => ({ ...i }));
  }

  add(text) {
    // Comentario: agrega nueva tarea si hay contenido
    const t = String(text || "").trim();
    if (!t) return;
    this.items = [...this.items, { id: this.#uid(), text: t, completed: false }];
    this.#write();
  }

  toggle(id) {
    // Comentario: invierte estado de completado
    this.items = this.items.map((i) =>
      i.id === id ? { ...i, completed: !i.completed } : i
    );
    this.#write();
  }

  updateText(id, text) {
    // Comentario: actualiza texto; si queda vacío, elimina
    const t = String(text || "").trim();
    if (!t) return this.remove(id);
    this.items = this.items.map((i) => (i.id === id ? { ...i, text: t } : i));
    this.#write();
  }

  remove(id) {
    // Comentario: elimina item por id
    this.items = this.items.filter((i) => i.id !== id);
    this.#write();
  }

  moveToIndex(id, toIndex) {
    // Comentario: mueve item a índice destino
    const len = this.items.length;
    if (len <= 1) return;
    const from = this.items.findIndex((i) => i.id === id);
    if (from === -1) return;

    let dest = Math.max(0, Math.min(len, Number(toIndex)));
    if (dest === from || dest === from + 1) return;

    const arr = [...this.items];
    const [moved] = arr.splice(from, 1);
    if (dest > from) dest -= 1;
    arr.splice(dest, 0, moved);

    this.items = arr;
    this.#write();
  }
}

/* ================================
 * View (builds full layout inside container)
 * ================================ */
class ChecklistView {
  // Comentario: selectores reutilizables
  static SEL = {
    pendingPane: "#checklist-pending-tab-pane .app-checklist",
    completedPane: "#checklist-completed-tab-pane .app-checklist",
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    checkbox: "input.form-check-input",
    label: "label.form-check-label",
    btnAdd: "button.app-btn-add",
  };

  // Comentario: crea todo el layout y devuelve referencias clave
  static buildLayout(containerEl) {
    // Comentario: limpia contenedor destino
    containerEl.innerHTML = "";

    // Comentario: crea columna y tarjeta
    const col = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const h2 = el("h2", { html: "tasks" });

    // Comentario: raíz lógica del checklist
    const checklistRoot = el("div", { attrs: { id: "checklist-container" } });

    // Comentario: tabs
    const tabs = el("ul", {
      className: "nav nav-tabs nav-fill",
      attrs: { id: "checklist-tabs", role: "tablist" },
    });

    const liPend = el("li", { className: "nav-item", attrs: { role: "presentation" } });
    const btnPend = el("button", {
      className: "nav-link active",
      attrs: {
        id: "checklist-pending-tab",
        "data-bs-toggle": "tab",
        "data-bs-target": "#checklist-pending-tab-pane",
        type: "button",
        role: "tab",
        "aria-controls": "checklist-pending-tab-pane",
        "aria-selected": "true",
      },
      html: "Pending",
    });
    liPend.append(btnPend);

    const liComp = el("li", { className: "nav-item", attrs: { role: "presentation" } });
    const btnComp = el("button", {
      className: "nav-link",
      attrs: {
        id: "checklist-completed-tab",
        "data-bs-toggle": "tab",
        "data-bs-target": "#checklist-completed-tab-pane",
        type: "button",
        role: "tab",
        "aria-controls": "checklist-completed-tab-pane",
        "aria-selected": "false",
        tabindex: "-1",
      },
      html: "Completed",
    });
    liComp.append(btnComp);

    tabs.append(liPend, liComp);

    // Comentario: contenido de pestañas
    const tabContent = el("div", {
      className: "tab-content",
      attrs: { id: "checklist-tabs-content" },
    });

    const panePend = el("div", {
      className: "tab-pane fade show active",
      attrs: {
        id: "checklist-pending-tab-pane",
        role: "tabpanel",
        "aria-labelledby": "checklist-pending-tab",
        tabindex: "0",
      },
    });
    const ulPend = el("ul", { className: "app-checklist list-group" });
    panePend.append(ulPend);

    const paneComp = el("div", {
      className: "tab-pane fade",
      attrs: {
        id: "checklist-completed-tab-pane",
        role: "tabpanel",
        "aria-labelledby": "checklist-completed-tab",
        tabindex: "0",
      },
    });
    const ulComp = el("ul", { className: "app-checklist list-group" });
    paneComp.append(ulComp);

    tabContent.append(panePend, paneComp);

    // Comentario: ensambla tarjeta
    card.append(h2, checklistRoot, tabs, tabContent);
    col.append(card);
    containerEl.append(col);

    return { root: checklistRoot, ulPending: ulPend, ulCompleted: ulComp };
  }

  constructor(containerEl) {
    // Comentario: construye layout y guarda refs de listas
    const { root, ulPending, ulCompleted } = ChecklistView.buildLayout(containerEl);
    this.root = root;
    this.pendingList = ulPending;
    this.completedList = ulCompleted;

    // Comentario: pool de manejadores DnD para limpieza
    this._dndHandles = [];
  }

  // Comentario: renderiza ambas listas
  render(items) {
    const pending = items.filter((i) => !i.completed);
    const completed = items.filter((i) => i.completed);

    this.pendingList.innerHTML = "";
    this.completedList.innerHTML = "";

    this.#renderList(this.pendingList, pending, { withNewEntry: true });
    this.#renderList(this.completedList, completed, { withNewEntry: false });

    this.#ensureCompletedEmptyState();
    this.#initDnD(); // Comentario: activa DnD tras render
  }

  // Comentario: inicializa drag & drop en ambas listas
  #initDnD() {
    // Comentario: destruye instancias previas
    this._dndHandles.forEach((h) => {
      try { h.destroy?.(); } catch {}
    });
    this._dndHandles = [];

    const common = {
      // Comentario: ignora fila de nueva entrada
      ignoreSelector: "[data-role='new-entry']",
      // Comentario: habilita drops en bordes globales
      allowGlobalEdges: true,
      // Comentario: reenvía orden al controlador
      onReorder: (draggedId, toIndex) => this.onReorder?.(draggedId, toIndex),
    };

    this._dndHandles.push(
      attachListReorder(this.pendingList, common),
      attachListReorder(this.completedList, common)
    );
  }

  // Comentario: renderiza una UL completa
  #renderList(ul, data, { withNewEntry }) {
    const frag = document.createDocumentFragment();
    data.forEach((item) => frag.appendChild(this.#renderItem(item)));
    if (withNewEntry) frag.appendChild(this.#renderNewItemEntry());
    ul.appendChild(frag);
  }

  // Comentario: crea <li> por item
  #renderItem(item) {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
      attrs: { draggable: "true" },
    });
    li.dataset.id = item.id;

    const form = el("div", {
      className: "form-check position-relative d-flex align-items-top flex-grow-1",
    });

    const input = el("input", {
      className: "form-check-input",
      attrs: { type: "checkbox", id: `checklist-check-${item.id}` },
    });
    input.checked = !!item.completed;

    const label = el("label", {
      className: "form-check-label flex-grow-1",
      attrs: { for: `textarea-for-${item.id}` },
    });
    label.textContent = item.text;

    const panel = el("div", {
      className: "d-flex flex-column ps-1 flex-grow-1 d-none",
      attrs: { "data-role": "inline-panel" },
    });

    const editor = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit task text",
        name: "inline-editor",
        rows: "1",
        id: `textarea-for-${item.id}`,
      },
    });

    const actions = el("div", { className: "d-flex flex-column mt-2 small" });
    const actionDefs = [
      ["save", "Save", "[Enter]"],
      ["discard", "Discard", "[Esc]"],
      ["delete", "Delete", "[Shift+Del]"],
    ];
    actionDefs.forEach(([key, text, hint]) => {
      actions.append(
        el("a", {
          className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
          attrs: { href: "#", "data-action": key },
          html: `<span>${text}</span><span class="text-muted">${hint}</span>`,
        })
      );
    });

    panel.append(editor, actions);
    form.append(input, label, panel);

    const btnMove = el("button", {
      className: "btn app-btn-move",
      attrs: {
        type: "button",
        "aria-label": "Move",
        title: "Move",
        "aria-hidden": "true",
        tabindex: "-1",
        draggable: "false",
      },
      html: `<i class="bi bi-arrow-down-up" aria-hidden="true"></i>`,
    });

    li.append(form, btnMove);

    // Comentario: listeners del item
    input.addEventListener("change", () => {
      this.onToggle?.(item.id);
      const targetTabId = input.checked
        ? "checklist-completed-tab"
        : "checklist-pending-tab";
      const targetEl = document.getElementById(targetTabId);
      if (targetEl) flashBackground(targetEl);
    });

    label.addEventListener("click", () => {
      // Comentario: prepara edición inline
      const currentText = label.textContent.trim();
      visibility.hide(label);
      visibility.show(panel, "d-flex");
      editor.value = currentText;

      // Comentario: auto-resize
      const autoresize = () => {
        editor.style.height = "auto";
        editor.style.height = editor.scrollHeight + "px";
      };

      // Comentario: sanea saltos de línea → espacios
      const sanitizeNoNewlines = () => {
        const sanitized = editor.value.replace(/\r?\n+/g, " ");
        if (sanitized !== editor.value) {
          const pos = editor.selectionStart;
          editor.value = sanitized;
          editor.selectionStart = editor.selectionEnd = Math.min(
            pos,
            editor.value.length
          );
        }
      };

      // Comentario: finaliza edición
      const finalize = (mode /* 'commit' | 'cancel' */) => {
        if (finalize._done) return;
        finalize._done = true;

        panel.removeEventListener("pointerdown", onAction);
        panel.removeEventListener("click", onAction);
        editor.removeEventListener("keydown", onKeyDown);
        editor.removeEventListener("input", onInput);
        editor.removeEventListener("blur", onBlur);

        if (mode === "commit") {
          const next = editor.value.trim();
          if (next && next !== currentText) this.onEdit?.(item.id, next);
          if (!next) this.onEdit?.(item.id, ""); // vacío → eliminar
        }

        visibility.hide(panel);
        visibility.show(label);
      };

      const onKeyDown = (ke) => {
        if (ke.key === "Enter") {
          ke.preventDefault();
          finalize("commit");
        } else if (ke.key === "Escape") {
          ke.preventDefault();
          finalize("cancel");
        } else if (ke.key === "Delete" && ke.shiftKey) {
          ke.preventDefault();
          editor.value = "";
          finalize("commit");
        }
      };

      const onInput = () => {
        sanitizeNoNewlines();
        autoresize();
      };
      const onBlur = () => finalize("commit");

      const onAction = (ev) => {
        const a = ev.target.closest("a[data-action]");
        if (!a) return;
        ev.preventDefault();
        const act = a.dataset.action;
        if (act === "save") finalize("commit");
        else if (act === "discard") finalize("cancel");
        else if (act === "delete") {
          editor.value = "";
          finalize("commit");
        }
      };

      panel.addEventListener("pointerdown", onAction);
      panel.addEventListener("click", onAction);
      editor.addEventListener("keydown", onKeyDown);
      editor.addEventListener("blur", onBlur, { once: true });
      editor.addEventListener("input", onInput);

      // Comentario: foco inicial
      editor.focus();
      const len = editor.value.length;
      editor.setSelectionRange(len, len);
      autoresize();
    });

    return li;
  }

  // Comentario: asegura placeholder cuando no hay completadas
  #ensureCompletedEmptyState() {
    const ul = this.completedList;
    if (!ul) return;
    const hasReal = [...ul.querySelectorAll("li.list-group-item[data-id]")]
      .some((li) => (li.dataset.id ?? "") !== "");
    const currentPh = ul.querySelector('li.list-group-item[data-id=""]');

    if (hasReal && currentPh) currentPh.remove();
    if (!hasReal && !currentPh) {
      const li = el("li", {
        className: "list-group-item p-2 d-flex align-items-start",
        attrs: { draggable: "false" },
        html: "No tasks completed.",
      });
      li.dataset.id = "";
      ul.appendChild(li);
    }
  }

  // Comentario: crea fila de nueva entrada
  #renderNewItemEntry() {
    const li = el("li", {
      className: "list-group-item p-2 d-flex gap-2 align-items-start",
    });
    li.dataset.role = "new-entry";
    li.draggable = false;

    const input = el("input", {
      className: "form-control",
      attrs: {
        type: "text",
        name: "new-task",
        placeholder: "Add new task and press Enter",
        "aria-label": "Add new task",
      },
    });

    const btnAdd = el("button", {
      className: "btn app-btn-add",
      attrs: { type: "button", title: "Add new task", "aria-label": "Add new task" },
      html: `<i class="bi bi-plus-square-fill fs-3" aria-hidden="true"></i>`,
    });

    const create = () => {
      const t = input.value.trim();
      if (!t) return;
      this.onCreate?.(t);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") create();
    });
    btnAdd.addEventListener("click", create);

    li.append(input, btnAdd);
    return li;
  }

  // Comentario: API para enfocar input nuevo
  focusNewEntryInput() {
    const entry = qs(this.pendingList, ChecklistView.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }
}

/* ================================
 * Controller
 * ================================ */
class ChecklistController {
  constructor(containerEl) {
    // Comentario: instancia modelo y vista
    this.model = new ChecklistModel();
    this.view = new ChecklistView(containerEl);

    // Comentario: banderas para UX de creación
    this.createInFlight = false;
    this.shouldRefocusNewEntry = false;

    // Comentario: render inicial
    this.view.render(this.model.getAll());

    // Comentario: sincroniza vista ante cambios de modelo
    this.model.addEventListener("change", () => {
      this.view.render(this.model.getAll());
      if (this.shouldRefocusNewEntry) {
        this.view.focusNewEntryInput();
        this.shouldRefocusNewEntry = false;
      }
      this.createInFlight = false;
    });

    // Comentario: conecta handlers de la vista
    this.view.onCreate = (text) => {
      if (this.createInFlight) return;
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      this.model.add(text);
    };
    this.view.onToggle = (id) => this.model.toggle(id);
    this.view.onEdit = (id, text) => {
      if (String(text).trim() === "") this.model.remove(id);
      else this.model.updateText(id, text);
    };
    this.view.onReorder = (draggedId, toIndex) => {
      this.model.moveToIndex(draggedId, toIndex);
    };
  }
}

/* ================================
 * Public API
 * ================================ */

/**
 * initChecklist(containerEl: HTMLElement)
 * - Called by main.js passing the container where everything must be created.
 */
export function initChecklist(containerEl) {
  // Comentario: valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[checklist] invalid container element");
    return;
  }
  // Comentario: crea layout y monta controlador sobre el contenedor
  new ChecklistController(containerEl);
}
