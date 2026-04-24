import { useEffect } from "react";

/**
 * Atajos de teclado globales.
 *
 * Convención: los atajos "de un solo carácter" (N, G, /, 1, 2, 3, ?) solo
 * disparan cuando el foco NO está en un input/textarea/select/contenteditable.
 * Escape se procesa siempre (para cerrar modales desde dentro de inputs).
 *
 * Handlers soportados:
 *  - onNew         → crear nueva tarea (N)
 *  - onSearchFocus → poner foco en búsqueda (/ o Ctrl/Cmd+K)
 *  - onGoToday     → ir al día de hoy (G)
 *  - onCalendarMode(mode) → cambiar modo calendario: 1=mes, 2=semana, 3=dia
 *  - onHelp        → abrir ayuda de atajos (? o Shift+/)
 *  - onEscape      → cerrar modales
 */
export function useKeyboardShortcuts({
  onNew,
  onSearchFocus,
  onGoToday,
  onCalendarMode,
  onHelp,
  onEscape,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName;
      const isTypingTarget =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        e.target?.isContentEditable;

      // Escape se procesa siempre (cerrar modales estando en un input, etc.)
      if (e.key === "Escape") {
        onEscape?.(e);
        return;
      }

      // Ctrl/Cmd + K enfoca la búsqueda (funciona también escribiendo, útil
      // cuando el usuario está en otro input y quiere saltar a buscar).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearchFocus?.(e);
        return;
      }

      if (isTypingTarget) return;

      // `?` abre la ayuda. En teclados ES/EN el "?" llega como Shift+/,
      // aceptamos ambas formas.
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onHelp?.(e);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        onSearchFocus?.(e);
        return;
      }

      const k = e.key.toLowerCase();

      if (k === "n") {
        e.preventDefault();
        onNew?.(e);
        return;
      }

      if (k === "g") {
        e.preventDefault();
        onGoToday?.(e);
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        onCalendarMode?.("mes", e);
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        onCalendarMode?.("semana", e);
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        onCalendarMode?.("dia", e);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNew, onSearchFocus, onGoToday, onCalendarMode, onHelp, onEscape]);
}
