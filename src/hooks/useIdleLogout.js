import { useEffect } from "react";

/**
 * Hook de "cierre por inactividad" (idle timeout).
 *
 * Vigila la actividad del usuario en la ventana (click, tecla, scroll,
 * touch, movimiento de ratón) y cuando lleva `timeoutMs` sin nada
 * dispara `onTimeout`. Opcionalmente puede disparar también un
 * `onWarning` a `warningMs` (por ejemplo: aviso 1 min antes del corte).
 *
 * Decisiones de diseño:
 *
 *   - `mousemove` se incluye porque el usuario que está leyendo o
 *     pensando frente a la pantalla suele mover el ratón ligeramente
 *     y se considera "presente". Pero como dispara 60+ veces/seg,
 *     hacemos throttle de 1 segundo: si pasó menos de 1 s desde el
 *     último reset, ignoramos el evento. Cargas innecesarias < 1 s
 *     son imperceptibles para un timeout de minutos.
 *
 *   - NO escuchamos `visibilitychange`. Cuando la pestaña pasa a
 *     background, el timer SIGUE corriendo — el usuario no está
 *     mirando, así que debe contar como inactividad. Si pausásemos
 *     en background el usuario podría tener la pestaña abierta días
 *     y nunca cerrar sesión (rompe la propia razón del idle timeout).
 *
 *   - El throttle del `mousemove` no afecta a clicks/teclas — esos
 *     pasan por otra rama del listener y resetean inmediatamente.
 *
 *   - El hook NO se acopla a auth ni toasts. Solo dispara callbacks.
 *     El componente que lo usa decide qué hacer (logout, mostrar
 *     toast, etc.). Mantenerlo así permite reutilizar.
 */

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
];

const MOUSEMOVE_THROTTLE_MS = 1000;

export function useIdleLogout({
  timeoutMs,
  warningMs,
  onTimeout,
  onWarning,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return;
    if (!timeoutMs || timeoutMs <= 0) return;

    let timeoutId;
    let warningId;
    let lastResetAt = Date.now();

    const reset = (e) => {
      // Throttle exclusivo para mousemove. Click/teclado/touch siempre
      // resetea inmediatamente — son actividad clara.
      if (e && e.type === "mousemove") {
        const now = Date.now();
        if (now - lastResetAt < MOUSEMOVE_THROTTLE_MS) return;
        lastResetAt = now;
      } else {
        lastResetAt = Date.now();
      }

      clearTimeout(timeoutId);
      clearTimeout(warningId);

      // Aviso opcional unos segundos antes del corte definitivo.
      // Si onWarning lanza un toast, el usuario tiene margen para
      // mover el ratón / pulsar algo y resetear el timer.
      if (warningMs && warningMs < timeoutMs && onWarning) {
        warningId = setTimeout(onWarning, warningMs);
      }
      timeoutId = setTimeout(onTimeout, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, reset, { passive: true })
    );
    // Arrancamos el contador desde el momento del montaje (login),
    // no esperamos al primer evento.
    reset();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, reset)
      );
    };
  }, [timeoutMs, warningMs, onTimeout, onWarning, enabled]);
}
