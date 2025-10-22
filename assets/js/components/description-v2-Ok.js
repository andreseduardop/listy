/**
 * @fileoverview UI module for a single editable description block.
 * Follows MVC organization and exposes a single public function: renderDescription(containerEl).
 * Persists state under components.description.content using storage.js.
 *
 * @version 1.8.0
 *
 * Style: Google JavaScript Style Guide — https://google.github.io/styleguide/jsguide.html
 */

import { el, qs, qsa, visibility } from "../utils/helpers.js";
import * as storage from "../core/storage.js";

/** @typedef {{ text: string }} DescriptionModelState */

/**
 * Modelo: encapsula lectura/escritura del estado del componente en storage.
 * (comentario) Guarda un único objeto {text: string} bajo "components.description.content".
 */
class Model {
  /** @return {DescriptionModelState} */
  get() {
    // (comentario) Lee contenido existente y normaliza estructura.
    const content = storage.getComponentContent("description");
    if (!content || typeof content !== "object") {
      return { text: "Description text." };
    }
    const text = typeof content.text === "string" ? content.text : "Description text.";
    return { text };
  }

  /**
   * @param {DescriptionModelState} next
   * @return {void}
   */
  set(next) {
    // (comentario) Escribe objeto completo y notifica cambio.
    const payload = { text: String(next?.text ?? "") };
    storage.setComponentContent("description", payload);
    document.dispatchEvent(new CustomEvent("description:change"));
  }
}

/**
 * Vista: construye el layout requerido por description.html y maneja el DOM.
 * (comentario) No usa drag & drop, checks ni tabs.
 */
