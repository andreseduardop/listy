// checklist component with drag & drop reordering
// NOTE: Code in English, comentarios en español (tercera persona).

/* ================================
 * Utilities
 * ================================ */
// Crea elemento con clases, atributos y contenido opcional
function el(tag, { className = "", attrs = {}, html = "" } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
}

// Atajos de consulta
const qs  = (root, sel) => root.querySelector(sel);
const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));

/* ================================
 * Model
 * ================================ */
class ChecklistModel extends EventTarget {
  // Clave de almacenamiento
  static STORAGE_KEY = "checklist-mvc";

  constructor() {
    super();
    // Carga estado inicial
    this.items = this.#read();
  }

  // Lee JSON desde localStorage
  #read() {
    try {
      const raw = localStorage.getItem(ChecklistModel.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Escribe JSON y emite evento de cambio
  #write() {
    try {
      localStorage.setItem(ChecklistModel.STORAGE_KEY, JSON.stringify(this.items));
      this.dispatchEvent(new CustomEvent("change", { detail: { items: this.getAll() } }));
    } catch (err) {
      console.error("Persist error:", err); // registra el error
    }
  }

  // Genera id único
  #uid() {
    const uuid = (typeof crypto?.randomUUID === "function")
      ? crypto.randomUUID().replace(/-/g, "")
      : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return uuid.slice(0, 12); // compacta
  }

  // Devuelve copia inmutable
  getAll() {
    return this.items.map(i => ({ ...i }));
  }

  // Agrega tarea
  add(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    this.items = [...this.items, { id: this.#uid(), text: trimmed, completed: false }];
    this.#write();
  }

  // Cambia estado completado
  toggle(id) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = this.items[idx];
    this.items = [
      ...this.items.slice(0, idx),
      { ...item, completed: !item.completed },
      ...this.items.slice(idx + 1),
    ];
    this.#write();
  }

  // Actualiza texto
  updateText(id, nextText) {
    const text = String(nextText || "").trim();
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1 || !text) return;
    const item = this.items[idx];
    this.items = [
      ...this.items.slice(0, idx),
      { ...item, text },
      ...this.items.slice(idx + 1),
    ];
    this.#write();
  }

  // Elimina tarea
  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.#write();
  }

  // Mueve a índice destino
  moveToIndex(id, toIndex) {
    const len = this.items.length;
    if (len <= 1) return;
    const from = this.items.findIndex(i => i.id === id);
    if (from === -1) return;

    let dest = Math.max(0, Math.min(len, Number(toIndex)));
    if (dest === from || dest === from + 1) return;

    const clone = [...this.items];
    const [moved] = clone.splice(from, 1);
    if (dest > from) dest -= 1;
    clone.splice(dest, 0, moved);

    this.items = clone;
    this.#write();
  }
}

/* ================================
 * View
 * ================================ */
class ChecklistView {
  // Selectores del nuevo layout (sin botón Edit; label clicable)
  static SEL = {
    pendingPane: "#checklist-pending-tab-pane .app-checklist",
    completedPane: "#checklist-completed-tab-pane .app-checklist",
    item: "li.list-group-item",
    newEntry: "li[data-role='new-entry']",
    newEntryInput: "li[data-role='new-entry'] input[type='text']",
    checkbox: "input.form-check-input",
    label: "label.form-check-label",
    btnAdd: "button.app-btn-add",
  };

  constructor(root) {
    // root: contenedor del checklist
    this.root = root;
    this.pendingList = qs(root, ChecklistView.SEL.pendingPane);
    this.completedList = qs(root, ChecklistView.SEL.completedPane);
    if (!this.pendingList || !this.completedList) {
      throw new Error("Missing .app-checklist in one or both tab panes.");
    }

    // Estado DnD por lista
    this.dnd = {
      pending: { draggingId: null, overId: null, overPos: null },
      completed: { draggingId: null, overId: null, overPos: null },
    };
  }

  // Render principal
  render(items) {
    const pending = items.filter(i => !i.completed);
    const completed = items.filter(i => i.completed);

    this.pendingList.innerHTML = "";
    this.completedList.innerHTML = "";

    this.#renderList(this.pendingList, pending, { withNewEntry: true });
    this.#renderList(this.completedList, completed, { withNewEntry: false });
  }

