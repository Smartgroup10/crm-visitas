import { useEffect } from "react";

export function useKeyboardShortcuts({ onNew, onSearchFocus, onEscape }) {
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName;
      const isTypingTarget =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        e.target?.isContentEditable;

      if (e.key === "Escape") {
        onEscape?.(e);
        return;
      }

      if (isTypingTarget) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNew?.(e);
      }

      if (e.key === "/") {
        e.preventDefault();
        onSearchFocus?.(e);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNew, onSearchFocus, onEscape]);
}
