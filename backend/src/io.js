// ============================================================
// Wrapper alrededor de la instancia de Socket.io
// ============================================================
// Centraliza el acceso al `io` para que módulos sin acceso directo (workers,
// helpers de notificaciones, etc.) puedan emitir eventos sin importar
// `index.js` (que crearía un ciclo).
//
// Dos canales:
//  - `emit(event, payload)`            → broadcast a TODOS los clientes
//    conectados. Lo usamos para `tasks:change`, `clients:change`, etc.
//  - `emitToUser(userId, event, ...)`  → solo al usuario concreto. Cada
//    socket se une a su sala `user:<uuid>` en el handshake (ver index.js),
//    así un usuario con varias pestañas las recibe todas a la vez.
// ============================================================

let io = null;

export function setIO(instance) {
  io = instance;
}

export function emit(event, payload) {
  if (io) io.emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  // `to(...)` filtra a la sala. Si el usuario no tiene sockets activos
  // (sesión cerrada o app no abierta) la emisión simplemente no llega
  // — no hay error: socket.io descarta el envío sin más.
  io.to(`user:${userId}`).emit(event, payload);
}
