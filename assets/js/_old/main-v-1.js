// Simple MVC checklist (vanilla JS + Bootstrap 5.3 classes)
// NOTE: Code in English, comentarios en español.

// -------------------------------
// Model
// -------------------------------
class ChecklistModel extends EventTarget {
  // Clave de almacenamiento en localStorage
  static STORAGE_KEY = "checklist-mvc-v1";

  constructor() {
    super();
    // Carga inicial desde localStorage
    this.items = this.#read();
  }

  // Lee JSON desde localStorage (o inicia arreglo vacío)
  #read() {
    try {
      const raw = localStorage.getItem(ChecklistModel.STORAGE_KEY);
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // Escribe JSON en localStorage y emite evento de cambio
  #write() {
    localStorage.setItem(ChecklistModel.STORAGE_KEY, JSON.stringify(this.items));
    this.dispatchEvent(new CustomEvent("change", { detail: { items: this.items } }));
  }

  // Genera un id único para cada tarea
  #uid() {
    // Usa crypto.randomUUID si existe; si no, fallback
    return (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  // Devuelve copia inmutable del estado
  getAll() {
    return this.items.map(i => ({ ...i }));
  }

  // Agrega una nueva tarea al final
  add(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    this.items.push({ id: this.#uid(), text: trimmed, completed: false });
    this.#write();
  }

  // Cambia el estado de completado de una tarea
  toggle(id) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx], completed: !this.items[idx].completed };
    this.#write();
  }

  // Actualiza el texto de una tarea
  updateText(id, nextText) {
    const text = String(nextText || "").trim();
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1 || !text) return;
    this.items[idx] = { ...this.items[idx], text };
    this.#write();
  }

  // Mueve una tarea por desplazamiento (offset), con wrap-around
  moveBy(id, offset = 1) {
    const len = this.items.length;
    if (len <= 1) return;
    const from = this.items.findIndex(i => i.id === id);
    if (from === -1) return;
    // Calcula índice destino con wrap
    let to = (from + offset) % len;
    if (to < 0) to = len + to;
    if (to === from) return;

    // Reordena de forma simple
    const clone = [...this.items];
    const [moved] = clone.splice(from, 1);
    clone.splice(to, 0, moved);
    this.items = clone;
    this.#write();
  }
}

// -------------------------------
// View
// -------------------------------
class ChecklistView {
  constructor(root) {
    // root: contenedor principal (ej. #list-container-1)
    this.root = root;
    this.list = root.querySelector(".app-checklist");
    // Plantillas de item y de "nuevo"
    // (Se generan dinámicamente para mantener los ids únicos accesibles)
  }

  // Render principal: reemplaza el contenido de la lista
  render(items) {
    // Limpia la UL
    this.list.innerHTML = "";

    // Render de cada tarea existente
    const frag = document.createDocumentFragment();
    items.forEach((item, index) => {
      frag.appendChild(this.#renderItem(item, index));
    });

    // Render de la fila para añadir nueva tarea
    frag.appendChild(this.#renderNewItemEntry());

    this.list.appendChild(frag);
  }

  // Crea un <li> para una tarea
  #renderItem(item, index) {
    const li = document.createElement("li");
    li.className = "list-group-item p-1 d-flex flex-wrap align-items-center";
    li.dataset.id = item.id;
    li.setAttribute("draggable", "true"); // Nota: Reordenamiento por botón, no DnD

    const checkId = `check-${index + 1}`;

    // Botón mover
    const btnMove = document.createElement("button");
    btnMove.type = "button";
    btnMove.className = "btn app-btn-move";
    btnMove.innerHTML = `<i class="bi bi-arrow-down-up" aria-hidden="true"></i>`;
    btnMove.title = "Move (Shift+Click: up, Click: down)"; // Sugerencia de uso

    // Form-check (checkbox + label)
    const form = document.createElement("div");
    form.className = "form-check position-relative flex-grow-1";

    const input = document.createElement("input");
    input.className = "form-check-input";
    input.type = "checkbox";
    input.id = checkId;
    input.checked = !!item.completed;

    const label = document.createElement("label");
    label.className = "form-check-label stretched-link";
    label.htmlFor = checkId;
    label.textContent = item.text;

    form.appendChild(input);
    form.appendChild(label);

    // Botón editar
    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btn app-btn-edit";
    btnEdit.innerHTML = `<i class="bi bi-pencil-fill" aria-hidden="true"></i>`;
    btnEdit.title = "Edit";

    li.appendChild(btnMove);
    li.appendChild(form);
    li.appendChild(btnEdit);

    return li;
  }

  // Crea el <li> de entrada para nuevas tareas (al final)
  #renderNewItemEntry() {
    const li = document.createElement("li");
    li.className = "list-group-item p-2 d-flex gap-2 align-items-center bg-body-tertiary";
    li.dataset.role = "new-entry";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.placeholder = "Add new task and press Enter";
    input.setAttribute("aria-label", "Add new task");

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-outline-primary app-btn-add";
    addBtn.innerHTML = `<i class="bi bi-square-fill" aria-hidden="true"></i>`;    
    addBtn.title = "Ok";

    li.appendChild(input);
    li.appendChild(addBtn);

    return li;
  }

