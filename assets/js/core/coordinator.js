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

import { renderChecklist } from "../components/checklist.js"; // importa el inicializador de checklist
import { renderResourceslist } from "../components/resourceslist.js"; // importa el inicializador de resourceslist
import { renderStepslist } from "../components/stepslist.js"; // importa el inicializador de stepslist

/** @const {string} */
const CONTAINER_1 = "app-container-1";
/** @const {string} */
const CONTAINER_2 = "app-container-2"; 

/**
 * Starts all configured UI components.
 * @return {void}
 */
export function startApp() {
  // obtiene el contenedor principal 1
  const container1 = document.getElementById(CONTAINER_1);

  // obtiene el contenedor 2 pero NO lo altera (se reserva para futuro uso)
  const container2 = document.getElementById(CONTAINER_2);
  // void container2; // evita advertencias por variable no usada

  // valida existencia del contenedor 1
  if (!container1) {
    // eslint-disable-next-line no-console
    console.error(`[coordinator] container #${CONTAINER_1} not found.\nIS TESTER PAGE?`);
    return;
  }

  // asegura que los subcontenedores existan una única vez
  let subcontainer1 = document.querySelector("#subcontainer-1");
  let subcontainer2 = document.querySelector("#subcontainer-2");
  let subcontainer3 = document.querySelector("#subcontainer-3");

  // crea subcontenedores si aún no existen
  if (!subcontainer1) {
    subcontainer1 = document.createElement("div");
    subcontainer1.id = "subcontainer-1"; // asigna ID consecutivo 1
    container1.appendChild(subcontainer1);
  }
  if (!subcontainer2) {
    subcontainer2 = document.createElement("div");
    subcontainer2.id = "subcontainer-2"; // asigna ID consecutivo 2
    container1.appendChild(subcontainer2);
  }
  if (!subcontainer3) {
    subcontainer3 = document.createElement("div");
    subcontainer3.id = "subcontainer-3"; // asigna ID consecutivo 3
    container2.appendChild(subcontainer3);
  }

  // monta cada componente en su propio subcontenedor bajo contenedor 1
  renderChecklist(subcontainer1); // renderiza checklist en subcontainer-1
  renderResourceslist(subcontainer2); // renderiza resourceslist en subcontainer-1
  renderStepslist(subcontainer3); // renderiza stepslist en subcontainer-2

  // no se realiza ninguna operación sobre #app-container-2 para mantenerlo disponible
}
