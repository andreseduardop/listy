// coordinator.js
// Comentario: coordina el ciclo de vida de los componentes (mount/unmount) y asegura el modelo.

import { AppModel } from "./model.js";
import { ComponentsRegistry } from "./components-registry.js";

export class AppCoordinator {
  // Comentario: guarda referencia al contenedor raíz y al componente activo
  constructor({ rootSelector = "#app" } = {}) {
    this.root = document.querySelector(rootSelector);
    if (!this.root) throw new Error(`Root container not found: ${rootSelector}`);
    this._active = null; // { name, api, element }
  }

  // Comentario: inicializa el modelo y monta el componente por defecto
  async init({ defaultComponent }) {
    await AppModel.ensureReady();
    const initial = defaultComponent || Object.keys(ComponentsRegistry)[0];
    await this.mount(initial);
  }

  // Comentario: desmonta el componente activo si existe
  async unmountActive() {
    if (!this._active) return;
    try {
      this._active.api.unmount?.(this._active.element);
    } finally {
      this.root.innerHTML = "";
      this._active = null;
    }
  }

  // Comentario: monta un componente por su name usando el registro
  async mount(name) {
    const api = ComponentsRegistry[name];
    if (!api) throw new Error(`Component '${name}' not found in registry`);
    await this.unmountActive();

    const section = document.createElement("div");
    section.setAttribute("data-component", name);
    this.root.appendChild(section);

    await AppModel.ensureReady();
    await api.mount(section);

    this._active = { name, api, element: section };
  }

  // Comentario: navegación entre componentes
  async navigateTo(name) {
    if (this._active?.name === name) return;
    await this.mount(name);
  }

  // Comentario: devuelve el nombre del componente activo
  get activeComponentName() {
    return this._active?.name || null;
  }
}
