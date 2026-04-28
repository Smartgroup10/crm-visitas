import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Paleta de comandos / búsqueda global (Cmd+K).
 *
 * Inspirado en Linear / Notion / Slack. Una sola superficie en la que
 * el usuario puede:
 *   1. Buscar en TODA la app: tareas (por título, cliente, técnico),
 *      clientes (por nombre), miembros del equipo (por nombre).
 *   2. Lanzar acciones rápidas: crear tarea, ir a otra sección,
 *      cambiar tema.
 *
 * Patrón de UX:
 *   - Empieza con un input grande arriba ya enfocado.
 *   - Sin query: mostramos quick actions + secciones de la app.
 *   - Con query: filtramos resultados por categorías (Tareas,
 *     Clientes, Equipo, Acciones).
 *   - Navegación entre resultados con ↑↓.
 *   - Enter ejecuta el item seleccionado.
 *   - Esc cierra el palette.
 *   - Click fuera cierra.
 *
 * Filtrado puramente client-side: las listas de tasks/clients/users
 * ya están en memoria de la app — no hace falta tocar el backend.
 */

// Acciones rápidas que aparecen en la paleta. El `getter()` produce
// el objeto final con `action` enlazada a los handlers reales (que
// no tenemos aquí — los inyectamos via props).
const QUICK_ACTION_DEFS = [
  { id: "new-task",   label: "Crear nueva tarea",   icon: "+",  hotkey: "N",  needsManage: true,
    runner: (props) => props.onNewTask?.() },
  { id: "go-inicio",  label: "Ir a · Inicio",                     section: "inicio" },
  { id: "go-mitrabajo",label:"Ir a · Mi trabajo",                 section: "mitrabajo" },
  { id: "go-segui",   label: "Ir a · Seguimiento",                section: "instalaciones" },
  { id: "go-clientes",label: "Ir a · Clientes",                   section: "clientes" },
  { id: "go-equipo",  label: "Ir a · Equipo",                     section: "usuarios" },
  { id: "go-informes",label: "Ir a · Informes",                   section: "informes" },
  { id: "toggle-theme", label: "Cambiar tema (claro/oscuro)",     runner: (props) => props.onToggleTheme?.() },
  { id: "open-prefs",   label: "Abrir mis preferencias",          runner: (props) => props.onOpenPrefs?.() },
];

function buildQuickActions(props) {
  return QUICK_ACTION_DEFS
    .filter((a) => !a.needsManage || props.canManage)
    .map((a) => ({
      ...a,
      run: () => {
        if (a.runner)       a.runner(props);
        else if (a.section) props.onNavigate?.(a.section);
      },
    }));
}

// Helpers de búsqueda — una sola pasada lowercase + includes. Para
// los volúmenes esperados (cientos de tareas como mucho) es más que
// suficiente sin tocar el backend.
function matches(haystack, q) {
  if (!q) return true;
  return String(haystack || "").toLowerCase().includes(q);
}

function clientNameOf(task, clients) {
  const c = clients.find((x) => x.id === task.clientId);
  return c?.name || "";
}

function technicianNamesOf(task, technicians) {
  return (task.technicianIds || [])
    .map((tid) => technicians.find((t) => t.id === tid)?.name || "")
    .filter(Boolean)
    .join(" ");
}