  // Renderiza lista
  #renderList(ul, data, { withNewEntry }) {
    const frag = document.createDocumentFragment();
    data.forEach((item, index) => frag.appendChild(this.#renderItem(item, index)));
    if (withNewEntry) frag.appendChild(this.#renderNewItemEntry());
    ul.appendChild(frag);
  }

  // Crea <li> según layout actualizado (sin atributo 'for' en label)
  #renderItem(item) {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
      attrs: { draggable: "true" },
    });
    li.dataset.id = item.id;

    // Botón de mover (conserva el layout)
    const btnMove = el("button", {
      className: "btn app-btn-move",
      attrs: { type: "button", "aria-label": "Move", title: "Move" },
      html: `<i class="bi bi-arrow-down-up"></i>`,
    });

    // Bloque form-check
    const form = el("div", { className: "form-check position-relative d-flex align-items-top flex-grow-1" });

    // Input checkbox (toggle solo al hacer clic en el input)
    const input = el("input", {
      className: "form-check-input",
      attrs: { type: "checkbox", id: `checklist-check-${item.id}` },
    });
    input.checked = !!item.completed;

    // Label sin 'for' y con flex-grow-1 (clic → modo edición)
    const label = el("label", {
      className: "form-check-label flex-grow-1",
    });
    label.textContent = item.text;

    form.appendChild(input);
    form.appendChild(label);

    // Orden final: [btnMove] [form-check]
    li.append(btnMove, form);
    return li;
  }

  // <li> de nueva entrada
  #renderNewItemEntry() {
    const li = el("li", {
      className: "list-group-item p-2 d-flex gap-2 align-items-start",
    });
    li.dataset.role = "new-entry";
    li.draggable = false;

    const input = el("input", {
      className: "form-control",
      attrs: { type: "text", placeholder: "Add new task and press Enter", "aria-label": "Add new task" },
    });

    const btnAdd = el("button", {
      className: "btn app-btn-add",
      attrs: { type: "button", title: "Add new task", "aria-label": "Add new task" },
      html: `<i class="bi bi-plus-square-fill fs-3" aria-hidden="true"></i>`,
    });

    li.append(input, btnAdd);
    return li;
  }

  /* -------- Delegación de eventos -------- */

  // Toggle completado: escucha 'change' SOLO en el input
  onToggle(handler) {
    const listen = (ul) => {
      ul.addEventListener("change", (e) => {
        const input = e.target.closest(ChecklistView.SEL.checkbox);
        if (!input) return;

        const li = input.closest(ChecklistView.SEL.item);
        if (!li?.dataset.id) return;

        const goingCompleted = input.checked === true;

        // Acción de dominio
        handler(li.dataset.id);

        // Flash visual de pestaña destino
        const targetTabId = goingCompleted ? "checklist-completed-tab" : "checklist-pending-tab";
        const targetEl = document.getElementById(targetTabId);
        if (targetEl) flashCompletedTab(targetEl);
      });
    };

    listen(this.pendingList);
    listen(this.completedList);
  }

