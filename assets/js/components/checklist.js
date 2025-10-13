/**
 * @fileoverview Checklist UI module.
 * @module components/checklist
 *
 * @description
 * Construye e inicializa una checklist completa **dentro del contenedor recibido**.
 * Crea el layout (tabs + listas), renderiza items desde `localStorage` y conecta
 * edición inline, creación, marcado de completado y reordenamiento por drag & drop.
 * Persistencia: guarda los items en `localStorage` como parte de un **modelo raíz**
 * con el esquema importado desde `../core/json/model.json`, dentro de
 * `components.<COMPONENT_NAME>.content`.
 *
 * @requires ../utils/helpers.js
 *   - `el(tag, opts)`        // Crea nodos HTML
 *   - `qs(root, sel)`        // Busca un único elemento
 *   - `qsa(root, sel)`       // Busca múltiples elementos
 *   - `visibility.{show,hide}` // Cambia visibilidad con clases
 *   - `flashBackground(el)`  // Destaca visualmente un elemento
 *
 * @requires ../utils/drag-and-drop.js
 *   - `attachListReorder(ul, options)` // Habilita reordenamiento con DnD
 *
 * @version 1.3.0
 *
 * @exports renderChecklist
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
 * Usa la clave `"app.model"` en `localStorage` para persistir el **modelo raíz**.
 *
 * @function renderChecklist
 * @param {HTMLElement} containerEl - Contenedor **dentro del cual** se construye todo el UI.
 * @returns {void}
 *
 * @example <caption>Uso típico desde main.js</caption>
 * // Code in English; comentarios en español
 * import { renderChecklist } from "./components/checklist.js";
 * const container = document.getElementById("app-container-1"); // Obtiene contenedor
 * renderChecklist(container); // Crea el layout y arranca la checklist dentro del contenedor
 *
 * @remarks
 * - Accesibilidad: asigna atributos ARIA a tabs y controles; evita saltos de línea en edición inline.
 * - DnD: `attachListReorder` ignora la fila de “nueva entrada” y reenvía cambios al modelo.
 * - Persistencia: guarda automáticamente tras crear/editar/toggle/reordenar/eliminar.
 * - Esquema: los items se escriben en `components.<COMPONENT_NAME>.content` del modelo raíz.
 *
 * @since 1.0.0
 * @updated 1.2.0 - El Controller almacena y pasa COMPONENT_NAME; el Model no asume valor por defecto.
 *
 * @browser Compatibilidad moderna (ES2020+). Requiere soporte de `class`, `modules` y `localStorage`.
 */

import { el, qs, qsa, visibility, flashBackground } from "../utils/helpers.js";
import { attachListReorder } from "../utils/drag-and-drop.js";
// importa modelo:
import { Model } from "../core/model.js";

/* ================================
 * View (builds full layout inside container)
 * ================================ */
class View {
  // selectores reutilizables
  static SEL = {
<<<<<<< HEAD
    pendingPane: "#checklist-pending-tab-pane .app-checklist .type-checkbox",
    completedPane: "#checklist-completed-tab-pane .app-checklist .type-checkbox",
=======
    pendingPane: "#checklist-pending-tab-pane .app-checklist",
    completedPane: "#checklist-completed-tab-pane .app-checklist",
>>>>>>> parent of 5e98f75 (resourceslist component)
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    checkbox: "input.form-check-input",
    label: "label.form-check-label",
    btnAdd: "button.app-btn-add",
  };

  // crea todo el layout y devuelve referencias clave
  static buildLayout(containerEl) {
    // limpia contenedor destino
    containerEl.innerHTML = "";

    // crea columna y tarjeta
    const col = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const h2 = el("h2", { html: "tasks" });

    // raíz lógica del checklist
    const checklistRoot = el("div", { attrs: { id: "checklist-container" } });

    // tabs
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

    // contenido de pestañas
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
<<<<<<< HEAD
    const ulPend = el("ul", { className: "app-checklist type-checkbox list-group" });
=======
    const ulPend = el("ul", { className: "app-checklist list-group" });
>>>>>>> parent of 5e98f75 (resourceslist component)
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
<<<<<<< HEAD
    const ulComp = el("ul", { className: "app-checklist type-checkbox list-group" });
=======
    const ulComp = el("ul", { className: "app-checklist list-group" });
>>>>>>> parent of 5e98f75 (resourceslist component)
    paneComp.append(ulComp);

    tabContent.append(panePend, paneComp);

    // ensambla tarjeta
    card.append(h2, checklistRoot, tabs, tabContent);
    col.append(card);
    containerEl.append(col);

    return { root: checklistRoot, ulPending: ulPend, ulCompleted: ulComp };
  }

  constructor(containerEl) {
    // construye layout y guarda refs de listas
    const { root, ulPending, ulCompleted } = View.buildLayout(containerEl);
    this.root = root;
    this.pendingList = ulPending;
    this.completedList = ulCompleted;

    // pool de manejadores DnD para limpieza
    this._dndHandles = [];
  }

