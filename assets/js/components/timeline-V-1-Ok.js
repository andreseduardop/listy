/**
 * @fileoverview UI module for an editable timeline component (list of activities).
 * MVC structure + public API renderTimeline(containerEl).
 * Persists state under components.timeline.content using storage.js.
 * Model follows teamlist's EventTarget-based change notifications.
 *
 * @version 2.0.0
 */

import { el, qs, visibility } from "../utils/helpers.js";
import * as storage from "../core/storage.js";
import { uid } from "../utils/uid.js";

/**
 * @typedef {{ id: string, heading: string, description: string }} TimelineItem
 * @typedef {{ items: !Array<TimelineItem> }} TimelineState
 */

/* ============================
 * Model (EventTarget style, like teamlist)
 * ============================ */
class Model extends EventTarget {
  constructor() {
    super();
    // (comentario) Clave de almacenamiento del componente
    this.key_ = "timeline";
  }

  /**
   * Lee el estado actual desde storage. Si está vacío, inicializa y persiste defaults una sola vez.
   * @return {TimelineState}
   */
  get() {
    const content = storage.getComponentContent(this.key_);
    const items = Array.isArray(content) ? content : content?.items;
    if (Array.isArray(items) && items.length > 0) {
      // (comentario) Devuelve clon defensivo
      return { items: structuredClone(items) };
    }

    // (comentario) No hay datos: crea y PERSISTE defaults para estabilizar los ids
    const defaults = [
      { id: uid(), heading: "Activity 1", description: "Activity 1 description text." },
      { id: uid(), heading: "Activity 2", description: "Activity 2 description text." },
    ];
    this.write_(defaults);
    return { items: structuredClone(defaults) };
  }

  /**
   * Escribe el arreglo de items y emite evento de cambio.
   * @param {!Array<TimelineItem>} items
   * @private
   */
  write_(items) {
    // (comentario) Persiste bajo components.timeline.content
    storage.setComponentContent(this.key_, Array.from(items));
    // (comentario) Emite evento de cambio (estilo teamlist)
    this.dispatchEvent(new Event("change"));
  }

  /**
   * Reemplaza todo el arreglo de items.
   * @param {!Array<TimelineItem>} items
   */
  set(items) {
    this.write_(items);
  }

  /**
   * Actualiza un ítem por id; si no existe, no hace nada (comportamiento consistente).
   * @param {string} id
   * @param {{ heading?: string, description?: string }} patch
   */
  update(id, patch) {
    const { items } = this.get();
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    items[idx] = { ...items[idx], ...patch };
    this.write_(items);
  }

  /**
   * Elimina un ítem por id.
   * @param {string} id
   */
  remove(id) {
    const { items } = this.get();
    const next = items.filter((x) => x.id !== id);
    this.write_(next);
  }

  /**
   * Agrega un nuevo ítem (con uid() si no se provee id).
   * @param {{ id?: string, heading?: string, description?: string }} data
   */
  add(data) {
    const { items } = this.get();
    const next = items.concat([
      {
        id: data.id ?? uid(),
        heading: data.heading ?? "",
        description: data.description ?? "",
      },
    ]);
    this.write_(next);
  }
}

/* ============================
 * View
 * ============================ */
class View {
  /**
   * @param {!HTMLElement} host
   * @param {{
   *   onSave: (id:string, heading:string, description:string) => void,
   *   onDiscard: () => void,
   *   onDelete: (id:string) => void
   * }} handlers
   */
  constructor(host, handlers) {
    // (comentario) Guarda referencias y estado local
    this.host_ = host;
    this.handlers_ = handlers;
    /** @type {string|null} */
    this.editingId_ = null;

    // (comentario) Shell del componente (alineado al layout timeline.html)
    this.root_ = el("div", { className: "col-12" });
    const card = el("div", { className: "app-card col" });
    const h2 = el("h2", { html: "timeline" });
    this.col_ = el("div", { className: "col" });

    // (comentario) Lista contenedora
    this.ul_ = el("ul", { className: "timeline-3", attrs: { role: "presentation" } });

    this.col_.append(this.ul_);
    card.append(h2, this.col_);
    this.root_.append(card);
    this.host_.append(this.root_);

    // (comentario) Listener global para commit al hacer clic fuera cuando está editando
    this.onDocPointerDown_ = (ev) => {
      if (this.editingId_ == null) return;
      const li = qs(this.ul_, `li[data-id="${this.editingId_}"]`);
      if (!li) return;
      if (li.contains(ev.target)) return; // clic dentro, ignora
      const { heading, description } = this.readDraftFrom_(li);
      this.handlers_.onSave(this.editingId_, heading, description);
      this.exitEdit_(li);
    };
    document.addEventListener("mousedown", this.onDocPointerDown_, true);
  }

