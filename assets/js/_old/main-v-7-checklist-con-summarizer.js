// Simple MVC checklist with drag & drop reordering (no move button)
// NOTE: Code in English, comentarios en español.

// -------------------------------
// Model
// -------------------------------
class ChecklistModel extends EventTarget {
  // Clave de almacenamiento en localStorage
  static STORAGE_KEY = "checklist-mvc";

  constructor() {
    super();
    // Carga inicial desde localStorage
    this.items = this.#read();
  }

  // Lee JSON desde localStorage (o inicia arreglo vacío)
  #read() {
    try {
      const raw = localStorage.getItem(ChecklistModel.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  // Escribe JSON en localStorage y emite evento de cambio
  #write() {
    try {
      localStorage.setItem(ChecklistModel.STORAGE_KEY, JSON.stringify(this.items));
      this.dispatchEvent(new CustomEvent("change", { detail: { items: this.items } }));
    } catch (err) {
      // Registra y evita romper la UI; podría notificar a la vista si se desea
      console.error('Persist error:', err); // registra el error
    }
  }

  // Remueve el elemento (tarea) de la lista
  remove(id) {
    // Elimina la tarea por id y persiste
    this.items = this.items.filter(i => i.id !== id);
    this.#write();
  }

  // Genera un id único para cada tarea
  #uid() {
    // Verifica de forma segura la disponibilidad de 'crypto.randomUUID'
    const hasCryptoUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

    // Genera la base del id: UUID sin guiones o fallback con timestamp + aleatorio
    const base = hasCryptoUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    // Trunca a 12 para mantener ids compactos en la UI
    // Funciona bien para listas cortas, aceptando un riesgo de colisión muy bajo
    return base.slice(0, 12);
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

  // Mueve una tarea a un índice exacto (0..length)
  moveToIndex(id, toIndex) {
    const len = this.items.length;
    if (len <= 1) return;
    const from = this.items.findIndex(i => i.id === id);
    if (from === -1) return;

    // Normaliza destino (permitimos insertar al final con toIndex === len)
    let dest = Math.max(0, Math.min(len, Number(toIndex)));
    if (dest === from || dest === from + 1) return; // Sin cambio efectivo

    const clone = [...this.items];
    const [moved] = clone.splice(from, 1); // quita elemento
    // Si quitamos antes del destino, éste se desplaza una posición hacia la izquierda
    if (dest > from) dest -= 1;
    clone.splice(dest, 0, moved); // inserta en destino normalizado

    this.items = clone;
    this.#write();
  }
}

// -------------------------------
// View
// -------------------------------
class ChecklistView {
  constructor(root) {
    // root: contenedor principal (ej. #checklist-container)
    this.root = root;

    // Selecciona listas por tab (pendientes / completadas)
    // (carga los elementos específicos para cada tab)
    this.pendingList = root.querySelector("#checklist-pending-tab-pane .app-checklist"); // valida existencia
    this.completedList = root.querySelector("#checklist-completed-tab-pane .app-checklist"); // valida existencia
    if (!this.pendingList || !this.completedList) {
      throw new Error("Missing .app-checklist in one or both tab panes.");
    }

    // Estado DnD por lista
    // (se separa el estado para no mezclar arrastres entre tabs)
    // draggingId: null,   // id del <li> que se arrastra
    // overId: null,       // id del <li> objetivo actual
    // overPos: null       // "before" | "after" | "after-end"
    this.dnd = {
      pending: { draggingId: null, overId: null, overPos: null },
      completed: { draggingId: null, overId: null, overPos: null },
    };
  }

