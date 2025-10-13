/**
 * @fileoverview App-level coordinator that selects and initializes UI components.
 * @module core/coordinator
 * @version 1.3.0
 *
 * @description
 * Centralizes component selection and initialization in the UI.
 * Renders both components inside "#app-container-1" using dedicated subcontainers.
 * Keeps "#app-container-2" available for future use without modifying it.
 *
 * Code style: follows the Google JavaScript Style Guide.
 * https://google.github.io/styleguide/jsguide.html
 */

import { renderResourceslist } from "../components/resourceslist.js"; // Comentario: importa el inicializador de resourceslist
import { renderChecklist } from "../components/checklist.js"; // Comentario: importa el inicializador de checklist

/** @const {string} */
const CONTAINER_1 = "app-container-1";
/** @const {string} */
const CONTAINER_2 = "app-container-2"; // Comentario: se declara para mantener referencia, pero no se utiliza

/**
 * Starts all configured UI components.
 * @return {void}
 */
export function startApp() {
  // Comentario: obtiene el contenedor principal 1
  const container1 = document.getElementById(CONTAINER_1);

  // Comentario: obtiene el contenedor 2 pero NO lo altera (se reserva para futuro uso)
  const container2 = document.getElementById(CONTAINER_2);
  void container2; // Comentario: evita advertencias por variable no usada

  // Comentario: valida existencia del contenedor 1
  if (!container1) {
    // eslint-disable-next-line no-console
    console.error(`[coordinator] container #${CONTAINER_1} not found.\nIS TESTER PAGE?`);
    return;
  }

  // Comentario: asegura que los subcontenedores existan una única vez
  let subcontainer1 = container1.querySelector("#subcontainer-1");
  let subcontainer2 = container1.querySelector("#subcontainer-2");

  // Comentario: crea subcontenedores si aún no existen
  if (!subcontainer1) {
    subcontainer1 = document.createElement("div");
    subcontainer1.id = "subcontainer-1"; // Comentario: asigna ID consecutivo 1
    container1.appendChild(subcontainer1);
  }
  if (!subcontainer2) {
    subcontainer2 = document.createElement("div");
    subcontainer2.id = "subcontainer-2"; // Comentario: asigna ID consecutivo 2
    container1.appendChild(subcontainer2);
  }

  // Comentario: monta cada componente en su propio subcontenedor bajo contenedor 1
  renderChecklist(subcontainer1);       // Comentario: renderiza checklist en subcontainer-1
  renderResourceslist(subcontainer2);   // Comentario: renderiza resourceslist en subcontainer-2

  // Comentario: no se realiza ninguna operación sobre #app-container-2 para mantenerlo disponible
}
