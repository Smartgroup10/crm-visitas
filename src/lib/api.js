// Pequeño wrapper sobre fetch para hablar con el backend.
// - Usa `/api` como base (en prod el nginx hace proxy; en dev Vite también).
// - Guarda el JWT en localStorage.
// - En caso de 401 limpia el token para forzar re-login.
// - Cuando el backend devuelve un 4xx con `{ error, details: [...] }`
//   (respuesta típica del middleware de validación con zod), envolvemos
//   todo en ApiError para que el caller pueda mostrar errores por campo.

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

/**
 * Error enriquecido con la respuesta del backend. Expone:
 *  - status: código HTTP
 *  - details: lista cruda de `{ path, message }` tal y como la emite zod
 *    (o undefined si el backend no la incluyó)
 *  - fieldErrors: mismo info pero en forma { campo: mensaje } para pintar
 *    errores al lado de cada input
 */
export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message || "Error del servidor");
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.fieldErrors = Array.isArray(details)
      ? details.reduce((acc, d) => {
          if (d?.path) acc[d.path] = d.message;
          return acc;
        }, {})
      : {};
  }
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token   = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Fallo de red: DNS, offline, CORS preflight caído, etc.
    throw new ApiError("Sin conexión con el servidor", { status: 0 });
  }

  if (res.status === 401) {
    // Token inválido/expirado → forzamos logout
    clearToken();
    // Avisamos a la app para que vuelva a la pantalla de login
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new ApiError("No autorizado", { status: 401 });
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let details;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      if (Array.isArray(data?.details)) details = data.details;
    } catch { /* body vacío o no-JSON */ }
    throw new ApiError(message, { status: res.status, details });
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