  /**
   * Renderiza el listado en modo lectura.
   * @param {TimelineState} state
   */
  render(state) {
    // (comentario) Limpia lista
    this.ul_.innerHTML = "";

    // (comentario) Genera ítems
    for (const item of state.items) {
      const li = this.renderItem_(item);
      this.ul_.append(li);
    }

    // (comentario) Asegura visibilidad
    visibility.setVisible(this.root_, true);
  }

  /**
   * Crea un <li> para un ítem y cablea interacciones.
   * @param {TimelineItem} item
   * @return {!HTMLLIElement}
   * @private
   */
  renderItem_(item) {
    const li = el("li", { attrs: { "data-id": String(item.id) } });

    // (comentario) Modo lectura
    const h3 = el("h3", {
      className: "fw-semibold fs-6 mb-0",
      attrs: { "data-role": "heading" },
      html: item.heading ?? "",
    });
    const p = el("p", {
      className: "mt-2",
      attrs: { "data-role": "description" },
      html: item.description ?? "",
    });

    // (comentario) Panel inline oculto — usa data-field para evitar problemas con selectores por id
    const panel = el("div", {
      className: "d-flex flex-column gap-3 mt-3 d-none",
      attrs: { "data-role": "inline-panel" },
    });
    const taHeading = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "data-field": "heading",
        "aria-label": "Edit activity heading",
        name: "inline-editor-heading",
        rows: "1",
        placeholder: "Activity",
      },
    });
    const taDesc = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "data-field": "description",
        "aria-label": "Edit activity description",
        name: "inline-editor-description",
        rows: "1",
        placeholder: "Description",
      },
    });

    // (comentario) Toolbar de acciones
    const toolbar = el("div", { className: "d-flex flex-column small" });
    const aSave = el("a", {
      className: "text-decoration-none fw-bold mb-2",
      attrs: { href: "#", "data-action": "save" },
    });
    aSave.append(el("span", { html: "Save" }), el("br"), el("span", { className: "text-muted", html: "[Enter]" }));
    const aDiscard = el("a", {
      className: "text-decoration-none fw-bold mb-2",
      attrs: { href: "#", "data-action": "discard" },
    });
    aDiscard.append(el("span", { html: "Discard" }), el("br"), el("span", { className: "text-muted", html: "[Esc]" }));
    const aDelete = el("a", {
      className: "text-decoration-none fw-bold mb-2",
      attrs: { href: "#", "data-action": "delete" },
    });
    aDelete.append(
      el("span", { html: "Delete" }),
      el("br"),
      el("span", { className: "text-muted", html: "[Shift+Del]" })
    );

    toolbar.append(aSave, aDiscard, aDelete);
    panel.append(taHeading, taDesc, toolbar);
    li.append(h3, p, panel);

    // (comentario) Entra a edición al hacer clic en heading o descripción
    const enterEdit = () => {
      if (this.editingId_ != null && this.editingId_ !== item.id) {
        // (comentario) Si había otro en edición, guarda su borrador antes de cambiar
        const prev = qs(this.ul_, `li[data-id="${this.editingId_}"]`);
        if (prev) {
          const draftPrev = this.readDraftFrom_(prev);
          this.handlers_.onSave(this.editingId_, draftPrev.heading, draftPrev.description);
          this.exitEdit_(prev);
        }
      }
      this.enterEdit_(li, item);
    };
    h3.addEventListener("click", enterEdit);
    p.addEventListener("click", enterEdit);

    // (comentario) Acciones toolbar
    toolbar.addEventListener("click", (ev) => {
      const a = /** @type {!HTMLElement} */ (ev.target).closest("a[data-action]");
      if (!a) return;
      ev.preventDefault();
      const action = a.getAttribute("data-action");
      if (action === "save") {
        const { heading, description } = this.readDraftFrom_(li);
        this.handlers_.onSave(item.id, heading, description);
        this.exitEdit_(li);
      } else if (action === "discard") {
        this.handlers_.onDiscard();
        this.exitEdit_(li, /*restore=*/true, item);
      } else if (action === "delete") {
        this.handlers_.onDelete(item.id);
        // (comentario) El render posterior limpiará el DOM
      }
    });

    // (comentario) Atajos de teclado en edición
    panel.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        const { heading, description } = this.readDraftFrom_(li);
        this.handlers_.onSave(item.id, heading, description);
        this.exitEdit_(li);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.handlers_.onDiscard();
        this.exitEdit_(li, /*restore=*/true, item);
        return;
      }
      if (ev.shiftKey && (ev.key === "Delete" || ev.key === "Del")) {
        ev.preventDefault();
        this.handlers_.onDelete(item.id);
        return;
      }
    });

    // (comentario) Autosize de textareas
    const autosize = (ta) => {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    };
    taHeading.addEventListener("input", () => autosize(taHeading));
    taDesc.addEventListener("input", () => autosize(taDesc));

    return li;
  }

  /**
   * Entra a modo edición para un <li>.
   * @param {!HTMLLIElement} li
   * @param {TimelineItem} item
   * @private
   */
  enterEdit_(li, item) {
    // (comentario) Marca id en edición
    this.editingId_ = item.id;

    const panel = qs(li, '[data-role="inline-panel"]');
    const taH = qs(panel, '[data-field="heading"]');
    const taD = qs(panel, '[data-field="description"]');
    const h3 = qs(li, '[data-role="heading"]');
    const p = qs(li, '[data-role="description"]');

    // (comentario) Carga borrador con el contenido actual
    taH.value = h3.textContent ?? "";
    taD.value = p.textContent ?? "";

    // (comentario) Muestra panel y oculta lectura
    panel.classList.remove("d-none");
    h3.classList.add("d-none");
    p.classList.add("d-none");

    // (comentario) Foco y autoresize
    const autosize = (ta) => {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    };
    autosize(taH);
    autosize(taD);
    taH.focus();
  }

  /**
   * Sale del modo edición para un <li>.
   * @param {!HTMLLIElement} li
   * @param {boolean=} restore Si es true, restaura el texto de lectura desde el ítem original.
   * @param {TimelineItem=} item Ítem original (requerido si restore = true)
   * @private
   */
  exitEdit_(li, restore = false, item = undefined) {
    const panel = qs(li, '[data-role="inline-panel"]');
    const h3 = qs(li, '[data-role="heading"]');
    const p = qs(li, '[data-role="description"]');

    if (restore && item) {
      // (comentario) Restaura contenido
      h3.textContent = item.heading ?? "";
      p.textContent = item.description ?? "";
    }

    panel.classList.add("d-none");
    h3.classList.remove("d-none");
    p.classList.remove("d-none");
    this.editingId_ = null;
  }

  /**
   * Lee los valores de borrador del panel inline de un <li>.
   * @param {!HTMLLIElement} li
   * @return {{ heading: string, description: string }}
   * @private
   */
  readDraftFrom_(li) {
    // (comentario) Selecciona por data-field para evitar problemas de selectores
    const taH = qs(li, '[data-field="heading"]');
    const taD = qs(li, '[data-field="description"]');
    const heading = String(taH.value ?? "").replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim();
    const description = String(taD.value ?? "").replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim();
    return { heading, description };
  }
}