class View {
  /**
   * @param {!HTMLElement} host
   * @param {{
   *   onEnterEdit: () => void,
   *   onSave: (text: string) => void,
   *   onDiscard: () => void,
   *   onAiSpelling: (draft: string) => string,
   *   onAiImprove: (draft: string) => string,
   * }} handlers
   */
  constructor(host, handlers) {
    /** @private @const */ this.host_ = host;
    /** @private @const */ this.handlers_ = handlers;
    /** @private */ this.isEditing_ = false; // (comentario) Flag local para saber si está en modo edición.
    /** @private */ this.onDocPointerDown_ = (ev) => {
      // (comentario) Maneja commit por clic fuera del textarea durante la edición.
      if (!this.isEditing_) return;
      const t = /** @type {HTMLElement} */ (ev.target);
      // (comentario) Si hace clic en el propio textarea, no hace nada.
      if (t === this.textarea_ || this.textarea_.contains(t)) return;
      // (comentario) Si hace clic en una acción del panel (<a data-action>), no auto-commitea.
      if (t.closest?.('a[data-action]')) return;
      // (comentario) Cualquier otro clic (dentro o fuera del panel) dispara commit.
      this.handlers_.onSave(this.getDraft_());
    };

    // (comentario) Crea columna y tarjeta (estructura como en description.html).
    this.root_ = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const title = el("h2", { html: "description" });

    // (comentario) Contenedor de lectura.
    this.container_ = el("div", { className: "row", attrs: { id: "description-container" } });
    const article = el("article", { className: "col-12 mb-4", attrs: { "data-role": "article" } });
    const aside = el("aside", { className: "small text-center text-primary text-opacity-75" });
    // (comentario) Inserta nodos simples de texto + <br>.
    aside.append(
      document.createTextNode("Generated with local AI."),
      el("br"),
      document.createTextNode("Editable by you.")
    );

    // (comentario) Panel de edición (oculto por defecto).
    this.editor_ = el("div", {
      className: "d-flex flex-column d-none",
      attrs: { id: "description-editor", "data-role": "inline-panel" },
    });
    this.textarea_ = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit description text",
        name: "inline-editor",
        rows: "1",
      },
    });

    const toolbar = el("div", { className: "d-flex flex-column mt-3 small" });

    const aSave = el("a", {
      className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
      attrs: { href: "#", "data-action": "save" },
    });
    const aSaveL = el("span", { html: "Save" });
    const aSaveK = el("span", { className: "text-muted", html: "[Enter]" });
    aSave.append(aSaveL, aSaveK);

    const aDiscard = el("a", {
      className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
      attrs: { href: "#", "data-action": "discard" },
    });
    const aDiscardL = el("span", { html: "Discard" });
    const aDiscardK = el("span", { className: "text-muted", html: "[Esc]" });
    aDiscard.append(aDiscardL, aDiscardK);

    const aSpell = el("a", {
      className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
      attrs: { href: "#", "data-action": "ai-spelling" },
    });
    const aSpellL = el("span", { className: "app-icono", html: "Fix spelling" });
    const aSpellK = el("span", { className: "text-muted", html: "[Shift+F8]" });
    aSpell.append(aSpellL, aSpellK);

    const aImprove = el("a", {
      className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
      attrs: { href: "#", "data-action": "ai-improve" },
    });
    const aImproveL = el("span", { className: "app-icono", html: "Improve writing" });
    const aImproveK = el("span", { className: "text-muted", html: "[Shift+F9]" });
    aImprove.append(aImproveL, aImproveK);

    // (comentario) Ensambla DOM con append (no appendChild).
    toolbar.append(aSave, aDiscard, aSpell, aImprove);
    this.editor_.append(this.textarea_, toolbar);
    this.container_.append(article, aside);
    card.append(title, this.container_, this.editor_);
    this.root_.append(card);
    this.host_.append(this.root_);

    // (comentario) Click en lectura (article/aside) → entra a edición.
    this.container_.addEventListener("click", (ev) => {
      const t = /** @type {HTMLElement} */ (ev.target);
      if (t.tagName === "ASIDE" || t.closest("article")) {
        ev.preventDefault();
        this.handlers_.onEnterEdit();
      }
    });

    // (comentario) Acciones del panel.
    this.editor_.addEventListener("click", (ev) => {
      const a = /** @type {HTMLElement} */ (ev.target).closest("a[data-action]");
      if (!a) return;
      ev.preventDefault();
      const action = a.getAttribute("data-action");
      switch (action) {
        case "save":
          this.handlers_.onSave(this.getDraft_());
          break;
        case "discard":
          this.handlers_.onDiscard();
          break;
        case "ai-spelling":
          this.setDraft_(this.handlers_.onAiSpelling(this.getDraft_()));
          break;
        case "ai-improve":
          this.setDraft_(this.handlers_.onAiImprove(this.getDraft_()));
          break;
      }
    });

    // (comentario) Atajos de teclado del editor.
    this.textarea_.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        this.handlers_.onSave(this.getDraft_());
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.handlers_.onDiscard();
        return;
      }
      if (ev.shiftKey && ev.key === "F8") {
        ev.preventDefault();
        this.setDraft_(this.handlers_.onAiSpelling(this.getDraft_()));
        return;
      }
      if (ev.shiftKey && ev.key === "F9") {
        ev.preventDefault();
        this.setDraft_(this.handlers_.onAiImprove(this.getDraft_()));
        return;
      }
    });

    // (comentario) Listener global para commit por clic fuera del textarea (usa captura para fiabilidad).
    document.addEventListener("mousedown", this.onDocPointerDown_, true);

    // (comentario) Autoresize del textarea.
    this.textarea_.addEventListener("input", () => this.autosize_());
  }

  /**
   * Renderiza el estado en modo lectura.
   * @param {DescriptionModelState} state
   * @return {void}
   */
  render(state) {
    // (comentario) Usa qs(root, selector) en el orden correcto.
    const article = qs(this.container_, '[data-role="article"]');
    article.textContent = state.text ?? "";
    // (comentario) Conmuta visibilidad mediante el módulo visibility.
    visibility.setVisible(this.container_, true);
    visibility.setVisible(this.editor_, false);
    this.isEditing_ = false; // (comentario) Sale de edición si estaba en ella.
  }

  /**
   * Entra a modo edición con el texto actual.
   * @param {string} text
   * @return {void}
   */
  enterEdit(text) {
    this.setDraft_(text ?? "");
    this.autosize_();
    visibility.setVisible(this.container_, false); //
    visibility.setVisible(this.editor_, true);
    this.isEditing_ = true; // (comentario) Marca estado de edición.
    // (comentario) Foco y cursor al final.
    this.textarea_.focus();
    const len = this.textarea_.value.length;
    this.textarea_.setSelectionRange(len, len);
  }

  /** Sale de edición (vuelve a lectura). */
  exitEdit() {
    visibility.setVisible(this.container_, true); //
    visibility.setVisible(this.editor_, false);
    this.isEditing_ = false; // (comentario) Desmarca estado de edición.
  }

  /** @private */
  autosize_() {
    // (comentario) Ajusta altura al contenido (técnica similar a checklist.js).
    this.textarea_.style.height = "auto";
    this.textarea_.style.overflow = "hidden";
    this.textarea_.style.height = `${this.textarea_.scrollHeight}px`;
  }

  /** @private @return {string} */
  getDraft_() {
    // (comentario) Sanea: reemplaza CR/LF por espacio y colapsa espacios múltiples.
    const raw = this.textarea_.value ?? "";
    return raw.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  /** @private @param {string} v */
  setDraft_(v) {
    this.textarea_.value = v ?? "";
    this.autosize_();
  }
}

