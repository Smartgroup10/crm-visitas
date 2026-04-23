// Pequeño wrapper sobre fetch para hablar con el backend.
// - Usa `/api` como base (en prod el nginx hace proxy; en dev Vite también).
// - Guarda el JWT en localStorage.
// - En caso de 401 limpia el token para forzar re-login.

const API_BASE  = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "crm_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else       localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token   = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Token inválido/expirado → forzamos logout
    clearToken();
    // Avisamos a la app para que vuelva a la pantalla de login
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new Error("No autorizado");
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* body vacío o no-JSON */ }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:    (path)        => request("GET",    path),
  post:   (path, body)  => request("POST",   path, body),
  put:    (path, body)  => request("PUT",    path, body),
  patch:  (path, body)  => request("PATCH",  path, body),
  delete: (path)        => request("DELETE", path),
};
