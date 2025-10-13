/**
 * @fileoverview Steps List UI module.
 * @module components/stepslist
 *
 * @description
 * Construye e inicializa una lista de pasos **dentro del contenedor recibido**.
 * Crea el layout (una sola pestaña/área de contenido), renderiza items desde `localStorage`
 * y conecta edición inline, creación y reordenamiento por drag & drop.
 * Persistencia: guarda los items en `localStorage` como parte de un **modelo raíz**
 * con el esquema importado desde `../core/json/model.json`, dentro de
 * `components.<COMPONENT_NAME>.content`.
 *
 * @requires ../utils/helpers.js
 *   - `el(tag, opts)`        // Crea nodos HTML
 *   - `qs(root, sel)`        // Busca un único elemento
 *   - `qsa(root, sel)`       // Busca múltiples elementos
 *   - `visibility.{show,hide}` // Cambia visibilidad con clases
 *
 * @requires ../utils/drag-and-drop.js
 *   - `attachListReorder(ulOrOl, options)` // Habilita reordenamiento con DnD
 *
 * @version 1.0.0
 *
 * @exports renderStepslist
 * Expone la función pública para inicializar el módulo.
 *
 * @typedef {Object} StepItem
 * @property {string} id          - Identificador único (genera id corto).
 * @property {string} text        - Descripción del paso (usa `text` en el modelo para compatibilidad).
 *
 * @callback ReorderHandler
 * @param {string} draggedId - Id del item arrastrado.
 * @param {number} toIndex   - Índice destino donde se inserta.
 *
 * @function renderStepslist
 * @param {HTMLElement} containerEl - Contenedor **dentro del cual** se construye todo el UI.
 * @returns {void}
 *
 * @example <caption>Uso típico desde main.js</caption>
 * // Code in English; comentarios en español
 * import { renderStepslist } from "./components/stepslist.js";
 * const container = document.getElementById("app-container-1"); // Obtiene contenedor
 * renderStepslist(container); // Crea el layout y arranca la lista de pasos dentro del contenedor
 */

import { el, qs, qsa, visibility } from "../utils/helpers.js";
import { attachListReorder } from "../utils/drag-and-drop.js";
import { Model } from "../core/model.js";

/* ================================
 * View (builds full layout inside container)
 * ================================ */
class View {
  // selectores reutilizables
  static SEL = {
    list: "#stepslist-pending-tab-pane .app-stepslist",
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    label: "label.form-label",
  };

  // crea todo el layout y devuelve referencias clave
  static buildLayout(containerEl) {
    // limpia contenedor destino
    containerEl.innerHTML = "";

    // crea columna y tarjeta
    const col = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const h2 = el("h2", { html: "steps list" });

    // raíz lógica del stepslist
    const stepsRoot = el("div", { attrs: { id: "stepslist-container" } });

    // contenido (sin tabs visibles; mantiene estructura de tab-content)
    const tabContent = el("div", {
      className: "tab-content",
      attrs: { id: "stepslist-tabs-content" },
    });

    const pane = el("div", {
      className: "tab-pane fade active show",
      attrs: {
        id: "stepslist-pending-tab-pane",
        role: "tabpanel",
        "aria-labelledby": "stepslist-pending-tab",
        tabindex: "0",
      },
    });

    const ol = el("ol", {
      className: "app-stepslist type-stepslist list-group list-group-numbered",
    });

    pane.append(ol);
    tabContent.append(pane);

    // ensambla tarjeta
    card.append(h2, stepsRoot, tabContent);
    col.append(card);
    containerEl.append(col);

    return { root: stepsRoot, list: ol };
  }

  constructor(containerEl) {
    // construye layout y guarda refs
    const { root, list } = View.buildLayout(containerEl);
    this.root = root;
    this.list = list; // <ol>
    this._dndHandles = []; // pool de manejadores DnD
  }

  // renderiza la lista
  render(items) {
    this.list.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach((item) => frag.appendChild(this.#renderItem(item)));
    frag.appendChild(this.#renderNewItemEntry());
    this.list.appendChild(frag);
    this.#initDnD(); // Activa DnD tras render
  }

  // inicializa drag & drop
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

    this._dndHandles.push(attachListReorder(this.list, common));
  }

  // crea <li> por item
  #renderItem(item) {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
      attrs: { draggable: "true" },
    });
    li.dataset.id = item.id;

    const wrapper = el("div", {
      className: "position-relative d-flex align-items-top flex-grow-1",
    });

    const label = el("label", {
      className: "form-label flex-grow-1 mb-0",
      attrs: { for: `textarea-for-${item.id}` },
    });
    label.textContent = item.text ?? ""; // usa `text` como descripción

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
      // [key, text, hint, icon]
      ["save", "Save", "[Enter]", false],
      ["discard", "Discard", "[Esc]", false],
      ["delete", "Delete", "[Shift+Del]", false],
      ["ai-spelling", "AI Fix spelling", "[Shift+F8]", true],
      ["ai-improve", "AI improve writing", "[Shift+F9]", true],
      ["ai-breakdown", "AI break down task", "[Shift+F10]", true],
    ];

    actionDefs.forEach(([key, text, hint, icon = false], idx) => {
      // construye ancla de acción con posible ícono
      actions.append(
        el("a", {
          className:
            "text-decoration-none fw-bold " + (idx === 0 ? "mt-1 " : "") +
            "mb-2 d-flex justify-content-between",
          attrs: { href: "#", "data-action": key },
          html: `<span${icon ? " class=\"app-icono\"" : ""}>${text}</span><span class="text-muted">${hint}</span>`,
        })
      );
    });

    panel.append(editor, actions);
    wrapper.append(label, panel);

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

    li.append(wrapper, btnMove);

    // listeners del item
    label.addEventListener("click", () => {
      // prepara edición inline
      const currentText = label.textContent.trim();
      visibility.hide(label);
      visibility.show(panel, "d-flex");
      editor.value = currentText;

      // auto-resize
      const autoresize = () => {
        // ajusta altura al contenido
        editor.style.height = "auto";
        editor.style.height = editor.scrollHeight + "px";
      };

      // sanea saltos de línea → espacios
      const sanitizeNoNewlines = () => {
        // reemplaza saltos por espacios para mantener una sola línea
        const sanitized = editor.value.replace(/\r?\n+/g, " ");
        if (sanitized !== editor.value) {
          const pos = editor.selectionStart;
          editor.value = sanitized;
          editor.selectionStart = editor.selectionEnd = Math.min(pos, editor.value.length);
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
        // maneja atajos Enter/Esc/Shift+Del
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

  // crea fila de nueva entrada
  #renderNewItemEntry() {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
    });
    li.dataset.role = "new-entry";
    li.draggable = false;

    const input = el("input", {
      className: "form-control",
      attrs: {
        type: "text",
        name: "Add new task",
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
      if (!t) return; // evita entradas vacías
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
    const entry = qs(this.list, View.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }
}

/* ================================
 * Controller
 * ================================ */
class Controller {
  constructor(containerEl) {
    // define y almacena el nombre del componente que controla
    this.COMPONENT_NAME = "stepslist";

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
      if (this.createInFlight) return; // evita doble creación
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      // agrega un ítem con `text` como descripción (compatibilidad con Model)
      this.model.add(this.COMPONENT_NAME, text);
    };
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
 * renderStepslist(containerEl: HTMLElement)
 * - Called by main.js passing the container where everything must be created.
 */
export function renderStepslist(containerEl) {
  // valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[stepslist] invalid container element");
    return;
  }
  // crea layout y monta controlador sobre el contenedor
  new Controller(containerEl);
}
