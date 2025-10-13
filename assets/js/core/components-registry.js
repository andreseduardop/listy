// components-registry.js
// Comentario: expone un registro simple de componentes { name, mount, unmount }.

import { checklist, COMPONENT_NAME as CHECKLIST_NAME } from "../components/checklist.js"; 
// Comentario: importa el componente 'checklist' desde la carpeta de componentes

// Comentario: define el mapa de componentes disponibles en la app
export const ComponentsRegistry = {
  [CHECKLIST_NAME]: checklist,
};

// Comentario: expone la lista de nombres por conveniencia en navegación/diagnóstico
export const AVAILABLE_COMPONENTS = Object.keys(ComponentsRegistry);
