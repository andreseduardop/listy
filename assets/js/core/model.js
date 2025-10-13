// model.js
// NOTE: Code in English; comments in Spanish (tercera persona).

import { getItem, setItem } from "../utils/storage.js";
import { uuidv4 } from "../utils/id.js";

const STORAGE_KEYS = {
  plansIndex: "app:plans",                 // lista de { id, title, date }
  activePlanId: "app:activePlanId",        // sessionStorage
  planById: (id) => `app:plan:${id}`,      // JSON completo del plan
};

const JSON_TEMPLATE_URL = "/assets/js/core/json/model.json"; // ruta canónica (§13). :contentReference[oaicite:2]{index=2}

/**
 * Busca el índice del componente por su name dentro de plan.components (array del esquema).
 * @param {Object} plan
 * @param {string} name
 * @returns {number} index or -1
 */
// Comentario: calcula el índice del componente con name == {name}
function findComponentIndex(plan, name) {
  if (!plan || !Array.isArray(plan.components)) return -1;
  return plan.components.findIndex((c) => c.name === name);
}

/**
 * Crea un plan a partir del template /core/json/model.json y lo marca activo.
 * Asigna uuid a 'id' y 'activo' a 'state' (requisito del usuario).
 */
// Comentario: crea el primer plan desde la plantilla y lo persiste como activo
async function createFirstPlanFromTemplate() {
  const res = await fetch(JSON_TEMPLATE_URL);
  const template = await res.json(); // esquema base del plan. :contentReference[oaicite:3]{index=3}

  const newPlan = {
    ...template,
    id: uuidv4(),                       // asigna uuid requerido
    state: "activo",                    // marca como plan activo
    date: new Date().toISOString(),     // fecha de creación
    title: template.title || "New Plan" // conserva o asigna título
  };

  // Comentario: persiste el plan y actualiza el índice
  const plans = getItem(localStorage, STORAGE_KEYS.plansIndex, []);
  const newIndex = [
    ...plans,
    { id: newPlan.id, title: newPlan.title, date: newPlan.date }
  ];
  setItem(localStorage, STORAGE_KEYS.plansIndex, newIndex);
  setItem(localStorage, STORAGE_KEYS.planById(newPlan.id), newPlan);

  // Comentario: almacena el plan activo en sessionStorage
  sessionStorage.setItem(STORAGE_KEYS.activePlanId, newPlan.id);

  return newPlan;
}

class Model {
  // Comentario: implementa patrón Singleton
  static _instance = null;
  static get instance() {
    if (!Model._instance) Model._instance = new Model();
    return Model._instance;
  }

  constructor() {
    // Comentario: evita construcción múltiple
    if (Model._instance) return Model._instance;
    this._plan = null; // plan activo en memoria
  }

  /**
   * Inicializa el modelo. Si no existe plan activo, crea uno desde la plantilla.
   * Devuelve el plan activo en memoria.
   */
  // Comentario: asegura que exista un plan activo según la arquitectura (§6) 
  async ensureReady() {
    let activeId = sessionStorage.getItem(STORAGE_KEYS.activePlanId);

    if (!activeId) {
      this._plan = await createFirstPlanFromTemplate(); // primera llamada crea/almacena JSON
      return this._plan;
    }

    const loaded = getItem(localStorage, STORAGE_KEYS.planById(activeId), null);
    if (!loaded) {
      // Comentario: si la referencia existía pero el plan no, crea uno nuevo
      this._plan = await createFirstPlanFromTemplate();
      return this._plan;
    }

    this._plan = loaded;
    return this._plan;
  }

  /**
   * Lee el contenido de un componente por su {name}.
   * Solo devuelve components.{name}.content (nunca todo el JSON).
   */
  // Comentario: retorna exclusivamente la sección de datos del componente solicitante
  readComponent(name) {
    if (!this._plan) throw new Error("Model not initialized");
    const idx = findComponentIndex(this._plan, name);
    if (idx === -1) return undefined;
    return this._plan.components[idx].content;
  }

  /**
   * Escribe contenido EXACTAMENTE como lo envía el controlador del componente.
   * No modifica los datos; solo los guarda en components.{name}.content.
   * Emites 'model:change' con path 'components.{name}.content'.
   */
  // Comentario: guarda sin transformar la información que envía el controlador
  writeComponent(name, data) {
    if (!this._plan) throw new Error("Model not initialized");

    const idx = findComponentIndex(this._plan, name);
    if (idx === -1) {
      // Comentario: si no existe el componente en el esquema, no lo crea
      throw new Error(`Component '${name}' not found in model schema`);
    }

    // Comentario: asigna content directamente, sin mutaciones adicionales
    this._plan.components[idx].content = data;

    // Comentario: persiste el plan completo bajo la clave app:plan:{id}
    setItem(localStorage, STORAGE_KEYS.planById(this._plan.id), this._plan);

    // Comentario: emite evento de cambio acotado al namespace del componente
    const detail = {
      path: `components.${name}.content`,
      changes: data,
      planId: this._plan.id
    };
    window.dispatchEvent(new CustomEvent("model:change", { detail }));
  }

  /**
   * Devuelve el id del plan activo.
   */
  // Comentario: expone el id del plan activo para diagnósticos y uso de UI
  getActivePlanId() {
    return this._plan?.id || null;
  }
}

export const AppModel = Model.instance;