// Edición inline: clic en label abre editor con <textarea> auto-resize (sin saltos de línea)
onEdit(handler) {
  const listen = (ul) => {
    ul.addEventListener("click", (e) => {
      const label = e.target.closest(ChecklistView.SEL.label);
      if (!label) return;

      const li = label.closest(ChecklistView.SEL.item);
      if (!li?.dataset.id) return;

      const form = label.closest(".form-check");
      const currentText = label.textContent.trim();

      // Evita múltiples editores en el mismo ítem
      if (form.querySelector("textarea[data-role='inline-editor']")) return;

      // Crea textarea editor
      const editor = document.createElement("textarea");
      editor.className = "form-control";
      editor.setAttribute("data-role", "inline-editor");
      editor.setAttribute("aria-label", "Edit task text");
      editor.setAttribute("rows", "1"); // inicia con 1 fila
      editor.style.resize = "none";     // evita manija de redimensionar
      editor.style.overflow = "hidden"; // oculta scrollbars verticales
      editor.style.lineHeight = getComputedStyle(label).lineHeight; // alinea con label

      // Copia texto actual (sin saltos de línea)
      editor.value = currentText;

      // Oculta label y agrega editor
      label.style.display = "none";
      form.appendChild(editor);

      // --- helpers internos ---

      // Autoajusta la altura al contenido (scrollHeight)
      // (ajusta primero a 'auto' para recalcular, luego fija a scrollHeight)
      const autoresize = () => {
        editor.style.height = "auto"; 
        editor.style.height = editor.scrollHeight + "px";
      };

      // Sanea saltos de línea → espacios (no admite \n)
      const sanitizeNoNewlines = () => {
        const sanitized = editor.value.replace(/\r?\n+/g, " ");
        if (sanitized !== editor.value) {
          const pos = editor.selectionStart;
          editor.value = sanitized;
          // Restaura lo mejor posible la posición del cursor
          editor.selectionStart = editor.selectionEnd = Math.min(pos, editor.value.length);
        }
      };

      // --- listeners del ciclo de edición ---

      // Teclas: Enter = commit (sin nueva línea), Esc = cancel
      const onKeyDown = (ke) => {
        if (ke.key === "Enter") {
          ke.preventDefault(); // bloquea salto de línea
          finalize("commit");
        } else if (ke.key === "Escape") {
          ke.preventDefault();
          finalize("cancel");
        }
      };

      // Entrada: bloquea cualquier \n proveniente de paste/IME, y auto-resize
      const onInput = () => {
        sanitizeNoNewlines(); 
        autoresize();
      };

      // Blur: commit
      const onBlur = () => finalize("commit");

      let finished = false;
      const finalize = (mode /* 'commit' | 'cancel' */) => {
        if (finished) return;
        finished = true;

        editor.removeEventListener("keydown", onKeyDown);
        editor.removeEventListener("input", onInput);
        editor.removeEventListener("blur", onBlur);

        if (editor.parentNode === form) editor.remove();
        label.style.display = "";

        if (mode === "commit") {
          const next = editor.value.trim();
          if (next && next !== currentText) handler(li.dataset.id, next);
          if (!next) handler(li.dataset.id, ""); // vacío → eliminar
        }
      };

      // Inicializa editor
      editor.addEventListener("keydown", onKeyDown);
      editor.addEventListener("input", onInput);
      editor.addEventListener("blur", onBlur, { once: true });

      // Foco y tamaño inicial
      editor.focus();
      // Coloca cursor al final
      const len = editor.value.length;
      editor.setSelectionRange(len, len);
      autoresize();
    });
  };

  listen(this.pendingList);
  listen(this.completedList);
}


  // Crear nueva tarea (solo en pendientes)
  onCreate(handler) {
    // Enter en input
    this.pendingList.addEventListener("keydown", (e) => {
      const entry = e.target.closest(ChecklistView.SEL.newEntry);
      if (!entry || e.key !== "Enter") return;
      const input = qs(entry, "input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
    });

    // Click en [+]
    this.pendingList.addEventListener("click", (e) => {
      const entry = e.target.closest(ChecklistView.SEL.newEntry);
      if (!entry) return;
      const btn = e.target.closest(ChecklistView.SEL.btnAdd);
      if (!btn) return;
      const input = qs(entry, "input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
    });
  }

  // Enfoca input de nueva tarea
  focusNewEntryInput() {
    const entry = qs(this.pendingList, ChecklistView.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }

  /* ================================
   * Drag & Drop (per list)
   * ================================ */
  onReorder(handler) {
    const attachDnD = (ul, key /* 'pending' | 'completed' */) => {
      const state = this.dnd[key];

      ul.addEventListener("dragstart", (e) => {
        const li = e.target.closest(ChecklistView.SEL.item);
        if (!li?.dataset.id || li.dataset.role === "new-entry") return;
        state.draggingId = li.dataset.id;
        li.classList.add("opacity-50");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", state.draggingId);
      });

      ul.addEventListener("dragover", (e) => {
        if (!state.draggingId) return;

        const li = e.target.closest(ChecklistView.SEL.item);
        if (!li || !li.dataset.id || li.dataset.role === "new-entry") {
          e.preventDefault();
          this.#clearDndMarkers(ul);
          state.overId = null;
          state.overPos = "after-end";
          return;
        }

        e.preventDefault();
        const rect = li.getBoundingClientRect();
        const before = (e.clientY - rect.top) < (rect.height / 2);
        this.#clearDndMarkers(ul);
        state.overId = li.dataset.id;
        state.overPos = before ? "before" : "after";
        li.classList.add(before ? "border-top" : "border-bottom");
      });

      ul.addEventListener("dragleave", (e) => {
        const li = e.target.closest(ChecklistView.SEL.item);
        if (!li) return;
        li.classList.remove("border-top", "border-bottom", "border-primary");
      });

      ul.addEventListener("drop", (e) => {
        if (!state.draggingId) return;
        e.preventDefault();

        const itemsDom = qsa(ul, "li.list-group-item[data-id]");
        let toIndex;

        if (state.overPos === "after-end" || state.overId === null) {
          toIndex = itemsDom.length; // insertar al final
        } else {
          const targetLi = itemsDom.find(node => node.dataset.id === state.overId);
          const targetIndex = itemsDom.indexOf(targetLi);
          toIndex = state.overPos === "before" ? targetIndex : targetIndex + 1;
        }

        handler(state.draggingId, toIndex);
        this.#clearDndStateFor(ul, state);
      });

      ul.addEventListener("dragend", () => this.#clearDndStateFor(ul, state));
    };

    attachDnD(this.pendingList, "pending");
    attachDnD(this.completedList, "completed");
  }

  // Limpia marcas visuales de DnD
  #clearDndMarkers(ul) {
    qsa(ul, "li.list-group-item").forEach(li => {
      li.classList.remove("border-top", "border-bottom", "border-primary", "opacity-50");
    });
  }

  // Limpia estado DnD
  #clearDndStateFor(ul, state) {
    this.#clearDndMarkers(ul);
    state.draggingId = null;
    state.overId = null;
    state.overPos = null;
  }
}

/* ================================
 * Controller
 * ================================ */
class ChecklistController {
  constructor({ root }) {
    // Crea modelo y vista
    this.model = new ChecklistModel();
    this.view = new ChecklistView(root);

    // Control de creación
    this.createInFlight = false;
    // Bandera de foco
    this.shouldRefocusNewEntry = false;

    // Render inicial
    this.view.render(this.model.getAll());

    // Suscripción a cambios del modelo
    this.model.addEventListener("change", () => {
      this.view.render(this.model.getAll());
      if (this.shouldRefocusNewEntry) {
        this.view.focusNewEntryInput();
        this.shouldRefocusNewEntry = false;
      }
      this.createInFlight = false;
    });

    /* ====== Eventos de vista → acciones ====== */

    // Crear
    this.view.onCreate((text) => {
      if (this.createInFlight) return;
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      this.model.add(text);
    });

    // Toggle check (mueve ítem al tab correspondiente)
    this.view.onToggle((id) => this.model.toggle(id));

    // Editar por clic en label; texto vacío → eliminar
    this.view.onEdit((id, text) => {
      if (String(text).trim() === "") this.model.remove(id);
      else this.model.updateText(id, text);
    });

    // Reordenamiento por DnD
    this.view.onReorder?.((draggedId, toIndex) => {
      this.model.moveToIndex(draggedId, toIndex);
    });
  }
}

/* ================================
 * Helpers
 * ================================ */
// Resalta tab destino al mover entre Pending/Completed
function flashCompletedTab(el, color = "#f5d9ab", holdMs = 800, backMs = 250) {
  if (!el || !(el instanceof HTMLElement)) return;

  if (el.__flashTimerHold) clearTimeout(el.__flashTimerHold);
  if (el.__flashTimerBack) clearTimeout(el.__flashTimerBack);
  if (el.__flashPrevBg !== undefined) {
    el.style.backgroundColor = el.__flashPrevBg || "";
  }

  el.__flashPrevBg = el.style.backgroundColor || "";
  void el.offsetWidth;
  el.style.backgroundColor = color;

  el.__flashTimerHold = setTimeout(() => {
    void el.offsetWidth;
    el.style.backgroundColor = el.__flashPrevBg || "";
    el.__flashTimerBack = setTimeout(() => {
      delete el.__flashTimerHold;
      delete el.__flashTimerBack;
      delete el.__flashPrevBg;
    }, backMs);
  }, holdMs);
}

/* ================================
 * Boot
 * ================================ */
// Inicializa controlador
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("checklist-container");
  if (!container) return;
  new ChecklistController({ root: container });
});
