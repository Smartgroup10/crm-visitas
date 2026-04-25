import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "crm_theme";

/**
 * Hook de tema (claro/oscuro).
 *
 * El tema se aplica ANTES de que React monte (ver script inline en index.html)
 * para evitar el flash blanco al recargar en modo oscuro. Este hook se limita
 * a leer/escribir la preferencia y a sincronizar el atributo `data-theme` del
 * <html> cuando el usuario lo cambia desde la UI.
 *
 * Devuelve `{ theme, toggleTheme, setTheme }`.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") || "light";
  });

  const setTheme = useCallback((next) => {
    if (next !== "light" && next !== "dark") return;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage bloqueado (modo privado, etc.): no es bloqueante */
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Si el SO cambia entre claro y oscuro Y el usuario nunca ha tocado el
  // toggle (no hay clave en localStorage), seguimos al SO. Si hay preferencia
  // explícita, la respetamos pase lo que pase.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return;
      setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [setTheme]);

  return { theme, toggleTheme, setTheme };
}
