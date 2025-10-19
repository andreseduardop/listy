/**
 * @fileoverview Shedule (activity list with times) UI module.
 * @module components/shedule
 *
 * @description
 * Builds and initializes a schedule list inside the given container based on the
 * `shedule.html` layout: an unordered list where each item has a time input and
 * an inline editor for the activity text. Supports inline editing, creation, and
 * in-list reordering via drag & drop.
 * Persistence is delegated to `core/storage.js` under the key
 * `components.<COMPONENT_NAME>.content`.
 *
 * Differences vs stepslist:
 * - Uses <ul> with classes "app-shedule type-shedule list-group" (no numbering).
 * - Item layout adds a leading <input type="time"> block.
 * - Renames "step" → "activity" in labels, placeholders, and ARIA attributes.
 * - Data model includes {id, text, time}.
 *
 * @version 3.0.0
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 *
 * @exports renderShedule
 */
import { el, qs, qsa, visibility, flashBackground } from "../utils/helpers.js";
import { attachListReorder } from "../utils/drag-and-drop.js";
import * as storage from "../core/storage.js";
import { uid } from "../utils/uid.js";

/* ================================
 * Model (component-scoped; delegates to storage.js)
 * ================================ */
/**
 * @typedef {Object} SheduleItem
 * @property {string} id
 * @property {string} text
 * @property {string} time  // "HH:MM"
 */
class Model extends EventTarget {
  /**
   * @param {string} componentName
   */
  constructor(componentName) {
    super();
    /** @private {string} */
    this._name = componentName; // Comentario: guarda el nombre del componente
  }

  /** @private */
  _deepClone(obj) {
    // Comentario: clona objetos JSON de forma defensiva
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Returns all items for this component.
   * @return {!Array<SheduleItem>}
   */
  getAll() {
    // Comentario: lee desde storage y normaliza a arreglo de items con 'time'
    const content = storage.getComponentContent(this._name);
    const arr = Array.isArray(content) ? content : [];
    return arr.map(({ id, text, time }) => ({
      id,
      text,
      time: typeof time === "string" && /^\d{2}:\d{2}$/.test(time) ? time : "08:30",
    }));
  }

  /** @private */
  _write(nextItems) {
    // Comentario: escribe items en storage y emite evento de cambio
    storage.setComponentContent(
      this._name,
      nextItems.map(({ id, text, time }) => ({ id, text, time })),
    );
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { name: this._name, items: this.getAll() },
      }),
    );
  }

  /**
   * Adds a new item.
   * @param {string} text
   * @param {string=} time
   * @return {void}
   */
  add(text, time = "08:30") {
    // Comentario: agrega item si el texto no está vacío; fija hora por defecto si no se indica
    const t = String(text || "").trim();
    if (!t) return;
    const items = this.getAll();
    items.push({ id: uid(), text: t, time });
    this._write(items);
  }

  /**
   * Updates the text of an item; removes it if the text becomes empty.
   * @param {string} id
   * @param {string} text
   * @return {void}
   */
  updateText(id, text) {
    // Comentario: actualiza el texto o elimina si queda vacío
    const t = String(text || "").trim();
    if (!t) return this.remove(id);
    const items = this.getAll().map((i) => (i.id === id ? { ...i, text: t } : i));
    this._write(items);
  }

  /**
   * Updates the time of an item.
   * @param {string} id
   * @param {string} time
   * @return {void}
   */
  updateTime(id, time) {
    // Comentario: actualiza la hora (HH:MM) si es válida
    const hhmm = String(time || "");
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return;
    const items = this.getAll().map((i) => (i.id === id ? { ...i, time: hhmm } : i));
    this._write(items);
  }

  /**
   * Removes an item by id.
   * @param {string} id
   * @return {void}
   */
  remove(id) {
    // Comentario: elimina el item según id
    const items = this.getAll().filter((i) => i.id !== id);
    this._write(items);
  }

  /**
   * Moves an item to a target index in the same list.
   * @param {string} id
   * @param {number} toIndex
   * @return {void}
   */
  moveToIndex(id, toIndex) {
    // Comentario: reubica el item al índice destino
    const items = this.getAll();
    const len = items.length;
    if (len <= 1) return;

    const from = items.findIndex((i) => i.id === id);
    if (from === -1) return;

    let dest = Math.max(0, Math.min(len, Number(toIndex)));
    if (dest === from || dest === from + 1) return;

    const arr = [...items];
    const [moved] = arr.splice(from, 1);
    if (dest > from) dest -= 1;
    arr.splice(dest, 0, moved);

    this._write(arr);
  }
}

