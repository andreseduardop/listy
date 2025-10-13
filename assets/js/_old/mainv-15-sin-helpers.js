// checklist component with drag & drop reordering
// NOTE: Code in English, comentarios en español (tercera persona).
// English code; comentarios en español (tercera persona)
import { el, applyStyle, qs, qsa, visibility, flashBackground } from "./utils/helpers.js";

/* ================================
 * Model
 * ================================ */
class ChecklistModel extends EventTarget {
  static STORAGE_KEY = "checklist"; // Clave de almacenamiento

  constructor() {
    super();
    // Carga estado inicial
    this.items = this.#read();
  }

  // Lee JSON desde localStorage de forma segura
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
      localStorage.setItem(
        ChecklistModel.STORAGE_KEY,
        JSON.stringify(this.items)
      );
      this.dispatchEvent(
        new CustomEvent("change", { detail: { items: this.getAll() } })
      );
    } catch (err) {
      console.error("Persist error:", err);
    }
  }

  // Genera id único compacto
  #uid() {
    const uuid =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return uuid.slice(0, 12);
  }

  // Devuelve copia inmutable
  getAll() {
    return this.items.map((i) => ({ ...i }));
  }

  // Agrega tarea
  add(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    this.items = [
      ...this.items,
      { id: this.#uid(), text: trimmed, completed: false },
    ];
    this.#write();
  }

  // Cambia estado completado
  toggle(id) {
    const idx = this.items.findIndex((i) => i.id === id);
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
    const idx = this.items.findIndex((i) => i.id === id);
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
    this.items = this.items.filter((i) => i.id !== id);
    this.#write();
  }

  // Mueve a índice destino (0..n)
  moveToIndex(id, toIndex) {
    const len = this.items.length;
    if (len <= 1) return;
    const from = this.items.findIndex((i) => i.id === id);
    if (from === -1) return;

    let dest = Math.max(0, Math.min(len, Number(toIndex)));
    if (dest === from || dest === from + 1) return; // sin cambios

    const clone = [...this.items];
    const [moved] = clone.splice(from, 1);
    if (dest > from) dest -= 1; // ajusta tras extracción
    clone.splice(dest, 0, moved);

    this.items = clone;
    this.#write();
  }
}

/* ================================
 * View
 * ================================ */
class ChecklistView {
  // Selectors of the layout (kept intact)
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