  // -------- Delegación de eventos de la vista --------

  // Maneja el click en botón mover
  onMove(handler) {
    // handler(id, directionOffset)
    this.list.addEventListener("click", (e) => {
      const btn = e.target.closest(".app-btn-move");
      if (!btn) return;
      const li = btn.closest("li.list-group-item");
      if (!li || !li.dataset.id) return;
      // Shift+Click: movimiento hacia arriba; Click normal: hacia abajo
      const offset = e.shiftKey ? -1 : 1;
      handler(li.dataset.id, offset);
    });
  }

  // Maneja el cambio de checkbox (toggle completed)
  onToggle(handler) {
    // handler(id)
    this.list.addEventListener("change", (e) => {
      const input = e.target.closest(".form-check-input");
      if (!input) return;
      const li = input.closest("li.list-group-item");
      if (!li || !li.dataset.id) return;
      handler(li.dataset.id);
    });
  }

  // Maneja la edición del texto (click en botón editar → inline editor)
  onEdit(handler) {
    // handler(id, nextText)
    this.list.addEventListener("click", (e) => {
      const btn = e.target.closest(".app-btn-edit");
      if (!btn) return;
      const li = btn.closest("li.list-group-item");
      if (!li || !li.dataset.id) return;

      // Sustituye el label por un input temporal
      const form = li.querySelector(".form-check");
      const label = form.querySelector("label");
      const currentText = label.textContent.trim();

      // Evita múltiples editores simultáneos en el mismo ítem
      if (form.querySelector("input[type='text']")) return;

      // Crea input de edición
      const editor = document.createElement("input");
      editor.type = "text";
      editor.className = "form-control";
      editor.value = currentText;
      editor.setAttribute("aria-label", "Edit task text");

      // Oculta label mientras se edita
      label.style.display = "none";
      form.appendChild(editor);
      editor.focus();
      editor.select();

      // Guardar con Enter, cancelar con Escape, o guardar con blur
      const commit = () => {
        const next = editor.value.trim();
        form.removeChild(editor);
        label.style.display = "";
        if (next && next !== currentText) {
          handler(li.dataset.id, next);
        }
      };
      const cancel = () => {
        form.removeChild(editor);
        label.style.display = "";
      };

      editor.addEventListener("keydown", (ke) => {
        if (ke.key === "Enter") commit();
        if (ke.key === "Escape") cancel();
      });
      editor.addEventListener("blur", commit);
    });
  }

  // Maneja la creación de nuevas tareas (Enter o botón Add)
  onCreate(handler) {
    // handler(text)
    this.list.addEventListener("keydown", (e) => {
      const entry = e.target.closest("li[data-role='new-entry']");
      if (!entry) return;
      if (e.key !== "Enter") return;
      const input = entry.querySelector("input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
      input.value = "";
      // Opcional: devuelve el foco al input para flujo rápido
      input.focus();
    });

    this.list.addEventListener("click", (e) => {
      const entry = e.target.closest("li[data-role='new-entry']");
      if (!entry) return;
      const btn = e.target.closest("button.app-btn-add");
      if (!btn) return;
      const input = entry.querySelector("input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
      input.value = "";
      input.focus();
    });
  }
}

// -------------------------------
// Controller
// -------------------------------
class ChecklistController {
  constructor({ root }) {
    // root: elemento contenedor (e.g., document.getElementById('list-container-1'))
    this.model = new ChecklistModel();
    this.view = new ChecklistView(root);

    // Render inicial
    this.view.render(this.model.getAll());

    // Suscripción a cambios del modelo
    this.model.addEventListener("change", () => {
      this.view.render(this.model.getAll());
    });

    // Conecta eventos de la vista a acciones del modelo
    this.view.onMove((id, offset) => this.model.moveBy(id, offset));
    this.view.onToggle((id) => this.model.toggle(id));
    this.view.onEdit((id, text) => this.model.updateText(id, text));
    this.view.onCreate((text) => this.model.add(text));
  }
}

// -------------------------------
// Boot
// -------------------------------
// Inicializa el controlador usando el contenedor dado por el HTML de la consigna.
// Asegúrate de ejecutar esto después de que el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("list-container-1");
  if (!container) return;
  new ChecklistController({ root: container });
});
