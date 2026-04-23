import { createContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";
import { disconnectSocket } from "../lib/socket";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Cierra la sesión localmente (se usa tanto en logout manual como al recibir 401).
  const doLogout = useCallback(() => {
    clearToken();
    disconnectSocket();
    setUser(null);
  }, []);

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

  // Mantenemos `profile` en el contexto para no tener que tocar los consumidores
  // existentes: en este backend el perfil y el usuario son lo mismo.
  return (
    <AuthContext.Provider value={{ user, profile: user, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