export default function CommandPalette({
  open,
  onClose,
  tasks = [],
  clients = [],
  technicians = [],
  canManage,
  onNewTask,
  onNavigate,
  onOpenTask,
  onOpenClient,
  onToggleTheme,
  onOpenPrefs,
}) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // Reset estado al abrir/cerrar.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Pequeño delay: si ponemos focus síncronamente, algunos
      // navegadores no lo aplican porque el modal aún no es visible.
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Bloqueo de scroll mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Genera los grupos de resultados según la query actual. useMemo
  // porque las listas pueden ser grandes y no queremos recomputar en
  // cada keypress de las flechas.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const allActions = buildQuickActions({
      canManage, onNewTask, onNavigate, onToggleTheme, onOpenPrefs,
    });
    const actionMatches = q
      ? allActions.filter((a) => matches(a.label, q))
      : allActions;

    const out = [];

    // Acciones rápidas SIEMPRE primero. Si hay query y ninguna
    // matchea, omitimos la sección.
    if (actionMatches.length > 0) {
      out.push({
        id: "actions",
        title: q ? "Acciones" : "Atajos rápidos",
        items: actionMatches.map((a) => ({
          kind: "action",
          id:    a.id,
          label: a.label,
          icon:  a.icon || "⌘",
          hotkey: a.hotkey,
          run:   a.run,
        })),
      });
    }

    // Sin query y con todas las acciones visibles, paramos: mostrar
    // tareas/clientes sin filtro saturaría la lista.
    if (!q) return out;

    // Tareas: match por título, cliente o técnico. Limitamos a 8.
    const taskMatches = tasks
      .filter((t) =>
        matches(t.title, q) ||
        matches(clientNameOf(t, clients), q) ||
        matches(technicianNamesOf(t, technicians), q)
      )
      .slice(0, 8);
    if (taskMatches.length > 0) {
      out.push({
        id: "tasks",
        title: "Tareas",
        items: taskMatches.map((t) => ({
          kind:  "task",
          id:    t.id,
          label: t.title || "Sin título",
          sub:   [
            clientNameOf(t, clients),
            t.date ? formatDate(t.date) : null,
            t.startTime || null,
          ].filter(Boolean).join(" · "),
          run: () => onOpenTask?.(t.id),
        })),
      });
    }

    // Clientes: match por nombre. Limitamos a 5.
    const clientMatches = clients
      .filter((c) => matches(c.name, q))
      .slice(0, 5);
    if (clientMatches.length > 0) {
      out.push({
        id: "clients",
        title: "Clientes",
        items: clientMatches.map((c) => ({
          kind:  "client",
          id:    c.id,
          label: c.name,
          sub:   countTasksFor(tasks, c.id) + " tareas",
          run:   () => onOpenClient?.(c.id),
        })),
      });
    }

    // Equipo: match por nombre. Limitamos a 5. Click filtra el
    // seguimiento por ese técnico (de momento; podríamos abrir
    // detalle del usuario en el futuro).
    const techMatches = technicians
      .filter((u) => matches(u.name, q) || matches(u.email, q))
      .slice(0, 5);
    if (techMatches.length > 0) {
      out.push({
        id: "team",
        title: "Equipo",
        items: techMatches.map((u) => ({
          kind:  "tech",
          id:    u.id,
          label: u.name || u.email,
          sub:   u.email && u.name !== u.email ? u.email : "",
          run:   () => onNavigate?.("usuarios"),
        })),
      });
    }

    return out;
  }, [query, tasks, clients, technicians, canManage, onNewTask, onNavigate, onOpenTask, onOpenClient, onToggleTheme, onOpenPrefs]);

  // Aplanamos los items para indexar el resaltado vertical.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Mantener `selected` en rango cuando cambia el filtrado.
  useEffect(() => {
    if (selected >= flat.length) setSelected(Math.max(0, flat.length - 1));
  }, [flat.length, selected]);

  // Auto-scroll del item seleccionado dentro de la lista.
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-cmd-item]");
    items[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[selected];
      if (item) {
        item.run?.();
        onClose?.();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  }

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Búsqueda y comandos">
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <svg className="cmd-search-icon" width="16" height="16" viewBox="0 0 20 20"
               fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6"/>
            <path d="M13.5 13.5L17 17" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Buscar tareas, clientes, técnicos…  o ejecutar una acción"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            aria-autocomplete="list"
          />
          <kbd className="cmd-input-kbd" aria-hidden="true">esc</kbd>
        </div>

        <div className="cmd-results" ref={listRef}>
          {flat.length === 0 ? (
            <div className="cmd-empty">
              No se encontró nada para "{query}"
            </div>
          ) : (
            groups.map((group) => {
              // Calculamos el offset acumulado de items previos para
              // poder marcar el seleccionado correctamente.
              const startIdx = groups
                .slice(0, groups.indexOf(group))
                .reduce((acc, g) => acc + g.items.length, 0);
              return (
                <div key={group.id} className="cmd-group">
                  <div className="cmd-group-title">{group.title}</div>
                  <ul className="cmd-list" role="listbox">
                    {group.items.map((item, i) => {
                      const idx = startIdx + i;
                      const isSelected = idx === selected;
                      return (
                        <li
                          key={`${item.kind}-${item.id}`}
                          data-cmd-item
                          role="option"
                          aria-selected={isSelected}
                          className={`cmd-item ${isSelected ? "is-selected" : ""}`}
                          onMouseEnter={() => setSelected(idx)}
                          onClick={() => { item.run?.(); onClose?.(); }}
                        >
                          <span className={`cmd-item-icon cmd-item-icon-${item.kind}`}>
                            {iconFor(item)}
                          </span>
                          <span className="cmd-item-body">
                            <span className="cmd-item-label">{item.label}</span>
                            {item.sub && <span className="cmd-item-sub">{item.sub}</span>}
                          </span>
                          {item.hotkey && (
                            <kbd className="cmd-item-kbd">{item.hotkey}</kbd>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className="cmd-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function countTasksFor(tasks, clientId) {
  return tasks.filter((t) => t.clientId === clientId).length;
}

function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function iconFor(item) {
  if (item.icon) return item.icon;
  if (item.kind === "task")   return "📋";
  if (item.kind === "client") return "🏢";
  if (item.kind === "tech")   return "👤";
  if (item.kind === "action") return "⚡";
  return "•";
}