/* ================================
 * View (builds full layout inside container)
 * ================================ */
class View {
  // Comentario: selectores reutilizables
  static SEL = {
    list: "ul.app-shedule.type-shedule.list-group",
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    label: "label.form-label",
    time: "input[type='time']",
    btnAdd: "button.app-btn-add",
  };

  // Comentario: crea el layout y devuelve referencias clave
  static buildLayout(containerEl) {
    // Comentario: limpia contenedor destino
    containerEl.innerHTML = "";

    // Comentario: crea columna y tarjeta
    const col = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });

    // Comentario: título
    const h2 = el("h2", { html: "shedule" });

    // Comentario: raíz del componente
    const root = el("div", { attrs: { id: "shedule-container" } });

    // Comentario: lista UL principal
    const ul = el("ul", {
      className: "app-shedule type-shedule list-group",
    });

    root.append(ul);
    card.append(h2, root);
    col.append(card);
    containerEl.append(col);

    return { root, listEl: ul };
  }

  /**
   * @param {!HTMLElement} containerEl
   */
  constructor(containerEl) {
    // Comentario: construye layout y guarda refs
    const { root, listEl } = View.buildLayout(containerEl);
    this.root = root;
    this.listEl = listEl;

    // Comentario: pool de manejadores DnD para limpieza
    this._dndHandles = [];
  }

  /**
   * Renderiza la lista completa.
   * @param {!Array<SheduleItem>} items
   * @return {void}
   */
  render(items) {
    this.listEl.innerHTML = "";
    this.#renderList(this.listEl, items, { withNewEntry: true });
    this.#initDnD(); // Comentario: activa DnD tras render
  }

  // Comentario: inicializa drag & drop en la lista
  #initDnD() {
    // Comentario: destruye instancias previas
    this._dndHandles.forEach((h) => {
      try {
        h.destroy?.();
      } catch {}
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

    this._dndHandles.push(attachListReorder(this.listEl, common));
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

    // Comentario: columna que contiene el time y el editor
    const column = el("div", {
      className: "d-flex flex-column flex-grow-1",
    });

    // Comentario: fila de hora
    const timeWrap = el("div", { className: "mb-1" });
    const timeInput = el("input", {
      className: "form-control form-control-plaintext fw-bold p-0",
      attrs: {
        type: "time",
        "aria-label": "Activity time",
        value: item.time || "08:30",
      },
    });
    timeWrap.append(timeInput);

    // Comentario: fila con label + panel de edición (ms-2 para margen)
    const textWrap = el("div", {
      className: "position-relative d-flex align-items-top ms-2",
    });

    const label = el("label", {
      className: "form-label flex-grow-1 mb-0",
      attrs: { for: `textarea-for-${item.id}` },
    });
    label.textContent = item.text;

    // Comentario: panel inline inicialmente oculto
    const panel = el("div", { className: "d-flex flex-column ps-1 flex-grow-1 d-none" });

    // Comentario: editor con ARIA para actividad
    const editor = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit activity",
        rows: "1",
        id: `textarea-for-${item.id}`,
      },
    });

    // Comentario: acciones (texto 'Break down activity')
    const actions = el("div", { className: "d-flex flex-column mt-2 small" });
    const actionDefs = [
      ["save", "Save", "[Enter]"],
      ["discard", "Discard", "[Esc]"],
      ["delete", "Delete", "[Shift+Del]"],
      ["ai-spelling", "Fix spelling", "[Shift+F8]", true],
      ["ai-improve", "Improve writing", "[Shift+F9]", true],
      ["ai-breakdown", "Break down activity", "[Shift+F10]", true],
    ];

    actionDefs.forEach(([key, text, hint, icono = false]) => {
      const anchorClassName =
        "text-decoration-none fw-bold mb-2 d-flex justify-content-between";
      const spanClassName = icono ? "app-icono" : "";
      actions.append(
        el("a", {
          className: anchorClassName,
          attrs: { href: "#", "data-action": key },
          html: `<span class="${spanClassName}">${text}</span><span class="text-muted">${hint}</span>`,
        }),
      );
    });

    panel.append(editor, actions);
    textWrap.append(label, panel);

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

    column.append(timeWrap, textWrap);
    li.append(column, btnMove);

    // Comentario: listeners de interacción
    // - Cambios de hora
    timeInput.addEventListener("change", () => {
      const next = String(timeInput.value || "").slice(0, 5);
      this.onTimeChange?.(item.id, next);
      // Comentario: realza el item al actualizar hora
      flashBackground(li);
    });

    // - Edición inline del texto
    label.addEventListener("click", () => {
      // Comentario: prepara edición inline
      const currentText = label.textContent.trim();
      visibility.hide(label);
      visibility.show(panel, "d-flex");
      editor.value = currentText || "Editing activity";

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
            editor.value.length,
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
          if (!next) this.onEdit?.(item.id, ""); // Comentario: vacío → eliminar
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

  // Comentario: crea fila de nueva entrada
  #renderNewItemEntry() {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
    });
    li.dataset.role = "new-entry";
    li.draggable = false;

    // Comentario: input con placeholder/aria/name actualizados
    const input = el("input", {
      className: "form-control",
      attrs: {
        type: "text",
        name: "Add new activity",
        placeholder: "Add new activity and press Enter",
        "aria-label": "Add new activity",
        enterkeyhint: "enter",
      },
    });

    const btnAdd = el("button", {
      className: "btn app-btn-add",
      attrs: {
        type: "button",
        title: "Add new activity",
        "aria-label": "Add new activity",
      },
      html: `<i class="bi bi-plus-square-fill fs-3" aria-hidden="true"></i>`,
    });

    const create = () => {
      const t = input.value.trim();
      if (!t) return;
      this.onCreate?.(t);
      // Comentario: limpia y refocus tras crear
      input.value = "";
      input.focus();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") create();
    });
    btnAdd.addEventListener("click", create);

    li.append(input, btnAdd);
    return li;
  }

  // Comentario: API para enfocar el input de nueva entrada
  focusNewEntryInput() {
    const entry = qs(this.listEl, View.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }
}

