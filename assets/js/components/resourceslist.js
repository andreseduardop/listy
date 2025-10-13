/**
 * @fileoverview Resourceslist UI module.
 * @module components/resourceslist
 *
 * @description
 * Builds and initializes a resourceslist inside the received container.
 * Creates the layout (tabs + lists), renders items from `localStorage`, and wires
 * inline editing, creation, toggle ready state, and drag & drop reordering.
 * Persistence: stores items in `localStorage` as part of a root model under
 * `components.<COMPONENT_NAME>.content`, using the schema imported from `../core/json/model.json`.
 *
 * Code in English; comentarios en español usando tercera persona singular (carga, lee, escribe, borra).
 * Seguir la guía: https://google.github.io/styleguide/jsguide.html
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
 * @version 1.4.0
 *
 * @exports renderResourceslist
 * Exposes the public function to initialize the module.
 *
 * @typedef {Object} ResourceslistItem
 * @property {string} id        - Unique identifier.
 * @property {string} text      - Visible text of the resource.
 * @property {boolean} completed - Marks if the resource is ready (true) or pending (false).
 *
 * @callback ReorderHandler
 * @param {string} draggedId - Id of the dragged item.
 * @param {number} toIndex   - Destination index where the item is inserted.
 *
 * @constant
 * @default
 * @name STORAGE_KEY
 * @type {string}
 * @description
 * Uses the key `"app.model"` in `localStorage` to persist the root model.
 *
 * @function renderResourceslist
 * @param {HTMLElement} containerEl - Container where the UI is built.
 * @returns {void}
 *
 * @example <caption>Typical usage from main.js</caption>
 * // Code in English; comentarios en español
 * import { renderResourceslist } from "./components/resourceslist.js";
 * const container = document.getElementById("app-container-1"); // Obtiene contenedor
 * renderResourceslist(container); // Crea el layout y arranca la resourceslist dentro del contenedor
 *
 * @remarks
 * - Accesibilidad: asigna atributos ARIA a tabs y controles; evita saltos de línea en edición inline.
 * - DnD: `attachListReorder` ignora la fila de “nueva entrada” y reenvía cambios al modelo.
 * - Persistencia: guarda automáticamente tras crear/editar/toggle/reordenar/eliminar.
 * - Esquema: los items se escriben en `components.<COMPONENT_NAME>.content` del modelo raíz.
 *
 * @since 1.0.0
 * @updated 1.4.0 - Renombra checklist → resourceslist, task → resource; Completed → Ready; container id y selectores.
 *
 * @browser Modern compatibility (ES2020+). Requires `class`, `modules`, and `localStorage` support.
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
    pendingPane: "#resourceslist-pending-tab-pane .app-resourceslist .type-checkbox",
    readyPane: "#resourceslist-ready-tab-pane .app-resourceslist .type-checkbox",
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    checkbox: "input.form-check-input",
    label: "label.form-check-label",
    btnAdd: "button.app-btn-add",
  };

  // crea todo el layout y devuelve referencias clave
  static buildLayout(containerEl) {
    // limpia contenedor destino (borra contenido previo)
    containerEl.innerHTML = "";

    // crea columna y tarjeta
    const col = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const h2 = el("h2", { html: "resources" });

    // raíz lógica
    const root = el("div", { attrs: { id: "resourceslist-container" } });

    // tabs
    const tabs = el("ul", {
      className: "nav nav-tabs nav-fill",
      attrs: { id: "resourceslist-tabs", role: "tablist" },
    });

    const liPend = el("li", { className: "nav-item", attrs: { role: "presentation" } });
    const btnPend = el("button", {
      className: "nav-link active",
      attrs: {
        id: "resourceslist-pending-tab",
        "data-bs-toggle": "tab",
        "data-bs-target": "#resourceslist-pending-tab-pane",
        type: "button",
        role: "tab",
        "aria-controls": "resourceslist-pending-tab-pane",
        "aria-selected": "true",
      },
      html: "Pending",
    });
    liPend.append(btnPend);

    const liReady = el("li", { className: "nav-item", attrs: { role: "presentation" } });
    const btnReady = el("button", {
      className: "nav-link",
      attrs: {
        id: "resourceslist-ready-tab",
        "data-bs-toggle": "tab",
        "data-bs-target": "#resourceslist-ready-tab-pane",
        type: "button",
        role: "tab",
        "aria-controls": "resourceslist-ready-tab-pane",
        "aria-selected": "false",
        tabindex: "-1",
      },
      html: "Ready",
    });
    liReady.append(btnReady);

    tabs.append(liPend, liReady);

    // contenido de pestañas
    const tabContent = el("div", {
      className: "tab-content",
      attrs: { id: "resourceslist-tabs-content" },
    });

    const panePend = el("div", {
      className: "tab-pane fade show active",
      attrs: {
        id: "resourceslist-pending-tab-pane",
        role: "tabpanel",
        "aria-labelledby": "resourceslist-pending-tab",
        tabindex: "0",
      },
    });
    const ulPend = el("ul", { className: "app-resourceslist type-checkbox list-group" });
    panePend.append(ulPend);

    const paneReady = el("div", {
      className: "tab-pane fade",
      attrs: {
        id: "resourceslist-ready-tab-pane",
        role: "tabpanel",
        "aria-labelledby": "resourceslist-ready-tab",
        tabindex: "0",
      },
    });
    const ulReady = el("ul", { className: "app-resourceslist type-checkbox list-group" });
    paneReady.append(ulReady);

    tabContent.append(panePend, paneReady);

    // ensambla tarjeta
    card.append(h2, root, tabs, tabContent);
    col.append(card);
    containerEl.append(col);

    return { root, ulPending: ulPend, ulReady };
  }

  constructor(containerEl) {
    // construye layout y guarda refs de listas
    const { root, ulPending, ulReady } = View.buildLayout(containerEl);
    this.root = root;
    this.pendingList = ulPending;
    this.readyList = ulReady;

    // pool de manejadores DnD para limpieza
    this._dndHandles = [];
  }

  // renderiza ambas listas
  render(items) {
    const pending = items.filter((i) => !i.completed);
    const ready = items.filter((i) => i.completed);

    this.pendingList.innerHTML = "";
    this.readyList.innerHTML = "";

    this.#renderList(this.pendingList, pending, { withNewEntry: true });
    this.#renderList(this.readyList, ready, { withNewEntry: false });

    this.#ensureReadyEmptyState();
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
      attachListReorder(this.readyList, common)
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
      attrs: { type: "checkbox", id: `resourceslist-check-${item.id}` },
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
        "aria-label": "Edit resource text",
        name: "inline-editor",
        rows: "1",
        id: `textarea-for-${item.id}`,
      },
    });

    const actions = el("div", { className: "d-flex flex-column mt-2 small" });
    const actionDefs = [
      // [key, text, hint, icono (opcional, default false)]
      ["save", "Save", "[Enter]"],
      ["discard", "Discard", "[Esc]"],
      ["delete", "Delete", "[Shift+Del]"],
      ["ai-spelling", "Fix spelling", "[Shift+F8]", true],
      ["ai-improve", "Improve writing", "[Shift+F9]", true],
      ["ai-breakdown", "Break down task", "[Shift+F10]", true],
    ];

    actionDefs.forEach(([key, text, hint, icono = false]) => {
      // Clase base para el elemento <a> (ancla). No lleva la clase 'app-icono'.
      const anchorClassName = "text-decoration-none fw-bold mb-2 d-flex justify-content-between";
      
      // Clase condicional para el primer <span>. Si 'icono' es true, se establece 'app-icono'.
      const spanClassName = icono ? "app-icono" : "";
      actions.append(
        el("a", {
          // La clase del <a> se mantiene constante.
          className: anchorClassName,
          attrs: { href: "#", "data-action": key },
          // El contenido HTML ahora inyecta la clase condicional en el primer <span>
          html: `<span class="${spanClassName}">${text}</span><span class="text-muted">${hint}</span>`,
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
        ? "resourceslist-ready-tab"
        : "resourceslist-pending-tab";
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

  // asegura placeholder cuando no hay 'ready'
  #ensureReadyEmptyState() {
    const ul = this.readyList;
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
        html: "No resources ready.",
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
        name: "new-resource",
        placeholder: "Add new resource and press Enter",
        "aria-label": "Add new resource",
      },
    });

    const btnAdd = el("button", {
      className: "btn app-btn-add",
      attrs: { type: "button", title: "Add new resource", "aria-label": "Add new resource" },
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
    this.COMPONENT_NAME = "resourceslist";

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
 * renderResourceslist(containerEl: HTMLElement)
 * - Called by main.js passing the container where everything must be created.
 */
export function renderResourceslist(containerEl) {
  // valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[resourceslist] invalid container element");
    return;
  }
  // crea layout y monta controlador sobre el contenedor
  new Controller(containerEl);
}
