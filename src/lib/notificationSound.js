/**
 * Pitido suave de notificación generado en tiempo real con Web Audio API.
 *
 * Por qué generarlo en lugar de cargar un .mp3:
 *  - Sin assets binarios en el repo / bundle.
 *  - Funciona offline.
 *  - Es muy corto (≈250 ms) y agradable: dos notas senoidales con
 *    decaimiento exponencial, tipo "ding" sutil. Ni intrusivo ni cómico.
 *
 * Política del navegador: Web Audio sólo arranca tras un gesto del usuario.
 * Como nuestras notificaciones se disparan tras una interacción previa
 * (activar permiso, crear recordatorio…), normalmente el AudioContext ya
 * está autorizado. Si no, simplemente no suena — silencioso es preferible
 * a un error en consola.
 */

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Reproduce el pitido. No hace nada si el AudioContext no está disponible
 * o si el usuario aún no ha interactuado con la página.
 */
export function playNotificationSound() {
  const audio = getCtx();
  if (!audio) return;
  // Si está en estado "suspended" (política autoplay), pedimos resume.
  // Si rechaza, fallamos en silencio.
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  master.connect(audio.destination);

  // Dos notas: una más aguda que decae rápido (ataque) y una más grave
  // que sostiene, para sonar a "ding" no agresivo. Frecuencias elegidas
  // a oído (Sol5 + Mi5 aproximadamente).
  const notes = [
    { freq: 880, delay: 0, dur: 0.18 },
    { freq: 660, delay: 0.07, dur: 0.30 },
  ];
  for (const n of notes) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.freq, now + n.delay);
    const env = audio.createGain();
    env.gain.setValueAtTime(0.0001, now + n.delay);
    env.gain.exponentialRampToValueAtTime(1, now + n.delay + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);
    osc.connect(env).connect(master);
    osc.start(now + n.delay);
    osc.stop(now + n.delay + n.dur + 0.02);
  }
}