/**
 * Controlador: conecta la vista con el modelo y orquesta el flujo.
 */
class Controller {
  /** @param {!HTMLElement} host */
  constructor(host) {
    /** @private */ this.model_ = new Model();
    /** @private */ this.view_ = new View(host, {
      onEnterEdit: () => this.enterEdit_(),
      onSave: (text) => this.save_(text),
      onDiscard: () => this.discard_(),
      onAiSpelling: (draft) => this.aiSpelling_(draft),
      onAiImprove: (draft) => this.aiImprove_(draft),
    });

    // (comentario) Render inicial + escucha de cambios externos.
    this.view_.render(this.model_.get());
    document.addEventListener("description:change", () => {
      this.view_.render(this.model_.get());
    });
  }

  /** @private */
  enterEdit_() {
    const { text } = this.model_.get();
    this.view_.enterEdit(text);
  }

  /** @private @param {string} text */
  save_(text) {
    // (comentario) Persiste incluso vacío; <aside> permanece visible.
    this.model_.set({ text });
    this.view_.exitEdit();
  }

  /** @private */
  discard_() {
    // (comentario) Sale sin persistir cambios.
    this.view_.exitEdit();
  }

  /** @private @param {string} draft @return {string} */
  aiSpelling_(draft) {
    // (comentario) Placeholder local: corrige espacios dobles y capitaliza inicio.
    const fixed = String(draft ?? "").replace(/\s{2,}/g, " ").trim();
    return fixed ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
  }

  /** @private @param {string} draft @return {string} */
  aiImprove_(draft) {
    // (comentario) Placeholder local: mejora simple de legibilidad.
    let s = String(draft ?? "").trim();
    s = s.replace(/\.\.\./g, " — ").replace(/\s{2,}/g, " ");
    if (s && !/[.!?]$/.test(s)) s += ".";
    return s;
  }
}

/**
 * Public API — renderDescription para compatibilidad con coordinator.js.
 * @param {!HTMLElement} containerEl Mount point provided by coordinator.
 * @return {{ destroy: () => void }} Optional cleanup handle.
 */
export function renderDescription(containerEl) {
  // (comentario) Crea controlador y devuelve un handle de limpieza opcional.
  const controller = new Controller(containerEl);
  return {
    destroy() {
      // (comentario) Limpia listeners globales agregados por la vista.
      const v = controller?.view_;
      if (v && v.onDocPointerDown_) {
        document.removeEventListener("mousedown", v.onDocPointerDown_, true);
      }
      void controller;
    },
  };
}
