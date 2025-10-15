/**
 * @fileoverview Low-level storage module for the root JSON model in localStorage.
 * @module core/storage
 *
 * @description
 * Exclusively creates, stores, and retrieves the root JSON model in `localStorage`.
 * It also handles reads/writes for each component at `components.<name>.content`.
 *
 * @version 2.0.0
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 */

import modelTemplate from "./json/model.json" assert { type: "json" };

/** @const {string} */
export const STORAGE_KEY = "app.model.2";

/** @private */
function deepClone(obj) {
  // Comentario: clona profundamente un objeto JSON de forma segura
  return JSON.parse(JSON.stringify(obj));
}

/** @private */
function readRoot() {
  // Comentario: lee el modelo raíz desde localStorage o cae a la plantilla
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : deepClone(modelTemplate);
  } catch {
    return deepClone(modelTemplate);
  }
}

/** @private */
function writeRoot(root) {
  // Comentario: escribe el modelo raíz en localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
}

/** @private */
function findComponentIndex(root, name) {
  // Comentario: busca índice del componente por nombre
  if (!root || !Array.isArray(root.components)) return -1;
  return root.components.findIndex((c) => c && c.name === name);
}

/** @private */
function ensureComponent(root, componentName) {
  // Comentario: garantiza existencia de `components[]` y el componente pedido
  if (!componentName) throw new Error("[storage] missing componentName");
  if (!root || typeof root !== "object") root = {};
  if (!Array.isArray(root.components)) root.components = [];

  let idx = findComponentIndex(root, componentName);
  if (idx === -1) {
    root.components.push({
      name: componentName,
      title: componentName.charAt(0).toUpperCase() + componentName.slice(1),
      content: [],
    });
    idx = root.components.length - 1;
  }

  const comp = root.components[idx];
  if (!comp || typeof comp !== "object") {
    root.components[idx] = { name: componentName, title: componentName, content: [] };
  } else if (!("content" in comp) || comp.content == null) {
    // Comentario: normaliza 'content' con arreglo por defecto
    comp.content = [];
  }
  return root;
}

/**
 * Returns a defensive copy of the entire root model JSON.
 * @return {!Object}
 */
export function getModel() {
  // Comentario: devuelve copia defensiva del modelo raíz completo
  return deepClone(readRoot());
}

/**
 * Overwrites the entire root model in storage.
 * @param {!Object} next
 * @return {void}
 */
export function setModel(next) {
  // Comentario: escribe el modelo raíz completo
  if (!next || typeof next !== "object") {
    throw new Error("[storage] invalid model object");
  }
  writeRoot(deepClone(next));
}

/**
 * Returns the `content` for a given component name.
 * @param {string} componentName
 * @return {*}
 */
export function getComponentContent(componentName) {
  // Comentario: lee y devuelve `components.<name>.content`
  if (!componentName) throw new Error("[storage] missing componentName");
  const root = ensureComponent(readRoot(), componentName);
  const idx = findComponentIndex(root, componentName);
  const content = root.components[idx].content;
  return deepClone(content);
}

/**
 * Replaces the `content` for a given component name.
 * @param {string} componentName
 * @param {*} content
 * @return {void}
 */
export function setComponentContent(componentName, content) {
  // Comentario: actualiza `components.<name>.content` y persiste en localStorage
  const root = ensureComponent(readRoot(), componentName);
  const idx = findComponentIndex(root, componentName);
  root.components[idx].content = deepClone(content);
  writeRoot(root);
}
