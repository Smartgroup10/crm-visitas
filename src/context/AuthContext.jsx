/* eslint-disable react-refresh/only-export-components --
 * Context + Provider conviven en este archivo a propósito (patrón
 * estándar React). El coste es perder fast-refresh granular al
 * editar este archivo concreto — irrelevante en práctica porque
 * casi nunca se toca. */
import { createContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";
import { disconnectSocket } from "../lib/socket";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { useToast } from "../hooks/useToast";

// Duraciones del idle timeout. Si en algún momento se quieren mover
// a preferencias por usuario o env vars, este es el punto único.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;          // 10 min sin actividad → logout
const IDLE_WARNING_MS = 9 * 60 * 1000;           // a los 9 min → aviso para que el usuario pueda quedarse

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const toast = useToast();

  // Cierra la sesión localmente (se usa tanto en logout manual como al recibir 401).
  const doLogout = useCallback(() => {
    clearToken();
    disconnectSocket();
    setUser(null);
  }, []);

  // ─── Idle timeout ────────────────────────────────────
  // Tras 10 min de inactividad (sin click/tecla/scroll/touch/
  // mousemove), cerramos sesión. A los 9 min mostramos un toast
  // de aviso para que el usuario pueda "tocar" la pantalla y
  // resetear el contador sin perder lo que estuviera haciendo.
  //
  // El hook sólo se activa cuando hay sesión iniciada (enabled =
  // !!user). En la pantalla de login no hace nada.
  const handleIdleWarning = useCallback(() => {
    toast.info(
      "Tu sesión se cerrará en 1 minuto por inactividad. Toca la pantalla para mantenerla abierta."
    );
  }, [toast]);

  const handleIdleLogout = useCallback(() => {
    doLogout();
    toast.info("Sesión cerrada por inactividad. Vuelve a iniciar sesión.");
  }, [doLogout, toast]);

  useIdleLogout({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onTimeout: handleIdleLogout,
    onWarning: handleIdleWarning,
    enabled:   !!user,
  });

  useEffect(() => {
    // Al arrancar: si hay token en localStorage, intentamos recuperar el usuario.
    async function restore() {
      if (!getToken()) {
        setAuthLoading(false);
        return;
      }
      try {
        const me = await api.get("/auth/me");
        setUser(me);
      } catch {
        // Token inválido/expirado → fuera
        doLogout();
      } finally {
        setAuthLoading(false);
      }
    }
    restore();

    // Si cualquier request recibe 401, el wrapper dispara este evento.
    const onUnauthorized = () => doLogout();
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [doLogout]);

  async function login(email, password) {
    const { token, user: u } = await api.post("/auth/login", { email, password });
    setToken(token);
    setUser(u);
    return u;
  }

  async function logout() {
    doLogout();
  }

  // Hace merge de los campos devueltos por el backend (p.ej. tras actualizar
  // preferencias) con el `user` actual, para que la UI vea los cambios sin
  // necesidad de re-llamar a /auth/me.
  const updateProfile = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Mantenemos `profile` en el contexto para no tener que tocar los consumidores
  // existentes: en este backend el perfil y el usuario son lo mismo.
  return (
    <AuthContext.Provider
      value={{ user, profile: user, authLoading, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