  // renderiza ambas listas
  render(items) {
    const pending = items.filter((i) => !i.completed);
    const completed = items.filter((i) => i.completed);

    this.pendingList.innerHTML = "";
    this.completedList.innerHTML = "";

    this.#renderList(this.pendingList, pending, { withNewEntry: true });
    this.#renderList(this.completedList, completed, { withNewEntry: false });

    this.#ensureCompletedEmptyState();
    this.#initDnD(); // Activa DnD tras render
  }

  // inicializa drag & drop en ambas listas
  #initDnD() {
    // destruye instancias previas
    this._dndHandles.forEach((h) => {
      try { h.destroy?.(); } catch {}
    });
    this._dndHandles = [];

    const common = {
      // ignora fila de nueva entrada
      ignoreSelector: "[data-role='new-entry']",
      // habilita drops en bordes globales
      allowGlobalEdges: true,
      // reenvía orden al controlador
      onReorder: (draggedId, toIndex) => this.onReorder?.(draggedId, toIndex),
    };

    this._dndHandles.push(
      attachListReorder(this.pendingList, common),
      attachListReorder(this.completedList, common)
    );
  }

  // renderiza una UL completa
  #renderList(ul, data, { withNewEntry }) {
    const frag = document.createDocumentFragment();
    data.forEach((item) => frag.appendChild(this.#renderItem(item)));
    if (withNewEntry) frag.appendChild(this.#renderNewItemEntry());
    ul.appendChild(frag);
  }

  // crea <li> por item
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
      ["ai-spelling", "Fix spelling »", "[Shift+F8]"],
      ["ai-improve", "Improve writing »", "[Shift+F9]"],
      ["ai-breakdown", "Break down task »", "[Shift+F10]"],
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

    // listeners del item
    input.addEventListener("change", () => {
      this.onToggle?.(item.id);
      const targetTabId = input.checked
        ? "checklist-completed-tab"
        : "checklist-pending-tab";
      const targetEl = document.getElementById(targetTabId);
      if (targetEl) flashBackground(targetEl);
    });

    label.addEventListener("click", () => {
      // prepara edición inline
      const currentText = label.textContent.trim();
      visibility.hide(label);
      visibility.show(panel, "d-flex");
      editor.value = currentText;

      // auto-resize
      const autoresize = () => {
        editor.style.height = "auto";
        editor.style.height = editor.scrollHeight + "px";
      };

      // sanea saltos de línea → espacios
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

      // finaliza edición
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

      // foco inicial
      editor.focus();
      const len = editor.value.length;
      editor.setSelectionRange(len, len);
      autoresize();
    });

    return li;
  }

  // asegura placeholder cuando no hay completadas
  #ensureCompletedEmptyState() {
    const ul = this.completedList;
    if (!ul) return;
    const hasReal = [...ul.querySelectorAll("li.list-group-item[data-id]")].some(
      (li) => (li.dataset.id ?? "") !== ""
    );
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

  // crea fila de nueva entrada
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

  // API para enfocar input nuevo
  focusNewEntryInput() {
    const entry = qs(this.pendingList, View.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }
}

/* ================================
 * Controller
 * ================================ */
class Controller {
  constructor(containerEl) {
    // define y almacena el nombre del componente que controla
    this.COMPONENT_NAME = "checklist";

    // instancia modelo y vista
    this.model = new Model();
    this.view = new View(containerEl);

    // banderas para UX de creación
    this.createInFlight = false;
    this.shouldRefocusNewEntry = false;

    // render inicial usando el nombre de componente almacenado
    this.view.render(this.model.getAll(this.COMPONENT_NAME));

    // sincroniza vista ante cambios de modelo del mismo componente
    this.model.addEventListener("change", (ev) => {
      const changedName = ev?.detail?.name;
      if (!changedName || changedName === this.COMPONENT_NAME) {
        this.view.render(this.model.getAll(this.COMPONENT_NAME));
        if (this.shouldRefocusNewEntry) {
          this.view.focusNewEntryInput();
          this.shouldRefocusNewEntry = false;
        }
        this.createInFlight = false;
      }
    });

    // conecta handlers de la vista, pasando siempre COMPONENT_NAME
    this.view.onCreate = (text) => {
      if (this.createInFlight) return;
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      this.model.add(this.COMPONENT_NAME, text);
    };
    this.view.onToggle = (id) => this.model.toggle(this.COMPONENT_NAME, id);
    this.view.onEdit = (id, text) => {
      if (String(text).trim() === "") this.model.remove(this.COMPONENT_NAME, id);
      else this.model.updateText(this.COMPONENT_NAME, id, text);
    };
    this.view.onReorder = (draggedId, toIndex) => {
      this.model.moveToIndex(this.COMPONENT_NAME, draggedId, toIndex);
    };
  }
}

/* ================================
 * Public API
 * ================================ */

/**
 * renderChecklist(containerEl: HTMLElement)
 * - Called by main.js passing the container where everything must be created.
 */
export function renderChecklist(containerEl) {
  // valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[checklist] invalid container element");
    return;
  }
  // crea layout y monta controlador sobre el contenedor
  new Controller(containerEl);
}
