let io = null;

export function setIO(instance) {
  io = instance;
}

export function emit(event, payload) {
  if (io) io.emit(event, payload);
}
