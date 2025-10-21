/**
 * @fileoverview Description UI module.
 * @module components/description
 *
 * @description
 * Builds and initializes an inline-editable description panel mirroring the layout
 * of description.html: inside #description-container there is a first <div> with the
 * content and a second <div class="small"> with the permanent tagline.
 *
 * Key changes (v3.4.0):
 * - Removes "Delete" action and related shortcut/logic.
 * - Makes "Discard" restore the exact pre-edit text (uses snapshot taken at edit start).
 *
 * Previous changes (v3.3.0):
 * - Replaces visibility helpers with `.d-none` class toggling for hide/show.
 *
 * @version 3.4.0
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 *
 * @exports renderDescription
 */

import {el} from "../utils/helpers.js";
import * as storage from "../core/storage.js";

/* ================================
 * Model (texto único; delega a storage.js)
 * ================================ */
class Model extends EventTarget {
  /** @param {string} componentName */
  constructor(componentName) {
    super();
    /** @private {string} */
    this._name = componentName; // Comentario: guarda el nombre del componente
  }

  /**
   * Devuelve el texto almacenado o cadena vacía.
   * @return {string}
   */
  getText() {
    // Comentario: lee desde storage y normaliza a string
    const content = storage.getComponentContent(this._name);
    return typeof content === "string" ? content : "";
  }

  /**
   * Escribe el texto y emite evento de cambio.
   * @param {string} text
   * @return {void}
   */
  setText(text) {
    // Comentario: escribe texto normalizado
    const t = String(text ?? "");
    storage.setComponentContent(this._name, t);
    this.dispatchEvent(
      new CustomEvent("change", {detail: {name: this._name, text: this.getText()}})
    );
  }

  /**
   * Limpia el texto.
   * @return {void}
   */
  clear() {
    // Comentario: borra el contenido
    this.setText("");
  }
}

/* ================================
 * View (construye layout description.html)
 * ================================ */
class View {
  /**
   * @param {!HTMLElement} containerEl
   */
  constructor(containerEl) {
    // Comentario: construye layout y guarda refs
    const {
      root,
      descriptionEl,
      contentEl,
      panelEl,
      textareaEl,
      actionsEl,
    } = View.buildLayout(containerEl);
    /** @public {!HTMLElement} */ this.root = root;
    /** @public {!HTMLElement} */ this.descriptionEl = descriptionEl;
    /** @public {!HTMLElement} */ this.contentEl = contentEl;
    /** @public {!HTMLElement} */ this.panelEl = panelEl;
    /** @public {!HTMLTextAreaElement} */ this.textareaEl =
      /** @type {!HTMLTextAreaElement} */ (textareaEl);
    /** @public {!HTMLElement} */ this.actionsEl = actionsEl;
  }

  // crea layout exacto a description.html (sin listas ni DnD)
  static buildLayout(containerEl) {
    // Comentario: limpia contenedor
    containerEl.innerHTML = "";

    const col = el("div", {className: "col-12"});
    const card = el("div", {className: "app-card col"});

    // Wrappers del título
    const headerWrap = el("div", {className: "d-flex flex-column w-100"});
    const headerBar = el("div", {
      className: "d-flex align-items-center justify-content-between mb-2",
    });
    const h2 = el("h2", {html: "description"});
    headerBar.append(h2);
    headerWrap.append(headerBar);

    // Contenedor principal de descripción con aria-live
    const descriptionContainer = el("div", {
      attrs: {id: "description-container", "aria-live": "polite", role: "status"},
    });

    // == Interior exacto: [div contenido] + [div.small tagline]
    const contentDiv = el("div", {html: "Description text"}); // Comentario: coloca placeholder visual
    const taglineDiv = el("div", {
      className: "small mt-3",
      html: "“Generated with local AI — editable by you.”",
    });
    descriptionContainer.append(contentDiv, taglineDiv);

    // Panel de edición inline (oculto inicialmente con d-none)
    const inlinePanel = el("div", {
      className: "d-flex flex-column ps-1 flex-grow-1 d-none",
      attrs: {"data-role": "inline-panel"},
    });
    const textarea = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit description text",
        name: "inline-editor",
        rows: "1",
        id: "textarea-to-edit-description",
      },
    });

    const actions = el("div", {className: "d-flex flex-column mt-2 small"});
    const makeAction = (key, text, hint, withIcon = false) =>
      el("a", {
        className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
        attrs: {href: "#", "data-action": key},
        html: `<span${withIcon ? ' class="app-icono"' : ""}>${text}</span><span class="text-muted">${hint}</span>`,
      });
    actions.append(
      makeAction("save", "Save", "[Enter]"),
      makeAction("discard", "Discard", "[Esc]"),
      // Comentario: elimina "Delete" (ya no se agrega)
      makeAction("ai-spelling", "Fix spelling", "[Shift+F8]", true),
      makeAction("ai-improve", "Improve writing", "[Shift+F9]", true)
    );

    inlinePanel.append(textarea, actions);

    card.append(headerWrap, descriptionContainer, inlinePanel);
    col.append(card);
    containerEl.append(col);

    return {
      root: card,
      descriptionEl: descriptionContainer,
      contentEl: contentDiv,
      panelEl: inlinePanel,
      textareaEl: textarea,
      actionsEl: actions,
    };
  }

  /**
   * Renderiza el texto de descripción en el primer <div> y deja el tagline intacto.
   * @param {string} text
   * @return {void}
   */
  render(text) {
    // Comentario: actualiza únicamente el div de contenido; mantiene el tagline permanente
    const value = String(text || "").trim();
    this.contentEl.innerHTML = value || "Description text.";

    // Comentario: asegura que el panel de edición esté oculto con .d-none
    this.panelEl.classList.add("d-none");
  }
}

