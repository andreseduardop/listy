/**
 * @fileoverview Root model for app state persisted in localStorage.
 * @module core/model
 *
 * @description
 * Encapsula el **modelo raíz** de la aplicación. Lee y escribe en `localStorage`
 * bajo una única clave, garantiza la existencia del componente solicitado
 * y emite eventos `change` con `{ name, items }` tras cada mutación.
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 */

import modelTemplate from "./json/model.json" assert { type: "json" };

/**
 * Model of the root persisted state (scoped by component name).
 * @export
 */
export class Model extends EventTarget {
  /** @private {string} */
  static STORAGE_KEY = "app.model";

  constructor() {
    super();
    /** @private {!Object} */
    this._rootModel = this.#readRootModel(); // Comentario: carga el modelo raíz
  }

  /** @private */
  #deepClone(obj) {
    // Comentario: clona de forma segura objetos JSON
    return JSON.parse(JSON.stringify(obj));
  }

  /** @private */
  #readRootModel() {
    // Comentario: lee desde localStorage o cae a plantilla en caso de error
    try {
      const raw = localStorage.getItem(Model.STORAGE_KEY);
      return raw ? JSON.parse(raw) : this.#deepClone(modelTemplate);
    } catch {
      return this.#deepClone(modelTemplate);
    }
  }

  /** @private */
  #findComponentIndex(root, name) {
    // Comentario: obtiene índice del componente por nombre
    if (!root || !Array.isArray(root.components)) return -1;
    return root.components.findIndex((c) => c && c.name === name);
  }

  /** @private */
  #ensureComponent(root, componentName) {
    // Comentario: garantiza la existencia de `components[]` y del componente
    if (!componentName) throw new Error("[model] missing componentName");
    if (!root || typeof root !== "object") root = {};
    if (!Array.isArray(root.components)) root.components = [];

    let idx = this.#findComponentIndex(root, componentName);
    if (idx === -1) {
      root.components.push({
        name: componentName,
        title:
          componentName.charAt(0).toUpperCase() + componentName.slice(1),
        content: [],
      });
      idx = root.components.length - 1;
    }

    const comp = root.components[idx];
    if (!comp || typeof comp !== "object") {
      root.components[idx] = {
        name: componentName,
        title: componentName,
        content: [],
      };
    } else if (!Array.isArray(comp.content)) {
      comp.content = [];
    }

    return root;
  }

  /** @private */
  #writeModel(componentName, nextItems) {
    // Comentario: actualiza el modelo en memoria, persiste y emite evento
    try {
      this._rootModel = this.#ensureComponent(this._rootModel, componentName);
      const idx = this.#findComponentIndex(this._rootModel, componentName);
      this._rootModel.components[idx].content = nextItems.map((i) => ({ ...i }));

      localStorage.setItem(
        Model.STORAGE_KEY,
        JSON.stringify(this._rootModel),
      );

      this.dispatchEvent(
        new CustomEvent("change", {
          detail: { name: componentName, items: this.getAll(componentName) },
        }),
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[model] persist error", e); // Comentario: registra error de persistencia
    }
  }

  /**
   * Returns a defensive copy of all items for the requested component.
   * @param {string} componentName
   * @return {!Array<{id:string,text:string,completed:boolean}>}
   */
  getAll(componentName) {
    // Comentario: normaliza el modelo y devuelve copia de los items
    if (!componentName) throw new Error("[model] missing componentName");
    const normalized = this.#ensureComponent(this._rootModel, componentName);
    const idx = this.#findComponentIndex(normalized, componentName);
    const items = Array.isArray(normalized.components[idx].content)
      ? normalized.components[idx].content
      : [];
    return items.map((i) => ({ ...i }));
  }

  /**
   * Appends a new task with generated id.
   * @param {string} componentName
   * @param {string} text
   * @return {void}
   */
  add(componentName, text) {
    // Comentario: agrega item si el texto no está vacío
    const t = String(text || "").trim();
    if (!t) return;
    const items = this.getAll(componentName);
    items.push({ id: this.#uid(), text: t, completed: false });
    this.#writeModel(componentName, items);
  }

  /**
   * Toggles completion state by id.
   * @param {string} componentName
   * @param {string} id
   * @return {void}
   */
  toggle(componentName, id) {
    // Comentario: invierte el estado de completado del item
    const items = this.getAll(componentName).map((i) =>
      i.id === id ? { ...i, completed: !i.completed } : i,
    );
    this.#writeModel(componentName, items);
  }

  /**
   * Updates task text; removes the item if next text is empty.
   * @param {string} componentName
   * @param {string} id
   * @param {string} text
   * @return {void}
   */
  updateText(componentName, id, text) {
    // Comentario: actualiza texto o elimina si queda vacío
    const t = String(text || "").trim();
    if (!t) return this.remove(componentName, id);
    const items = this.getAll(componentName).map((i) =>
      i.id === id ? { ...i, text: t } : i,
    );
    this.#writeModel(componentName, items);
  }

  /**
   * Removes an item by id.
   * @param {string} componentName
   * @param {string} id
   * @return {void}
   */
  remove(componentName, id) {
    // Comentario: elimina el item filtrándolo por id
    const items = this.getAll(componentName).filter((i) => i.id !== id);
    this.#writeModel(componentName, items);
  }

  /**
   * Moves an item to the given target index (same list).
   * @param {string} componentName
   * @param {string} id
   * @param {number} toIndex
   * @return {void}
   */
  moveToIndex(componentName, id, toIndex) {
    // Comentario: reubica el item dentro del arreglo en el índice destino
    const items = this.getAll(componentName);
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

    this.#writeModel(componentName, arr);
  }

  /** @private */
  #uid() {
    // Comentario: genera id corto estable usando UUID si está disponible
    const s =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return s.slice(0, 12);
  }
}
