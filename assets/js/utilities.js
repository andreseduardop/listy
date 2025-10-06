/*
 * Activate horizontal scrolling in elements with class:
 * .overflow-x-scroll.sc-scroll-enable
 * usually the carousels (in the Planner and in the Tips)
 */
function horizontalScrollEnabler() {
  const horizontallyScrollableElements = document.querySelectorAll(".overflow-x-scroll.sc-scroll-enable");
  horizontallyScrollableElements.forEach( (element) => {
    element.addEventListener("wheel", (evt) => {
        evt.preventDefault();
        element.scrollLeft += evt.deltaY;
    }, {passive: false});
  })
}

function generalFunctions() {
  horizontalScrollEnabler();
};
// Ejecutar script luego de cargar el DOM
if (document.readyState === 'loading') {  // Loading hasn't finished yet
  document.addEventListener('DOMContentLoaded', generalFunctions);
} else {  // `DOMContentLoaded` has already fired
  generalFunctions();
};