/* ================================
 * Controller
 * ================================ */
class Controller {
  /** @param {!HTMLElement} containerEl */
  constructor(containerEl) {
    // Comentario: fija nombre del componente
    this.COMPONENT_NAME = "description";

    // Comentario: instancia modelo y vista
    this.model = new Model(this.COMPONENT_NAME);
    this.view = new View(containerEl);

    // Comentario: render inicial
    this.view.render(this.model.getText());

    // Comentario: sincroniza ante cambios del modelo
    this.model.addEventListener("change", (ev) => {
      const name = ev?.detail?.name;
      if (!name || name === this.COMPONENT_NAME) {
        this.view.render(this.model.getText());
      }
    });

    // Comentario: conecta edición al hacer click sobre el contenedor principal
    this.view.descriptionEl.addEventListener("click", () => this.#beginInlineEdit());

    // Comentario: conecta acciones del panel
    this.view.actionsEl.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-action]");
      if (!a) return;
      e.preventDefault();
      const act = a.getAttribute("data-action");
      if (act === "save") this.#finalizeEdit("commit");
      else if (act === "discard") this.#finalizeEdit("cancel");
      // Comentario: elimina rama "delete"
      else if (act === "ai-spelling" || act === "ai-improve") {
        // Comentario: emite evento para integraciones de IA externas
        this.view.textareaEl.dispatchEvent(
          new CustomEvent("ai-action", {
            bubbles: true,
            detail: {action: act, value: this.view.textareaEl.value},
          })
        );
      }
    });
  }

  // inicia la edición inline
  #beginInlineEdit() {
    // Comentario: toma snapshot del texto actual para poder restaurarlo en "Discard"
    this._snapshotText = this.model.getText();

    // Comentario: oculta temporalmente el contenedor visible durante la edición con .d-none
    this.view.descriptionEl.classList.add("d-none");

    // Comentario: muestra panel y precarga el valor actual
    const current = this._snapshotText.trim();
    const ta = this.view.textareaEl;
    ta.value = current || "Editing description";

    // Comentario: muestra el panel removiendo .d-none
    this.view.panelEl.classList.remove("d-none");

    // Comentario: autoresize
    const autoresize = () => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    };

    // Comentario: sanea saltos de línea → espacios
    const sanitizeNoNewlines = () => {
      const sanitized = ta.value.replace(/\r?\n+/g, " ");
      if (sanitized !== ta.value) {
        const pos = ta.selectionStart;
        ta.value = sanitized;
        ta.selectionStart = ta.selectionEnd = Math.min(pos, ta.value.length);
      }
    };

    const onKeyDown = (ke) => {
      if (ke.key === "Enter") {
        ke.preventDefault();
        this.#finalizeEdit("commit");
      } else if (ke.key === "Escape") {
        ke.preventDefault();
        this.#finalizeEdit("cancel");
      }
      // Comentario: elimina atajo Shift+Delete (ya no existe "Delete")
    };

    const onInput = () => {
      sanitizeNoNewlines();
      autoresize();
    };

    const onBlur = () => this.#finalizeEdit("commit");

    // Comentario: listeners temporales
    ta.addEventListener("keydown", onKeyDown);
    ta.addEventListener("input", onInput);
    ta.addEventListener("blur", onBlur, {once: true});

    // Comentario: enfoque inicial
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    autoresize();

    // Comentario: guarda desuscriptores para finalización
    this._cleanupInline = () => {
      ta.removeEventListener("keydown", onKeyDown);
      ta.removeEventListener("input", onInput);
      // onBlur se registró con once:true
    };
  }

  // finaliza la edición (commit/cancel)
  #finalizeEdit(mode) {
    // Comentario: evita dobles commits
    if (this._finalized) return;
    this._finalized = true;

    // Comentario: limpia listeners
    this._cleanupInline?.();
    this._cleanupInline = null;

    const ta = this.view.textareaEl;

    if (mode === "commit") {
      // Comentario: guarda cambios
      const next = ta.value.trim();
      if (next) this.model.setText(next);
      else this.model.clear();
    } else if (mode === "cancel") {
      // Comentario: restaura el snapshot previo a la edición
      this.model.setText(this._snapshotText ?? this.model.getText());
    }

    // Comentario: oculta panel con .d-none
    this.view.panelEl.classList.add("d-none");

    // Comentario: re-renderiza con el estado actual del modelo
    this.view.render(this.model.getText());

    // Comentario: vuelve a mostrar el contenedor de descripción quitando .d-none
    this.view.descriptionEl.classList.remove("d-none");

    // Comentario: limpia snapshot y permite nueva edición
    this._snapshotText = null;
    setTimeout(() => {
      this._finalized = false;
    }, 0);
  }
}

/* ================================
 * Public API
 * ================================ */

/**
 * renderDescription(containerEl: HTMLElement)
 * - Llamado por coordinator.js con el contenedor donde se crea todo.
 * @param {!HTMLElement} containerEl
 * @return {void}
 */
export function renderDescription(containerEl) {
  // Comentario: valida el contenedor recibido
  if (!containerEl || !(containerEl instanceof HTMLElement)) {
    console.error("[description] invalid container element");
    return;
  }
  // Comentario: crea layout y monta controlador
  new Controller(containerEl);
}
