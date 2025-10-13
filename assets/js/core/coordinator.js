/**
 * @fileoverview App-level coordinator that selects and initializes UI components.
 * @module core/coordinator
 *
 * @description
 * Centraliza la selección de componentes y su inicialización en la interfaz.
 * Por ahora, sólo inicializa la checklist en el contenedor "#app-container-1".
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 */

import { renderChecklist } from "../components/checklist.js"; // Comentario: importa el inicializador de checklist

/** @const {string} */
const CHECKLIST_CONTAINER_ID = "app-container-1";

/**
 * Starts all configured UI components.
 * @return {void}
 */
export function startApp() {
  // Comentario: obtiene el contenedor de checklist
  const container1 = document.getElementById(CHECKLIST_CONTAINER_ID);

  // Comentario: valida existencia del contenedor
  if (!container1) {
    // eslint-disable-next-line no-console
    console.error(
      `[coordinator] container #${CHECKLIST_CONTAINER_ID} not found`,
    );
    return;
  }

  // Comentario: inicializa la checklist dentro del contenedor
  renderChecklist(container1);
}
