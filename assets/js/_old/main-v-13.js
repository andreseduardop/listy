// checklist component with drag & drop reordering
// NOTE: Code in English, comentarios en español (tercera persona).

/* ================================
 * Utilities
 * ================================ */
  // Crea elemento con clases, atributos, estilos y contenido opcional
  function el(
    tag,
    { className = "", attrs = {}, style = {}, html = "" } = {}
  ) {
    const node = document.createElement(tag);

    // Asigna clases si procede
    if (className) node.className = className;

    // Normaliza aplicación de estilos (string u objeto)
    // - Si viene en attrs.style, lo aplica primero
    // - El parámetro "style" tiene precedencia sobre attrs.style
    const applyStyle = (target, st) => {
      // Ignora estilos vacíos o nulos
      if (!st) return;

      // Si es string, lo asigna directo al atributo style
      if (typeof st === "string") {
        target.setAttribute("style", st);
        return;
      }

      // Si es objeto, recorre claves y aplica con setProperty o acceso directo
      for (const [prop, val] of Object.entries(st)) {
        if (val == null) continue; // omite nulos/undefined
        // Si es una custom property o kebab-case, usa setProperty
        if (prop.startsWith("--") || prop.includes("-")) {
          target.style.setProperty(prop, String(val));
        } else {
          // Usa acceso camelCase (e.g., backgroundColor)
          target.style[prop] = String(val);
        }
      }
    };

    // Asigna atributos (exceptuando style para aplicarlo de forma controlada)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "style") continue; // se gestiona aparte
      node.setAttribute(k, v);
    }

    // Aplica primero estilos presentes en attrs.style
    applyStyle(node, attrs?.style);
    // Aplica luego el parámetro style (tiene precedencia)
    applyStyle(node, style);

    // Inserta HTML si procede
    if (html) node.innerHTML = html;

    return node;
  }

// visibility helper — gestiona mostrar/ocultar sin romper clases Bootstrap d-*
// (Comentarios en español, tercera persona)
const visibility = (() => {
  // Asegura conocer la clase de display visible original; si no existe, usa fallback
  function ensureDisplayClass(el, fallback = "d-block") {
    // Busca una utilidad Bootstrap d-* conocida presente en el elemento
    const displayUtil = Array.from(el.classList).find(c =>
      /^d-(block|inline|inline-block|flex|inline-flex|grid|inline-grid)$/.test(c)
    );
    // Guarda la clase de display a restaurar en dataset (se conserva entre llamadas)
    el.dataset.displayClass = el.dataset.displayClass || displayUtil || fallback;
    return el.dataset.displayClass;
  }

  // Oculta el elemento añadiendo d-none y marcando aria-hidden
  function hide(el) {
    if (!el) return;                           // valida elemento
    ensureDisplayClass(el);                    // asegura display original
    el.classList.add("d-none");                // aplica ocultación
    // el.setAttribute("aria-hidden", "true");    // refleja estado en accesibilidad
  }

  // Muestra el elemento quitando d-none y restaurando su display original (o fallback)
  function show(el, displayFallback = "d-block") {
    if (!el) return;                           // valida elemento
    const display = ensureDisplayClass(el, displayFallback);
    el.classList.remove("d-none");             // retira ocultación
    if (!el.classList.contains(display)) {     // asegura clase de display visible
      el.classList.add(display);
    }
    el.setAttribute("aria-hidden", "false");   // refleja estado en accesibilidad
  }

  // Controla visibilidad de forma determinista según booleano
  function setVisible(el, visible, displayFallback = "d-block") {
    // Decide acción según parámetro
    if (visible) show(el, displayFallback);
    else hide(el);
  }

  // Alterna visibilidad cuando no se pasa booleano explícito
  function toggleVisible(el, displayFallback = "d-block") {
    // Si está oculto → muestra; si está visible → oculta
    setVisible(el, el.classList.contains("d-none"), displayFallback);
  }

  // Expone API pública
  return { hide, show, setVisible, toggleVisible };
})();


// Atajos de consulta
const qs  = (root, sel) => root.querySelector(sel);
const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));

/* ================================
 * Model
 * ================================ */
class ChecklistModel extends EventTarget {
  // Clave de almacenamiento
  static STORAGE_KEY = "checklist";

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

