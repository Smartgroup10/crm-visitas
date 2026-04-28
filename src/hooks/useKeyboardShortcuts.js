import { useEffect } from "react";

/**
 * Atajos de teclado globales.
 *
 * Convención: los atajos "de un solo carácter" (N, G, /, 1, 2, 3, ?) solo
 * disparan cuando el foco NO está en un input/textarea/select/contenteditable.
 * Escape, Cmd/Ctrl+K se procesan siempre (cerrar modales o abrir el
 * command palette aunque estés escribiendo).
 *
 * Handlers soportados:
 *  - onNew             → crear nueva tarea (N)
 *  - onSearchFocus     → poner foco en búsqueda del topbar (/)
 *  - onCommandPalette  → abrir command palette (Cmd/Ctrl + K)
 *  - onGoToday         → ir al día de hoy (G)
 *  - onCalendarMode(mode) → cambiar modo calendario: 1=mes, 2=semana, 3=dia
 *  - onHelp            → abrir ayuda de atajos (? o Shift+/)
 *  - onEscape          → cerrar modales
 *
 * Nota histórica: antes Cmd+K hacía onSearchFocus (mismo comportamiento
 * que `/`). Ahora con la introducción del command palette, Cmd+K abre
 * la paleta global; `/` sigue enfocando la búsqueda del topbar — son
 * casos de uso distintos: búsqueda contextual vs. comando global.
 */
export function useKeyboardShortcuts({
  onNew,
  onSearchFocus,
  onCommandPalette,
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

      // Ctrl/Cmd + K abre la paleta de comandos (búsqueda global +
      // navegación). Funciona aunque estés escribiendo en un input —
      // es la convención universal (Linear, Notion, Slack…).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onCommandPalette?.(e);
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
  }, [onNew, onSearchFocus, onCommandPalette, onGoToday, onCalendarMode, onHelp, onEscape]);
}