  // Render principal: reemplaza el contenido de ambas listas
  render(items) {
    // Separa por estado
    // (filtra los arreglos para cada tab)
    const pending = items.filter(i => !i.completed);
    const completed = items.filter(i => i.completed);

    // Limpia ambas UL
    this.pendingList.innerHTML = "";
    this.completedList.innerHTML = "";

    // Render pendientes + entrada de nueva tarea al final
    {
      const frag = document.createDocumentFragment();
      pending.forEach((item, index) => frag.appendChild(this.#renderItem(item, index)));
      frag.appendChild(this.#renderNewItemEntry()); // ← solo en pendientes
      this.pendingList.appendChild(frag);
    }

    // Render completadas (sin entrada de nueva tarea)
    {
      const frag = document.createDocumentFragment();
      completed.forEach((item, index) => frag.appendChild(this.#renderItem(item, index)));
      this.completedList.appendChild(frag);
    }
  }


  // Crea un <li> para una tarea
  #renderItem(item, index) {
    // Crea el <li> de la tarea
    // (ajusta clases y habilita arrastre en todo el <li>)
    const li = document.createElement("li");
    li.className = "list-group-item p-1 ps-2 d-flex align-items-center";
    li.setAttribute("draggable", "true"); // ← permite arrastrar el item completo
    li.dataset.id = item.id;

    // --- Botón decorativo de mover ---
    // (avisa al usuario que el item es arrastrable)
    const btnMove = document.createElement("button");
    btnMove.type = "button";
    btnMove.className = "btn app-btn-move";
    btnMove.setAttribute("aria-label", "Move");
    btnMove.title = "Move";
    btnMove.innerHTML = `<i class="bi bi-arrow-down-up"></i>`;
    // (no se registran listeners; es decorativo)

    // --- Bloque form-check con checkbox + label ---
    const form = document.createElement("div");
    form.className = "form-check position-relative flex-grow-1";

    const input = document.createElement("input");
    input.className = "form-check-input";
    input.type = "checkbox";
    input.id = `check-${item.id}`;
    input.checked = !!item.completed; // ← refleja estado

    const label = document.createElement("label");
    label.className = "form-check-label stretched-link";
    label.setAttribute("for", input.id);
    label.textContent = item.text;

    // Inserta input y label dentro del form-check
    form.appendChild(input);
    form.appendChild(label);

    // --- Botón Editar ---
    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    // eleva para evitar overlays (si aplica)
    btnEdit.className = "btn app-btn-edit position-relative z-3 pe-auto";
    btnEdit.setAttribute("aria-label", "Edit");
    btnEdit.title = "Edit";
    btnEdit.innerHTML = `<i class="bi bi-pencil-fill" aria-hidden="true"></i>`;

    // Orden final: [btnMove] [form-check] [btnEdit]
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
    li.draggable = false; // entrada no es arrastrable

    // Entrada de texto para nueva tarea
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.placeholder = "Add new task and press Enter";
    input.setAttribute("aria-label", "Add new task");

    // Botón [+] para agregar tarea
    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn app-btn-add";
    btnAdd.innerHTML = `<i class="bi bi-plus-square-fill fs-3" aria-hidden="true"></i>`;
    btnAdd.title = "Add new task";
    btnAdd.setAttribute("aria-label", "Add new task");

    li.appendChild(input);
    li.appendChild(btnAdd);

    return li;
  }

  // -------- Delegación de eventos de la vista --------

  // Maneja el cambio de checkbox (toggle completed) en ambas listas
  onToggle(handler) {
    // adjunta listener a una UL concreta
    const listen = (ul) => {
      ul.addEventListener("change", (e) => {
        const input = e.target.closest(".form-check-input");
        if (!input) return;

        const li = input.closest("li.list-group-item");
        if (!li || !li.dataset.id) return;

        // determina el destino según el nuevo estado del checkbox
        // (si queda checked → va a Completed; si queda unchecked → va a Pending)
        const goingCompleted = input.checked === true;

        // ejecuta acción de dominio (el Controller moverá el item y re-renderizará)
        handler(li.dataset.id);

        // resalta la Tab de destino (IDs específicos del checklist)
        // (usa IDs sin colisionar con otros componentes en la página)
        const targetTabId = goingCompleted
          ? "checklist-completed-tab"
          : "checklist-pending-tab";

        const targetEl = document.getElementById(targetTabId);
        // dispara el flash si el elemento existe
        if (targetEl) flashCompletedTab(targetEl);
      });
    };

    // registra para ambas listas
    listen(this.pendingList);
    listen(this.completedList);
  }


  // Maneja la edición del texto en ambas listas
  // (click en botón editar → inline editor)
  onEdit(handler) {
    const listen = (ul) => {
      ul.addEventListener("click", (e) => {
        const btn = e.target.closest(".app-btn-edit");
        if (!btn) return;
        const li = btn.closest("li.list-group-item");
        if (!li || !li.dataset.id) return;

        const form = li.querySelector(".form-check");
        const label = form.querySelector("label");
        const currentText = label.textContent.trim();

        // Avoid multiple editors in the same item
        if (form.querySelector("input[type='text']")) return;

        const editor = document.createElement("input");
        editor.type = "text";
        editor.className = "form-control";
        editor.value = currentText;
        editor.setAttribute("aria-label", "Edit task text");

        label.style.display = "none";
        form.appendChild(editor);
        editor.focus();
        // editor.select(); // selecciona el texto de la tarea que se está editando

        // --- Make commit/cancel idempotent ---
        let finished = false; // evita doble ejecución (Enter + blur)

        const finalize = (mode /* 'commit' | 'cancel' */) => {
          // si ya se ejecutó, salir
          if (finished) return;
          finished = true;

          // limpia listeners para evitar fugas
          editor.removeEventListener("keydown", onKeyDown);
          editor.removeEventListener("blur", onBlur);

          // restaura la UI de forma segura
          if (editor.parentNode === form) {
            editor.remove(); // más seguro que removeChild; no lanza si ya no es hijo
          }
          label.style.display = "";

          // sólo notificar cambios si es commit
          if (mode === "commit") {
            const next = editor.value.trim();
            if (next !== currentText) {
              // next puede ser "" → el controller decidirá eliminar
              handler(li.dataset.id, next);
            }
          }
        };

        const onKeyDown = (ke) => {
          if (ke.key === "Enter") finalize("commit");
          else if (ke.key === "Escape") finalize("cancel");
        };

        const onBlur = () => finalize("commit");

        editor.addEventListener("keydown", onKeyDown, { once: false });
        editor.addEventListener("blur", onBlur, { once: true }); // blur sólo una vez
      });
    }
    listen(this.pendingList);
    listen(this.completedList);
  }

  // Maneja creación de nuevas tareas SOLO en pendientes
  onCreate(handler) {
    // Enter en el input (solo en la fila de nueva entrada de pendientes)
    this.pendingList.addEventListener("keydown", (e) => {
      const entry = e.target.closest("li[data-role='new-entry']");
      if (!entry || e.key !== "Enter") return;
      const input = entry.querySelector("input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
      // No enfocamos aquí; el controller lo hará tras el render
    });

    // Click en el botón (solo en pendientes)
    this.pendingList.addEventListener("click", (e) => {
      const entry = e.target.closest("li[data-role='new-entry']");
      if (!entry) return;
      const btn = e.target.closest("button.app-btn-add");
      if (!btn) return;
      const input = entry.querySelector("input[type='text']");
      const text = input.value.trim();
      if (!text) return;
      handler(text);
      // No enfocamos aquí; el controller lo hará tras el render
    });
  }

  // Enfoca el input de nueva tarea SOLO en el tab de pendientes
  focusNewEntryInput() {
    // Busca el input de la fila "nueva tarea" tras el render y aplica foco
    // (trabaja dentro de la lista de pendientes)
    const entry = this.pendingList.querySelector("li[data-role='new-entry'] input[type='text']");
    if (entry) entry.focus({ preventScroll: true });
      // entry.select(); // opcional: selecciona el texto si lo hubiera
  }


  // -------------------------------
  // Drag & Drop (arrastrar y soltar) 
  // -------------------------------
  // Drag & Drop per-list (no cross-tab)
  onReorder(handler) {
    const attachDnD = (ul, key /* 'pending' | 'completed' */) => {
      const state = this.dnd[key];

      ul.addEventListener("dragstart", (e) => {
        const li = e.target.closest("li.list-group-item");
        if (!li || !li.dataset.id || li.dataset.role === "new-entry") return;
        state.draggingId = li.dataset.id;
        li.classList.add("opacity-50");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", state.draggingId);
      });

      ul.addEventListener("dragover", (e) => {
        if (!state.draggingId) return;
        const li = e.target.closest("li.list-group-item");
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
        li.classList.add(before ? ("border-top") : ("border-bottom"));
      });

      ul.addEventListener("dragleave", (e) => {
        const li = e.target.closest("li.list-group-item");
        if (!li) return;
        li.classList.remove("border-top", "border-bottom", "border-primary");
      });

      ul.addEventListener("drop", (e) => {
        if (!state.draggingId) return;
        e.preventDefault();
        const itemsDom = [...ul.querySelectorAll("li.list-group-item[data-id]")];
        let toIndex;
        if (state.overPos === "after-end" || state.overId === null) {
          toIndex = itemsDom.length; // insertar al final
        } else {
          const targetLi = itemsDom.find(li => li.dataset.id === state.overId);
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

  // Limpia marcas visuales de DnD en una UL concreta
  #clearDndMarkers(ul) {
    ul.querySelectorAll("li.list-group-item").forEach(li => {
      li.classList.remove("border-top", "border-bottom", "border-primary", "opacity-50");
    });
  }

  // Limpia estado DnD para una UL concreta
  #clearDndStateFor(ul, state) {
    this.#clearDndMarkers(ul);
    state.draggingId = null;
    state.overId = null;
    state.overPos = null;
  }


  // actualiza el contenedor del resumen de forma segura
  setSummary(text) {
    const box = document.getElementById("summary-container");
    if (!box) return;
    // Usamos textContent para evitar inyección de HTML ya que el input de tareas proviene del usuario
    box.textContent = text || "";
  }

}

// -------------------------------
// Controller
// -------------------------------
class ChecklistController {
  constructor({ root }) {
    // root: elemento contenedor (e.g., document.getElementById('checklist-container'))
    this.model = new ChecklistModel();
    this.view = new ChecklistView(root);

    // --- SUMMARIZER STATE ---
    this.summarizer = null;   // instancia reutilizable
    this.summarizerReady = false;   // bandera de disponibilidad
    this.summarizerInitError = null;  // guarda error (si ocurre)

    // control de creación y resumen
    this.createInFlight = false;   // evita Enter repetidos (duplicados)
    this._summaryDebounce = null;  // debounce para no saturar la API
    this._summaryToken = 0;        // last-write-wins para descartar respuestas viejas

    // bandera para saber si debemos devolver el foco tras el próximo render: 
    this.shouldRefocusNewEntry = false; // se activa sólo al crear una nueva tarea

    // Render inicial
    this.view.render(this.model.getAll());
    // Nota: no intentamos resumir aún; esperamos a la primera interacción del usuario
    this.view.setSummary("Tips: Type tasks and press Enter/OK. Use a gesture (click/Enter) to enable the summary if your browser supports it.");

    // Suscripción a cambios del modelo (optimista: NUNCA await aquí)
    this.model.addEventListener("change", () => {
      this.view.render(this.model.getAll());
      // sólo si venimos de 'add' devolvemos el foco
      if (this.shouldRefocusNewEntry) {
        this.view.focusNewEntryInput();
        this.shouldRefocusNewEntry = false; // consumir bandera
      }
      // Libera el lock de creación después de renderizar
      this.createInFlight = false;

      // Programa el resumen (no bloquea UI)
      this.scheduleSummary();
    });


    // ====== Eventos de vista → acciones ======

    // IMPORTANTE: quitar cualquier 'await' antes de mutar el modelo
    this.view.onCreate((text) => {
      if (this.createInFlight) return;  // evita duplicados por tecleo repetido
      this.createInFlight = true;

      // 1) Mutación optimista (UI responde YA)
      this.shouldRefocusNewEntry = true; // señalamos que se acaba de crear una nueva tarea y, por tanto, hay que enfocar el input para crear otra
      this.model.add(text);

      // 2) Prepara summarizer sin bloquear y agenda resumen
      this.ensureSummarizerOnGesture().then(() => this.scheduleSummary());
    });

    this.view.onToggle((id) => {
      this.model.toggle(id);
      this.ensureSummarizerOnGesture().then(() => this.scheduleSummary());  // gesto del usuario
    });

    this.view.onEdit((id, text) => {
      // Si el texto está vacío, eliminamos la tarea; si no, actualizamos
      if (String(text).trim() === "") this.model.remove(id);
      else this.model.updateText(id, text);
      this.ensureSummarizerOnGesture().then(() => this.scheduleSummary());    // gesto del usuario
    });

    // Reordenamiento por arrastrar y soltar
    this.view.onReorder?.((draggedId, toIndex) => {
      this.model.moveToIndex(draggedId, toIndex);
      this.ensureSummarizerOnGesture().then(() => this.scheduleSummary());
    });
  }


  // ====== Resumen: debounce + last-write-wins ======

  // Programa la ejecución del resumen sin bloquear (debounce ~250ms)
  scheduleSummary() {
    clearTimeout(this._summaryDebounce);
    this._summaryDebounce = setTimeout(() => this._runSummarize(), 250);
  }

  async _runSummarize() {
    const items = this.model.getAll();

    // Token para descartar respuestas antiguas (race-safe)
    const myToken = ++this._summaryToken;

    // Fallback inmediato si no hay soporte o no hay summarizer aún
    if (this.summarizerInitError || !("Summarizer" in self) || !this.summarizer) {
      const basic = this.buildPlainSummary?.(items) || "";
      if (myToken === this._summaryToken) {
        this.view.setSummary?.(basic || "No tasks.");
      }
      return;
    }

    try {
      const input = this.buildSummarizableText(items);
      if (!input.trim()) {
        if (myToken === this._summaryToken) this.view.setSummary?.("No tasks.");
        return;
      }

      console.log("Resumiendo...");
      const result = await this.summarizer.summarize(input, {
        context: "Brief summary in key points."
      });
      console.log("RESUMEN:", result);

      // Solo aplica si este resultado sigue siendo el más reciente
      if (myToken === this._summaryToken) {
        this.view.setSummary?.(result || "No tasks.");
      }
    } catch {
      // Fallback en caso de error de la API
      const basic = this.buildPlainSummary?.(items) || "";
      if (myToken === this._summaryToken) {
        this.view.setSummary?.(basic ? `${basic}\n\n(Basic summary)` : "No tasks.");
      }
    }
  }

  // ====== Summarizer: crear SIN bloquear la UI ======

  async ensureSummarizerOnGesture() {
    // crea el summarizer únicamente tras un gesto del usuario
    // Evita recrear si ya tenemos uno con 'es'
    if (this.summarizer) {
      console.log("Se usará instancia en español existente.")
      return;
    } 
    if (this.summarizerInitError) {
      console.log("summarizerInitError:", this.summarizerInitError);
      return;
    }

    try {
      // 1) Detección de soporte
      if (!("Summarizer" in self)) {
        this.summarizerInitError = new Error('Prueba "Summarizer" in self. Summarizer API not supported.');
        return;
      }

      // 2) Comprobar disponibilidad (puede estar descargable)

      // Opciones deseadas con idioma de salida en español
      const options = {
        // Cf. https://developer.chrome.com/docs/ai/summarizer-api#api-functions
        // type: key-points (default), tldr, teaser, and headline
        // length: short, medium (default), and long
        // format:  markdown (default) and plain-text
        type: 'teaser',
        length: 'short',
        format: 'plain-text',
        outputLanguage: 'es',            // ← idioma requerido
        expectedInputLanguages: ['es'],  // ← opcional, ayuda a la detección
        sharedContext: 'Inspiring and motivating style.',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(`Downloaded ${Math.round(e.loaded * 100)}%`);
          });
        }
      };

      // Comprueba disponibilidad para estas opciones (con idioma)
      const availability = await Summarizer.availability(options); 
      if (availability === 'unavailable') {
        this.summarizerInitError = new Error('Summarizer unavailable for requested language/config.');
        return;
      }

      // 3) Requerir gesto de usuario para crear (API guideline)
      if (!navigator.userActivation.isActive) {
        // No crear sin gesto; salimos silenciosamente
        return;
      }

      // 4) Crear y almacenar instancia con opciones adecuadas
      // Si hay uno previo sin idioma correcto, destrúyelo antes de crear
      if (this.summarizer && this.summarizer.outputLanguage !== 'es') {
        try { this.summarizer.destroy?.(); } catch {}
        this.summarizer = null;
      }
      console.log("Creando instancia de Summarizer...");
      this.summarizer = await Summarizer.create(options); 
      // Bandera de listo (opcional)
      this.summarizerReady = true;
    } catch (err) {
      this.summarizerInitError = err;
      console.log("summarizerInitError:", this.summarizerInitError);
    }
  }

  async updateSummary() {
    // se llama después de CADA render
    const items = this.model.getAll();
    const emptyMsg = "No tasks yet.";

    // 1) Si no hay soporte o error previo, mostramos fallback simple
    if (this.summarizerInitError || !("Summarizer" in self)) {
      const summary = this.buildPlainSummary(items);
      this.view.setSummary(summary || emptyMsg);
      return;
    }

    // 2) Si aún no hemos creado summarizer (sin gesto), usa fallback breve
    if (!this.summarizer) {
      const hint = "(Click/Enter to enable on-device summary if available.)";
      const summary = this.buildPlainSummary(items);
      this.view.setSummary(summary ? `${summary}\n\n${hint}` : `${emptyMsg}\n\n${hint}`);
      return;
    }

    // 3) Tenemos summarizer: generamos texto de entrada y resumimos
    try {
      const input = this.buildSummarizableText(items); // texto base
      if (!input.trim()) {
        this.view.setSummary(emptyMsg);
        return;
      }

      console.log("Elaborando resumen…");
      const result = await this.summarizer.summarize(input, {
        // contexto que ayuda a la intención de salida
        context: "Summarize as concise key points highlighting counts and priorities."
      });

      // result es texto plano (format: 'plain-text'); pintamos seguro
      this.view.setSummary(result || emptyMsg);
      console.log("…RESUMEN:", result);
    } catch (err) {
      // Fallback si algo falla en runtime
      const summary = this.buildPlainSummary(items);
      this.view.setSummary(summary ? `${summary}\n\n(Note: summarizer error)` : emptyMsg);
    }
  }

  buildSummarizableText(items) {
    // construye un bloque de texto con el estado de la lista
    // Ejemplo:
    // Todo List (3 items; 1 completed)
    // - [ ] Buy milk
    // - [x] Send report
    // - [ ] Book flights
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    const lines = [
      `Todo List (${total} items; ${done} completed)`,
      ...items.map(i => `- [${i.completed ? "x" : " "}] ${i.text}`)
    ];
    return lines.join("\n");
  }

  buildPlainSummary(items) {
    // Basic summary sin IA (por si la API no existe)
    if (!items.length) return "";
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    const pending = total - done;
    const top3 = items
      .filter(i => !i.completed)
      .slice(0, 3)
      .map(i => `• ${i.text}`)
      .join("\n");
    const parts = [
      `Tasks: ${total}  |  Done: ${done}  |  Pending: ${pending}`,
      top3 ? `Next up:\n${top3}` : ""
    ].filter(Boolean);
    return parts.join("\n");
  }  
}


// -------------------------------
// Helpers
// -------------------------------

// Resalta brevemente un elemento usando las transiciones existentes (Bootstrap)
// - Cancela un flash anterior si aún estaba activo (evita quedarse resaltado)
// - No toca las transiciones CSS; solo cambia backgroundColor inline
// el: HTMLElement → elemento a resaltar
// color: string → color del flash (por defecto #f5d9ab)
// holdMs: number → tiempo "en color" antes de iniciar la vuelta (por defecto 250ms)
// backMs: number → tiempo hasta limpiar el inline, permitiendo que la transición haga su trabajo (por defecto 250ms)
function flashCompletedTab(el, color = "#f5d9ab", holdMs = 800, backMs = 250) {
  // valida elemento
  if (!el || !(el instanceof HTMLElement)) return;

  // si había un flash previo, cancelarlo y restaurar estado anterior
  // (evita solapamientos que dejan el botón pegado en estado resaltado)
  if (el.__flashTimerHold) clearTimeout(el.__flashTimerHold);
  if (el.__flashTimerBack) clearTimeout(el.__flashTimerBack);
  if (el.__flashPrevBg !== undefined) {
    // restaura el inline previo del flash anterior
    el.style.backgroundColor = el.__flashPrevBg || "";
  }

  // guarda el valor inline previo para restaurarlo al final
  el.__flashPrevBg = el.style.backgroundColor || "";

  // fuerza un reflow para que una nueva asignación dispare transición consistentemente
  void el.offsetWidth; // ← fuerza reflow

  // aplica color del flash (Bootstrap manejará la transición si existe)
  el.style.backgroundColor = color;

  // tras un pequeño "hold", iniciar la vuelta al color previo
  el.__flashTimerHold = setTimeout(() => {
    // fuerza reflow antes de volver para asegurar la transición de salida
    void el.offsetWidth; // ← fuerza reflow

    // asigna el color previo ("" si no había inline), dejando que CSS haga el fade
    el.style.backgroundColor = el.__flashPrevBg || "";

    // limpieza final: eliminar marcas internas tras un margen
    el.__flashTimerBack = setTimeout(() => {
      // borra referencias internas
      delete el.__flashTimerHold;
      delete el.__flashTimerBack;
      delete el.__flashPrevBg;
    }, backMs);
  }, holdMs);
}



// -------------------------------
// Boot
// -------------------------------
// Inicializa el controlador usando el contenedor dado por el HTML de la consigna.
// Asegúrate de ejecutar esto después de que el DOM esté listo.
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("checklist-container");
  if (!container) return;
  new ChecklistController({ root: container });
});