    // Asegura colocar un placeholder cuando no hay tareas completadas
    this.#ensureCompletedEmptyState();
  }

  // Renderiza lista
  #renderList(ul, data, { withNewEntry }) {
    const frag = document.createDocumentFragment();
    data.forEach((item, index) => frag.appendChild(this.#renderItem(item, index)));
    if (withNewEntry) frag.appendChild(this.#renderNewItemEntry());
    ul.appendChild(frag);
  }

  // Crea <li> según layout 
  #renderItem(item) {
    const li = el("li", {
      className: "list-group-item p-2 d-flex align-items-start",
      attrs: { draggable: "true" },
    });
    li.dataset.id = item.id;

    // Bloque form-check (izquierda)
    const form = el("div", { className: "form-check position-relative d-flex align-items-top flex-grow-1" });

    // Input checkbox (toggle solo al hacer clic en el input)
    const input = el("input", {
      className: "form-check-input",
      attrs: { type: "checkbox", id: `checklist-check-${item.id}` },
    });
    input.checked = !!item.completed;

    // Label (clic → modo edición)
    const label = el("label", {
      className: "form-check-label flex-grow-1",
      attrs: { for: `textarea-for-${item.id}`,  }, // 
    });
    label.textContent = item.text;

    // Panel inline OCCULTO por defecto — coincide con el nuevo layout
    // (Se muestra al editar; contiene <textarea> y ayudas/atajos)
    const panel = el("div", {
      className: "d-flex flex-column ps-1 flex-grow-1 d-none",
      attrs: { "data-role": "inline-panel" },
    });

    // Editor inline (sin d-none; lo que se oculta/muestra es el panel)
    const editor = el("textarea", {
      className: "form-control",
      attrs: {
        "data-role": "inline-editor",
        "aria-label": "Edit task text",
        "name": "inline-editor",
        "rows": "1",
        "id": `textarea-for-${item.id}`, // id único
      }
    });

    // Menú de acciones
    // TODO: Agregar data-action para poder manejar clics 
    const actions = el("div", {
      className: "d-flex flex-column mt-2 small",
      html: `
        <a class="text-decoration-none fw-bold mt-1 mb-2 d-flex justify-content-between" href="#" data-action="save">
          <span>Save</span><span class="text-muted">[Enter]</span>
        </a>
        <a class="text-decoration-none fw-bold mb-2 d-flex justify-content-between" href="#" data-action="discard">
          <span>Discard</span><span class="text-muted">[Esc]</span>
        </a>
        <a class="text-decoration-none fw-bold mb-2 d-flex justify-content-between" href="#" data-action="delete">
          <span>Delete</span><span class="text-muted">[Shift+Del]</span>
        </a>
        <a class="text-decoration-none fw-bold mb-2 d-flex justify-content-between" href="#" data-action="ai-spell">
          <span class="app-icono">AI Fix spelling</span><span class="text-muted">[Shift+F8]</span>
        </a>
        <a class="text-decoration-none fw-bold mb-2 d-flex justify-content-between" href="#" data-action="ai-improve">
          <span class="app-icono">AI improve writing</span><span class="text-muted">[Shift+F9]</span>
        </a>
        <a class="text-decoration-none fw-bold mb-2 d-flex justify-content-between" href="#" data-action="ai-breakdown">
          <span class="app-icono">AI break down task</span><span class="text-muted">[Shift+F10]</span>
        </a>
      `
    });

    // Ensambla panel
    panel.append(editor, actions);

    // Ensambla form (input + label + panel, en ese orden)
    form.append(input, label, panel);

    // Botón decorativo de mover
    const btnMove = el("button", {
      className: "btn app-btn-move",
      attrs: {
        type: "button",
        "aria-label": "Move",
        title: "Move",
        "aria-hidden": "true",
        tabindex: "-1",
        draggable: "false"
      },
      html: `<i class="bi bi-arrow-down-up" aria-hidden="true"></i>`,
    });

    li.append(form, btnMove);
    return li;
  }

  // Inserta/retira el placeholder "No tasks completed."
  #ensureCompletedEmptyState() {
    // Obtiene la UL de completadas
    const ul = this.completedList;
    if (!ul) return;

    // Cuenta <li> reales (con data-id no vacío)
    // — ignora placeholders previos si existieran
    const realItems = [...ul.querySelectorAll("li.list-group-item")]
      .filter(li => (li.dataset?.id ?? "") !== "");

    // Si hay elementos → asegúrese de quitar placeholder
    if (realItems.length > 0) {
      const ph = ul.querySelector('li.list-group-item[data-id=""]');
      if (ph) ph.remove(); // ← elimina placeholder existente
      return;
    }

    // Si no hay elementos → inserta placeholder 
    // (Evita duplicados si ya existe)
    if (!ul.querySelector('li.list-group-item[data-id=""]')) {
      // Crea el <li> para placeholder
      const li = el("li", {
        className: "list-group-item p-2 d-flex align-items-start",
        attrs: { draggable: "false" },
        html: "No tasks completed.", // ← inserta el texto exacto
      });
      // Asigna data-id vacío (se hace luego porque el() no gestiona dataset)
      li.dataset.id = "";
      // Inserta al final
      ul.appendChild(li);
    }
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
      attrs: { 
        type: "text",
        name: "new-task",
        placeholder: "Add new task and press Enter",
        "aria-label": "Add new task"
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

  // Edición inline: clic en label abre editor (textarea + menú) con auto-resize
  onEdit(handler) {
    const listen = (ul) => {
      ul.addEventListener("click", (e) => {
        const label = e.target.closest(ChecklistView.SEL.label);
        if (!label) return;

        const li = label.closest(ChecklistView.SEL.item);
        if (!li?.dataset.id) return;

        const form  = label.closest(".form-check");
        // Obtiene el panel y el textarea según el nuevo layout
        const panel  = form.querySelector("div[data-role='inline-panel']");
        const editor = form.querySelector("textarea[data-role='inline-editor']");
        if (!panel || !editor) return;

        // Copia el texto actual y prepara visibilidad
        const currentText = label.textContent.trim();
        visibility.hide(label);           // ← oculta label
        visibility.show(panel, "d-flex"); // ← muestra panel (usa d-flex como fallback)
        editor.value = currentText;       // ← carga valor

        // --- helpers internos ---

        // Autoajusta altura al contenido
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
            editor.selectionStart = editor.selectionEnd = Math.min(pos, editor.value.length);
          }
        };

        // --- listeners del ciclo de edición ---

        const finalize = (mode /* 'commit' | 'cancel' */) => {
          if (finalize._done) return; finalize._done = true;

          editor.removeEventListener("keydown", onKeyDown);
          editor.removeEventListener("input", onInput);
          editor.removeEventListener("blur", onBlur);
          panel.removeEventListener("click", onActionClick);

          if (mode === "commit") {
            const next = editor.value.trim();
            if (next && next !== currentText) handler(li.dataset.id, next);
            if (!next) handler(li.dataset.id, ""); // vacío → eliminar
          }

          // Restaura visibilidad
          visibility.hide(panel);
          visibility.show(label);
        };

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

        const onInput = () => { sanitizeNoNewlines(); autoresize(); };
        const onBlur  = () => finalize("commit");

        // Maneja clics en las acciones del menú (Save/Discard/Delete/AI…)
        const onActionClick = (ce) => {
          const a = ce.target.closest("a[data-action]");
          if (!a) return;
          ce.preventDefault();
          const act = a.dataset.action;
          if (act === "save") finalize("commit");
          else if (act === "discard") finalize("cancel");
          else if (act === "delete") { editor.value = ""; finalize("commit"); }
          else if (act === "ai-spell") { /* TODO */ }
          else if (act === "ai-improve") { /* TODO */ }
          else if (act === "ai-breakdown") { /* TODO */ }
        };

        // Inicializa edición
        editor.addEventListener("keydown", onKeyDown);
        editor.addEventListener("input", onInput);
        editor.addEventListener("blur", onBlur, { once: true });
        panel.addEventListener("click", onActionClick);

        // Foco y tamaño inicial
        editor.focus();
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
   * Drag & Drop (per list) + drop fuera del UL (arriba → 0, abajo → final)
   * ================================ */
  onReorder(handler) {
    // --- Helpers internos -----------------------------------------------

    // Devuelve todos los <li> "reales" (excluye plantillas/new-entry)
    const getRealItems = (ul) => {
      // Obtiene los hijos que representan ítems de datos
      return Array.from(ul.querySelectorAll("li.list-group-item[data-id]"))
        .filter(li => li.dataset.role !== "new-entry");
    };

    // Calcula el índice de inserción basándose en la coordenada Y del puntero.
    // Retorna un número entre 0..n (n = append al final).
    const indexFromPointerY = (ul, clientY) => {
      // Lee ítems actuales del UL (DOM vivo)
      const items = getRealItems(ul);
      // Recorre y decide “antes de la mitad” → corta en ese índice
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        // Si el puntero está por encima de la mitad del item i, inserta antes de i
        if (clientY < midY) return i;
      }
      // Si no cae antes de nadie, va al final
      return items.length;
    };

    // Limpia marcas visuales de guía DnD en un UL
    const clearMarkers = (ul) => {
      // Elimina clases usadas como guías de inserción
      ul.querySelectorAll(".border-top, .border-bottom, .border-primary, .opacity-50")
        .forEach(el => el.classList.remove("border-top", "border-bottom", "border-primary", "opacity-50"));
    };

    // Limpia todo el estado DnD de una lista
    const clearStateFor = (ul, state) => {
      // Restablece marcas y variables
      clearMarkers(ul);
      state.draggingId = null;
      state.lastOverLi = null;
    };

    // Pinta una guía en función de la posición del puntero sobre un LI
    const paintGuide = (li, clientY) => {
      // Dibuja una línea arriba/abajo según mitad del <li>
      const rect = li.getBoundingClientRect();
      const before = (clientY - rect.top) < (rect.height / 2);
      li.classList.add(before ? "border-top" : "border-bottom");
    };

    // --- Wiring por lista ------------------------------------------------
    const attachDnD = (ul, key /* 'pending' | 'completed' */) => {
      const state = this.dnd[key];

      ul.addEventListener("dragstart", (e) => {
        // Detecta el <li> arrastrado y marca estado
        const li = e.target.closest(ChecklistView.SEL.item);
        if (!li?.dataset?.id || li.dataset.role === "new-entry") return;
        state.draggingId = li.dataset.id;
        li.classList.add("opacity-50"); // ← marca visual del elemento arrastrado
        e.dataTransfer.effectAllowed = "move";
        // Guarda el id en DataTransfer (útil si se arrastra entre listas)
        e.dataTransfer.setData("text/plain", state.draggingId);
      });

      ul.addEventListener("dragover", (e) => {
        // Permite el drop mientras haya un ítem en arrastre
        if (!state.draggingId) return;
        e.preventDefault();

        // Limpia marcas previas y pinta guía en el LI actual (si lo hay)
        clearMarkers(ul);

        const li = e.target.closest(ChecklistView.SEL.item);
        if (li && li.dataset.id && li.dataset.role !== "new-entry") {
          // Pinta guía superior/inferior en el LI bajo el puntero
          paintGuide(li, e.clientY);
          state.lastOverLi = li;
        } else {
          // Si no está sobre un LI, no pinta marcas (pero igual se podrá insertar)
          state.lastOverLi = null;
        }
      });

      ul.addEventListener("dragleave", () => {
        // Borra guías cuando el puntero sale del UL/LI
        clearMarkers(ul);
        state.lastOverLi = null;
      });

      ul.addEventListener("drop", (e) => {
        // Procesa drop DENTRO de este UL
        if (!state.draggingId) return;
        e.preventDefault();

        const items = getRealItems(ul);

        // Índice de origen dentro de este UL (si es -1, proviene de otra lista)
        const fromIndex = items.findIndex(el => el.dataset.id === state.draggingId);

        // Índice destino calculado por la coordenada Y del puntero
        let toIndex = indexFromPointerY(ul, e.clientY);

        // Dispara actualización de modelo
        handler(state.draggingId, toIndex);

        // Limpia estado y marcas
        clearStateFor(ul, state);
      });

      ul.addEventListener("dragend", () => clearStateFor(ul, state));
    };

    // Conecta las dos listas (Pending / Completed)
    attachDnD(this.pendingList, "pending");
    attachDnD(this.completedList, "completed");

    // --- Drop global: fuera del UL (arriba → 0, abajo → final) -----------
    const handleDocumentDrop = (e) => {
      // Busca cuál lista está en arrastre
      const pairs = [
        { ul: this.pendingList,   state: this.dnd.pending   },
        { ul: this.completedList, state: this.dnd.completed },
      ];

      for (const { ul, state } of pairs) {
        if (!state.draggingId) continue;

        const rect = ul.getBoundingClientRect();

        // Suelta por ENCIMA del UL → índice 0
        if (e.clientY < rect.top) {
          e.preventDefault();
          clearMarkers(ul);
          handler(state.draggingId, 0);
          clearStateFor(ul, state);
          break;
        }

        // Suelta por DEBAJO del UL → índice final
        if (e.clientY > rect.bottom) {
          e.preventDefault();
          const n = getRealItems(ul).length; // ← longitud actual de la lista
          clearMarkers(ul);
          handler(state.draggingId, n);
          clearStateFor(ul, state);
          break;
        }
      }
    };

    // Registra listeners globales una única vez
    if (!this._docDropBound) {
      this._docDropBound = true;
      // Permite que el navegador emita 'drop' fuera de zonas droppable
      document.addEventListener("dragover", (e) => e.preventDefault()); // ← asegura evento drop global
      document.addEventListener("drop", handleDocumentDrop);
    }
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