  // Action identifiers for the inline menu
  static ACTIONS = [
    { key: "save", label: "Save", hint: "[Enter]" },
    { key: "discard", label: "Discard", hint: "[Esc]" },
    { key: "delete", label: "Delete", hint: "[Shift+Del]" },
    { key: "ai-spell", label: "AI Fix spelling", hint: "[Shift+F8]" },
    { key: "ai-improve", label: "AI improve writing", hint: "[Shift+F9]" },
    { key: "ai-breakdown", label: "AI break down task", hint: "[Shift+F10]" },
  ];

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
      pending: { draggingId: null, lastOverLi: null },
      completed: { draggingId: null, lastOverLi: null },
    };

    // Marca de listeners globales
    this._docDropBound = false;
  }

  // Main render
  render(items) {
    const pending = items.filter((i) => !i.completed);
    const completed = items.filter((i) => i.completed);

    this.pendingList.innerHTML = "";
    this.completedList.innerHTML = "";

    this.#renderList(this.pendingList, pending, { withNewEntry: true });
    this.#renderList(this.completedList, completed, { withNewEntry: false });

    // Asegura placeholder cuando no hay completadas
    this.#ensureCompletedEmptyState();
  }

  // Renders a UL
  #renderList(ul, data, { withNewEntry }) {
    const frag = document.createDocumentFragment();
    data.forEach((item, index) => frag.appendChild(this.#renderItem(item, index)));
    if (withNewEntry) frag.appendChild(this.#renderNewItemEntry());
    ul.appendChild(frag);
  }

  // Creates an <li> according to the layout
  #renderItem(item) {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
      attrs: { draggable: "true" },
    });
    li.dataset.id = item.id;

    // Bloque form-check (izquierda)
    const form = el("div", {
      className: "form-check position-relative d-flex align-items-top flex-grow-1",
    });

    // Input checkbox (toggle only when clicking the input)
    const input = el("input", {
      className: "form-check-input",
      attrs: { type: "checkbox", id: `checklist-check-${item.id}` },
    });
    input.checked = !!item.completed;

    // Label (click → edit mode)
    const label = el("label", {
      className: "form-check-label flex-grow-1",
      attrs: { for: `textarea-for-${item.id}` },
    });
    label.textContent = item.text;

    // Inline panel (hidden by default) with textarea + actions
    const panel = el("div", {
      className: "d-flex flex-column ps-1 flex-grow-1 d-none",
      attrs: { "data-role": "inline-panel" },
    });

    // Editor (textarea)
    const editor = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit task text",
        name: "inline-editor",
        rows: "1",
        id: `textarea-for-${item.id}`,
      },
    });

    // Actions menu (constructed programmatically to reducir duplicación)
    const actions = el("div", {
      className: "d-flex flex-column mt-2 small",
    });
    actions.append(
      ...ChecklistView.ACTIONS.map(({ key, label, hint }) =>
        el("a", {
          className: "text-decoration-none fw-bold mb-2 d-flex justify-content-between",
          attrs: { href: "#", "data-action": key },
          html: `<span class="${key.startsWith("ai-") ? "app-icono" : ""}">${label}</span><span class="text-muted">${hint}</span>`,
        })
      )
    );

    // Ensambla panel y form
    panel.append(editor, actions);
    form.append(input, label, panel);

    // Decorative move button (kept for layout parity)
    const btnMove = el("button", {
      className: "btn app-btn-move",
      attrs: {
        type: "button",
        "aria-label": "Move",
        title: "Move",
        "aria-hidden": "true",
        tabindex: "-1",
        draggable: "false",
      },
      html: `<i class="bi bi-arrow-down-up" aria-hidden="true"></i>`,
    });

    li.append(form, btnMove);
    return li;
  }

  // Inserts/removes the completed placeholder "No tasks completed."
  #ensureCompletedEmptyState() {
    const ul = this.completedList;
    if (!ul) return;

    // Cuenta <li> reales (data-id no vacío)
    const realItems = [...ul.querySelectorAll("li.list-group-item")] //
      .filter((li) => (li.dataset?.id ?? "") !== "");

    if (realItems.length > 0) {
      const ph = ul.querySelector('li.list-group-item[data-id=""]');
      if (ph) ph.remove();
      return;
    }

    if (!ul.querySelector('li.list-group-item[data-id=""]')) {
      const li = el("li", {
        className: "list-group-item p-2 d-flex align-items-start",
        attrs: { draggable: "false" },
        html: "No tasks completed.",
      });
      li.dataset.id = "";
      ul.appendChild(li);
    }
  }

  // New entry <li>
  #renderNewItemEntry() {
    const li = el("li", {
      className: "list-group-item p-2 d-flex gap-2 align-items-start",
    });
    li.dataset.role = "new-entry";
    li.draggable = false;

    const input = el("input", {
      className: "form-control",
      attrs: {
        type: "text",
        name: "new-task",
        placeholder: "Add new task and press Enter",
        "aria-label": "Add new task",
      },
    });

    const btnAdd = el("button", {
      className: "btn app-btn-add",
      attrs: { type: "button", title: "Add new task", "aria-label": "Add new task" },
      html: `<i class="bi bi-plus-square-fill fs-3" aria-hidden="true"></i>`,
    });

    li.append(input, btnAdd);
    return li;
  }

  /* -------- Event delegation -------- */

  // Toggle completed: listens to 'change' only on the checkbox
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
        const targetTabId = goingCompleted
          ? "checklist-completed-tab"
          : "checklist-pending-tab";
        const targetEl = document.getElementById(targetTabId);
        if (targetEl) flashBackground(targetEl);
      });
    };

    listen(this.pendingList);
    listen(this.completedList);
  }

  // Inline edit: clicking the label opens a textarea + menu
  onEdit(handler) {
    const listen = (ul) => {
      ul.addEventListener("click", (e) => {
        const label = e.target.closest(ChecklistView.SEL.label);
        if (!label) return;

        const li = label.closest(ChecklistView.SEL.item);
        if (!li?.dataset.id) return;

        const form = label.closest(".form-check");
        const panel = form.querySelector("div[data-role='inline-panel']");
        const editor = form.querySelector("textarea[data-role='inline-editor']");
        if (!panel || !editor) return;

        // Prepara edición
        const currentText = label.textContent.trim();
        visibility.hide(label);
        visibility.show(panel, "d-flex");
        editor.value = currentText;

        // Auto-resize
        const autoresize = () => {
          editor.style.height = "auto";
          editor.style.height = editor.scrollHeight + "px";
        };

        // Sanea saltos de línea → espacios
        const sanitizeNoNewlines = () => {
          const sanitized = editor.value.replace(/\r?\n+/g, " ");
          if (sanitized !== editor.value) {
            const pos = editor.selectionStart;
            editor.value = sanitized;
            editor.selectionStart = editor.selectionEnd = Math.min(
              pos,
              editor.value.length
            );
          }
        };

        // Finaliza edición
        const finalize = (mode /* 'commit' | 'cancel' */) => {
          if (finalize._done) return;
          finalize._done = true;

          panel.removeEventListener("pointerdown", onActionPointerDown);
          panel.removeEventListener("click", onActionClick);
          editor.removeEventListener("keydown", onKeyDown);
          editor.removeEventListener("input", onInput);
          editor.removeEventListener("blur", onBlur);

          if (mode === "commit") {
            const next = editor.value.trim();
            if (next && next !== currentText) handler(li.dataset.id, next);
            if (!next) handler(li.dataset.id, ""); // vacío → eliminar
          }

          visibility.hide(panel);
          visibility.show(label);
        };

        // Handlers
        const onKeyDown = (ke) => {
          if (ke.key === "Enter") {
            ke.preventDefault();
            finalize("commit");
          } else if (ke.key === "Escape") {
            ke.preventDefault();
            finalize("cancel");
          } else if (ke.key === "Delete" && ke.shiftKey) {
            ke.preventDefault();
            editor.value = "";
            finalize("commit");
          } else if (ke.key === "F8" && ke.shiftKey) {
            ke.preventDefault();
            // TODO: integrar AI spellcheck
          } else if (ke.key === "F9" && ke.shiftKey) {
            ke.preventDefault();
            // TODO: integrar AI improve
          } else if (ke.key === "F10" && ke.shiftKey) {
            ke.preventDefault();
            // TODO: integrar AI breakdown
          }
        };

        const onInput = () => {
          sanitizeNoNewlines();
          autoresize();
        };
        const onBlur = () => finalize("commit");

        // Clicks en acciones
        const onActionPointerDown = (pe) => {
          const a = pe.target.closest("a[data-action]");
          if (!a) return;
          pe.preventDefault(); // evita blur
          const act = a.dataset.action;
          if (act === "save") finalize("commit");
          else if (act === "discard") finalize("cancel");
          else if (act === "delete") {
            editor.value = "";
            finalize("commit");
          } else if (act === "ai-spell") {
            /* TODO */
          } else if (act === "ai-improve") {
            /* TODO */
          } else if (act === "ai-breakdown") {
            /* TODO */
          }
        };

        const onActionClick = (ce) => {
          const a = ce.target.closest("a[data-action]");
          if (!a) return;
          ce.preventDefault();
          const act = a.dataset.action;
          if (act === "save") finalize("commit");
          else if (act === "discard") finalize("cancel");
          else if (act === "delete") {
            editor.value = "";
            finalize("commit");
          } else if (act === "ai-spell") {
            /* TODO */
          } else if (act === "ai-improve") {
            /* TODO */
          } else if (act === "ai-breakdown") {
            /* TODO */
          }
        };

        // Registros
        panel.addEventListener("pointerdown", onActionPointerDown);
        panel.addEventListener("click", onActionClick);
        editor.addEventListener("keydown", onKeyDown);
        editor.addEventListener("blur", onBlur, { once: true });
        editor.addEventListener("input", onInput);

        // Foco inicial
        editor.focus();
        const len = editor.value.length;
        editor.setSelectionRange(len, len);
        autoresize();
      });
    };

    listen(this.pendingList);
    listen(this.completedList);
  }

  // Create new task (pending list only)
  onCreate(handler) {
    // Enter on input
    this.pendingList.addEventListener("keydown", (e) => {
      const entry = e.target.closest(ChecklistView.SEL.newEntry);
      if (!entry || e.key !== "Enter") return;
      const input = qs(entry, "input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
    });

    // Click on [+]
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

  // Focuses new-entry input
  focusNewEntryInput() {
    const entry = qs(this.pendingList, ChecklistView.SEL.newEntryInput);
    if (entry) entry.focus({ preventScroll: true });
  }

  /* ================================
   * Drag & Drop (per list) + global drop (top → 0, bottom → end)
   * ================================ */
  onReorder(handler) {
    // Helpers ------------------------------------------------------------

    // Returns real data <li> items (excludes new-entry)
    const getRealItems = (ul) => {
      return Array.from(ul.querySelectorAll("li.list-group-item[data-id]"))
        .filter((li) => li.dataset.role !== "new-entry");
    };

    // Calculates insert index based on pointer Y
    const indexFromPointerY = (ul, clientY) => {
      const items = getRealItems(ul);
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (clientY < midY) return i;
      }
      return items.length;
    };

    // Clears visual markers
    const clearMarkers = (ul) => {
      ul
        .querySelectorAll(
          ".border-top, .border-bottom, .border-primary, .opacity-50"
        )
        .forEach((el) =>
          el.classList.remove(
            "border-top",
            "border-bottom",
            "border-primary",
            "opacity-50"
          )
        );
    };

    // Resets list DnD state
    const clearStateFor = (ul, state) => {
      clearMarkers(ul);
      state.draggingId = null;
      state.lastOverLi = null;
    };

    // Paints guidance line depending on pointer position
    const paintGuide = (li, clientY) => {
      const rect = li.getBoundingClientRect();
      const before = clientY - rect.top < rect.height / 2;
      li.classList.add(before ? "border-top" : "border-bottom");
    };

    // Attach DnD per list
    const attachDnD = (ul, key /* 'pending' | 'completed' */) => {
      const state = this.dnd[key];

      ul.addEventListener("dragstart", (e) => {
        const li = e.target.closest(ChecklistView.SEL.item);
        if (!li?.dataset?.id || li.dataset.role === "new-entry") return;
        state.draggingId = li.dataset.id;
        li.classList.add("opacity-50");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", state.draggingId);
      });

      ul.addEventListener("dragover", (e) => {
        if (!state.draggingId) return;
        e.preventDefault();
        clearMarkers(ul);
        const li = e.target.closest(ChecklistView.SEL.item);
        if (li && li.dataset.id && li.dataset.role !== "new-entry") {
          paintGuide(li, e.clientY);
          state.lastOverLi = li;
        } else {
          state.lastOverLi = null;
        }
      });

      ul.addEventListener("dragleave", () => {
        clearMarkers(ul);
        state.lastOverLi = null;
      });

      ul.addEventListener("drop", (e) => {
        if (!state.draggingId) return;
        e.preventDefault();
        const toIndex = indexFromPointerY(ul, e.clientY);
        handler(state.draggingId, toIndex);
        clearStateFor(ul, state);
      });

      ul.addEventListener("dragend", () => clearStateFor(ul, state));
    };

    // Connect both lists
    attachDnD(this.pendingList, "pending");
    attachDnD(this.completedList, "completed");

    // Global drop: outside UL (top → 0, bottom → end)
    const handleDocumentDrop = (e) => {
      const pairs = [
        { ul: this.pendingList, state: this.dnd.pending },
        { ul: this.completedList, state: this.dnd.completed },
      ];

      for (const { ul, state } of pairs) {
        if (!state.draggingId) continue;
        const rect = ul.getBoundingClientRect();

        if (e.clientY < rect.top) {
          e.preventDefault();
          clearMarkers(ul);
          handler(state.draggingId, 0);
          clearStateFor(ul, state);
          break;
        }

        if (e.clientY > rect.bottom) {
          e.preventDefault();
          const n = getRealItems(ul).length;
          clearMarkers(ul);
          handler(state.draggingId, n);
          clearStateFor(ul, state);
          break;
        }
      }
    };

    if (!this._docDropBound) {
      this._docDropBound = true;
      document.addEventListener("dragover", (e) => e.preventDefault());
      document.addEventListener("drop", handleDocumentDrop);
    }
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

    // Control de creación y foco
    this.createInFlight = false;
    this.shouldRefocusNewEntry = false;

    // Render inicial
    this.view.render(this.model.getAll());

    // Suscripción a cambios
    this.model.addEventListener("change", () => {
      this.view.render(this.model.getAll());
      if (this.shouldRefocusNewEntry) {
        this.view.focusNewEntryInput();
        this.shouldRefocusNewEntry = false;
      }
      this.createInFlight = false;
    });

    /* ====== Vista → Acciones ====== */

    // Crear
    this.view.onCreate((text) => {
      if (this.createInFlight) return;
      this.createInFlight = true;
      this.shouldRefocusNewEntry = true;
      this.model.add(text);
    });

    // Toggle check
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
 * Boot
 * ================================ */
// Initializes controller on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // Busca contenedor y arranca controlador
  const container = document.getElementById("checklist-container");
  if (!container) return;
  new ChecklistController({ root: container });
});
