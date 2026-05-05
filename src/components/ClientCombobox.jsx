import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Combobox de cliente para el TaskModal.
 *
 * Por qué no un `<select>` nativo: con 1000+ clientes, el desplegable
 * nativo te obliga a scrollear sin ayuda. La búsqueda nativa por
 * teclado del browser es type-ahead simple (matches con el primer
 * carácter), inútil cuando todos los clientes empiezan por similar.
 *
 * Comportamiento:
 *   - Trigger: botón estilo select, muestra el cliente seleccionado.
 *   - Click → abre el panel con input de búsqueda + lista filtrada.
 *   - Filtra en vivo por nombre, CIF o ciudad (todos los datos
 *     identificativos del cliente).
 *   - Teclado: ArrowDown/Up para navegar, Enter para seleccionar,
 *     Escape para cerrar.
 *   - Click fuera del panel → cierra.
 *   - Mantiene la opción resaltada visible (scrollIntoView).
 *
 * Accesibilidad: marcamos role="combobox" + aria-expanded en el
 * trigger, role="listbox" en la lista, role="option" en cada opción,
 * y aria-selected para el cliente seleccionado actualmente. Mínimo
 * viable — un screen reader lo lee como combobox.
 */

const NO_MATCH = "Sin resultados";

export default function ClientCombobox({
  value,
  onChange,
  clients,
  disabled,
  hasError,
  placeholder = "Selecciona cliente",
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => (clients || []).find((c) => c.id === value) || null,
    [clients, value]
  );

  // Filtrado en vivo. La normalización lowercase es suficiente para
  // español; tildes con tildes coinciden, sin tildes coincide con sin
  // tildes — si quisiéramos match insensible a tildes habría que
  // normalize('NFD') ambos lados, pero añade complejidad sin gran
  // beneficio dada la calidad de los datos del Excel.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients || [];
    return (clients || []).filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.cif || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q)
      );
    });
  }, [clients, query]);

  // Click fuera del wrapper → cerrar. Captura mousedown (no click)
  // para que cerrar y procesar el click externo ocurran en el orden
  // correcto sin parpadeos.
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Mantén la opción resaltada visible cuando se navega con teclado.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  function pick(client) {
    onChange?.(client?.id || "");
    setOpen(false);
  }

  /**
   * Abre el panel con state limpio. Hacerlo aquí (en el handler del
   * click) en vez de en un useEffect dependiente de `open` evita el
   * patrón "setState en effect" que React 19 desaconseja, y mantiene
   * la lógica de "abrir = limpiar" donde ocurre el evento. */
  function openPanel() {
    setQuery("");
    setHighlightIdx(0);
    setOpen(true);
    // El input aún no existe en el DOM en este tick — diferimos el
    // focus al siguiente.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function toggle() {
    if (disabled) return;
    if (open) setOpen(false);
    else openPanel();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (filtered.length === 0 ? 0 : Math.min(filtered.length - 1, i + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[highlightIdx];
      if (c) pick(c);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      // Tab cierra el panel pero no consume — el foco va al siguiente
      // control natural del form.
      setOpen(false);
    }
  }

  function clear(e) {
    e.stopPropagation();
    onChange?.("");
  }

  const triggerClass = [
    "client-combobox-trigger",
    open ? "is-open" : "",
    hasError ? "has-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`client-combobox ${open ? "is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={triggerClass}
        onClick={toggle}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id ? `${id}-listbox` : undefined}
      >
        <span className={selected ? "client-combobox-value" : "client-combobox-placeholder"}>
          {selected ? selected.name : placeholder}
        </span>
        {selected && !disabled && (
          <span
            className="client-combobox-clear"
            onClick={clear}
            role="button"
            aria-label="Limpiar selección"
            title="Limpiar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
        )}
        <svg className="client-combobox-chevron" width="14" height="14"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="client-combobox-panel">
          <div className="client-combobox-search">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                 stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlightIdx(0); }}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nombre, CIF o ciudad…"
              autoComplete="off"
              spellCheck="false"
              aria-autocomplete="list"
              aria-controls={id ? `${id}-listbox` : undefined}
              aria-activedescendant={
                filtered[highlightIdx] && id
                  ? `${id}-opt-${filtered[highlightIdx].id}`
                  : undefined
              }
            />
            <span className="client-combobox-count">
              {filtered.length}
            </span>
          </div>
          <ul
            className="client-combobox-list"
            ref={listRef}
            role="listbox"
            id={id ? `${id}-listbox` : undefined}
          >
            {filtered.length === 0 ? (
              <li className="client-combobox-empty">{NO_MATCH}</li>
            ) : (
              filtered.map((c, i) => (
                <li
                  key={c.id}
                  id={id ? `${id}-opt-${c.id}` : undefined}
                  data-idx={i}
                  className={[
                    "client-combobox-option",
                    i === highlightIdx ? "is-highlight" : "",
                    c.id === value ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  role="option"
                  aria-selected={c.id === value}
                  // mousedown.preventDefault evita que el click haga blur
                  // del input antes de que ejecutemos pick().
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  <span className="client-combobox-option-name">{c.name}</span>
                  {(c.cif || c.city) && (
                    <span className="client-combobox-option-meta">
                      {[c.cif, c.city].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
