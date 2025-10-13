// ./utils/drag-and-drop.js
/**
 * Minimal, reusable drag-and-drop reorder helper (per UL)
 * - Keeps logic self-contained and DOM-driven
 * - No cross-list drops; solo reordena dentro de la misma lista
 * - Returns a disposer to unbind events
 *
 * @param {HTMLElement} ul - List root (<ul> or container) to bind
 * @param {{
 *   itemSelector?: string,     // CSS selector for list items
 *   ignoreSelector?: string,   // CSS selector para items que no se reordenan (ej. [data-role="new-entry"])
 *   beforeClass?: string,      // Clase para guía "antes"
 *   afterClass?: string,       // Clase para guía "después"
 *   draggingClass?: string,    // Clase visual mientras arrastra
 *   allowGlobalEdges?: boolean,// Permite soltar fuera del contenedor para ir a top/bottom
 *   onReorder: (draggedId: string, toIndex: number) => void
 * }} opts
 * @returns {{ destroy(): void }}
 */
export function attachListReorder(ul, opts = {}) {
  // English code; comentarios en español (tercera persona)
  const {
    itemSelector = "li.list-group-item[data-id]",
    ignoreSelector = "[data-role='new-entry']",
    beforeClass = "border-top",
    afterClass = "border-bottom",
    draggingClass = "opacity-50",
    allowGlobalEdges = true,
    onReorder,
  } = opts;

  // Valida callback requerido
  if (typeof onReorder !== "function") {
    throw new Error("attachListReorder: 'onReorder' callback is required.");
  }

  let draggingId = null;

  // Obtiene los items reales (excluye los que no se reordenan)
  const getRealItems = () =>
    Array.from(ul.querySelectorAll(itemSelector))
      .filter(li => !li.matches(ignoreSelector) && li.dataset.id);

  // Limpia marcas visuales
  const clearMarkers = () => {
    ul.querySelectorAll(`.${beforeClass}, .${afterClass}, .${draggingClass}`)
      .forEach(el => el.classList.remove(beforeClass, afterClass, draggingClass));
  };

  // Calcula índice de inserción dado un Y de puntero
  const indexFromPointerY = (clientY) => {
    const items = getRealItems();
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      const midY = r.top + r.height / 2;
      if (clientY < midY) return i;
    }
    return items.length;
  };

  // Pinta guía visual (antes/después) sobre un li en función del Y
  const paintGuide = (li, clientY) => {
    const r = li.getBoundingClientRect();
    const before = clientY - r.top < r.height / 2;
    li.classList.add(before ? beforeClass : afterClass);
  };

  // Handlers
  const onDragStart = (e) => {
    const li = e.target.closest(itemSelector);
    if (!li?.dataset?.id || li.matches(ignoreSelector)) return;
    draggingId = li.dataset.id;
    li.classList.add(draggingClass);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggingId); // habilita DnD en Firefox
  };

  const onDragOver = (e) => {
    if (!draggingId) return;
    e.preventDefault(); // permite drop
    clearMarkers();
    const li = e.target.closest(itemSelector);
    if (li && !li.matches(ignoreSelector)) paintGuide(li, e.clientY);
  };

  const onDragLeave = () => {
    // Limpia marcas cuando el puntero sale del UL
    clearMarkers();
  };

  const onDrop = (e) => {
    if (!draggingId) return;
    e.preventDefault();
    const toIndex = indexFromPointerY(e.clientY);
    onReorder(draggingId, toIndex);
    clearMarkers();
    draggingId = null;
  };

  const onDragEnd = () => {
    // Restablece estado visual al finalizar
    clearMarkers();
    draggingId = null;
  };

  // Registra listeners en el UL
  ul.addEventListener("dragstart", onDragStart);
  ul.addEventListener("dragover", onDragOver);
  ul.addEventListener("dragleave", onDragLeave);
  ul.addEventListener("drop", onDrop);
  ul.addEventListener("dragend", onDragEnd);

  // Soporte de “bordes globales” (drop arriba/abajo cuando sale del contenedor)
  const onDocDragOver = allowGlobalEdges
    ? (e) => { e.preventDefault(); /* comentario: permite drop global */ }
    : null;

  const onDocDrop = allowGlobalEdges
    ? (e) => {
        if (!draggingId) return;
        const rect = ul.getBoundingClientRect();

        // Soltar por encima del UL -> índice 0
        if (e.clientY < rect.top) {
          e.preventDefault();
          onReorder(draggingId, 0);
          clearMarkers();
          draggingId = null;
          return;
        }

        // Soltar por debajo del UL -> índice length
        if (e.clientY > rect.bottom) {
          e.preventDefault();
          onReorder(draggingId, getRealItems().length);
          clearMarkers();
          draggingId = null;
        }
      }
    : null;

  if (onDocDragOver) document.addEventListener("dragover", onDocDragOver);
  if (onDocDrop) document.addEventListener("drop", onDocDrop);

  // Devuelve interfaz explícita de limpieza
  return {
    destroy() {
      // Elimina listeners del UL
      ul.removeEventListener("dragstart", onDragStart);
      ul.removeEventListener("dragover", onDragOver);
      ul.removeEventListener("dragleave", onDragLeave);
      ul.removeEventListener("drop", onDrop);
      ul.removeEventListener("dragend", onDragEnd);
      // Elimina listeners globales
      if (onDocDragOver) document.removeEventListener("dragover", onDocDragOver);
      if (onDocDrop) document.removeEventListener("drop", onDocDrop);
    }
  };
}