/* ================================
 * Controller
 * ================================ */
class Controller {
  /**
   * @param {!HTMLElement} containerEl
   */
  constructor(containerEl) {
    // Comentario: define y almacena el nombre del componente que controla
    this.COMPONENT_NAME = "shedule";

    // Comentario: instancia modelo y vista
    this.model = new Model(this.COMPONENT_NAME);
    this.view = new View(containerEl);

    // Comentario: banderas para UX de creación
    this.createInFlight = false;
    this.shouldRefocusNewEntry = false;

    // Comentario: render inicial
    this.view.render(this.model.getAll());

    // Comentario: sincroniza vista ante cambios del modelo del mismo componente
    this.model.addEventListener("change", (ev) => {
      const changedName = ev?.detail?.name;
      if (!changedName || changedName === this.COMPONENT_NAME) {
        this.view.render(this.model.getAll());
        if (this.shouldRefocusNewEntry) {
          this.view.focusNewEntryInput();
          this.shouldRefocusNewEntry = false;
        }
        this.createInFlight = false;
      }
    });

    // Comentario: conecta handlers de la vista
    this.view.onCreate = (text) => {
      if (this.createInFlight) return;
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      this.model.add(text);
    };
    this.view.onEdit = (id, text) => {
      if (String(text).trim() === "") this.model.remove(id);
      else this.model.updateText(id, text);
    };
    this.view.onTimeChange = (id, time) => {
      this.model.updateTime(id, time);
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
 * renderShedule(containerEl: HTMLElement)
 * - Called by main.js passing the container where everything must be created.
 * @param {!HTMLElement} containerEl
 * @return {void}
 */
export function renderShedule(containerEl) {
  // Comentario: valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[shedule] invalid container element");
    return;
  }
  // Comentario: crea layout y monta controlador sobre el contenedor
  new Controller(containerEl);
}

// Comentario: export opcional de compatibilidad, por si algún código antiguo lo invoca
export const renderSchedule = renderShedule;