/* ============================
 * Controller
 * ============================ */
class Controller {
  /**
   * @param {!HTMLElement} containerEl
   */
  constructor(containerEl) {
    // (comentario) Instancia modelo y vista; conecta handlers
    this.model_ = new Model();
    this.view_ = new View(containerEl, {
      onSave: (id, heading, description) => {
        this.model_.update(id, { heading, description });
      },
      onDiscard: () => {
        /* (comentario) No hace nada; la vista se encarga de restaurar visualmente */
      },
      onDelete: (id) => {
        this.model_.remove(id);
      },
    });

    // (comentario) Render inicial
    this.view_.render(this.model_.get());

    // (comentario) Suscribe a cambios del modelo (estilo teamlist)
    this.onModelChange_ = () => {
      this.view_.render(this.model_.get());
    };
    this.model_.addEventListener("change", this.onModelChange_);
  }
}

/* ============================
 * Public API
 * ============================ */
/**
 * Public API — renderTimeline for coordinator.js compatibility.
 * @param {!HTMLElement} containerEl Mount point provided by coordinator.
 * @return {{ destroy: () => void }} Optional cleanup handle.
 */
export function renderTimeline(containerEl) {
  // (comentario) Crea controlador y devuelve handle para limpiar listeners
  const controller = new Controller(containerEl);
  return {
    destroy() {
      // (comentario) Limpia listener global de la vista
      const v = controller?.view_;
      if (v?.onDocPointerDown_) {
        document.removeEventListener("mousedown", v.onDocPointerDown_, true);
      }
      // (comentario) Limpia listener del modelo
      if (controller?.onModelChange_) {
        controller.model_.removeEventListener("change", controller.onModelChange_);
      }
    },
  };
}
