// Cliente de Socket.io compartido.
// - Se conecta al mismo origen (el nginx hace proxy de /socket.io al backend).
// - En desarrollo Vite también tiene proxy de /socket.io configurado.
// - Manda el JWT en el handshake para que el backend autentique la conexión.

import { io } from "socket.io-client";
import { getToken } from "./api";

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;

  const base = import.meta.env.VITE_API_URL
    ? new URL(import.meta.env.VITE_API_URL).origin
    : undefined; // undefined → mismo origen que la web

  socket = io(base, {
    path: "/socket.io",
    auth: { token: getToken() },
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
