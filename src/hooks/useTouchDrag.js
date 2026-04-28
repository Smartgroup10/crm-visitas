import { useEffect, useRef } from "react";

/**
 * Drag-and-drop por touch (móviles / tablets) implementado a mano
 * porque los eventos HTML5 `dragstart` / `drop` NO se disparan con
 * touch en iOS/Android. Sin esto, supervisores que planifican desde
 * iPad no pueden mover tareas en el calendario.
 *
 * Mecánica:
 *   1. touchstart en el elemento → arrancamos un timer de long-press
 *      (~350 ms). Si el dedo se levanta antes, era un tap normal.
 *   2. Si el long-press se cumple, marcamos `isDragging` y pintamos
 *      la pill con clase `is-touch-dragging` para feedback visual.
 *   3. touchmove con isDragging activo → preventDefault (evita el
 *      scroll de la página) y `document.elementFromPoint` para
 *      averiguar sobre qué celda está el dedo. Las celdas válidas
 *      llevan un atributo `data-drop-date="YYYY-MM-DD"`. Las
 *      resaltamos con la clase `drop-target-active`.
 *   4. touchend → si hay un drop target válido, llamamos `onDrop`
 *      con su fecha. Limpiamos clases.
 *
 * Se integra junto al drag HTML5 nativo: en desktop sigue funcionando
 * la API de `draggable={true}` + `onDragStart` / `onDrop`. Este hook
 * cubre el caso touch sin pisar el otro.
 */

const LONG_PRESS_MS = 350;

export function useTouchDrag({ enabled, onStart, onDrop, onCancel }) {
  const elementRef = useRef(null);

  // Estado interno mutable — lo guardamos en refs para no re-disparar
  // efectos en cada touchmove (que llega 30-60 veces por segundo).
  const stateRef = useRef({
    pressTimer: null,
    isDragging:    false,
    currentTarget: null,
  });

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;
    const state = stateRef.current;

    function clearHover() {
      if (state.currentTarget) {
        state.currentTarget.classList.remove("drop-target-active");
        state.currentTarget = null;
      }
    }

    function reset() {
      if (state.pressTimer) {
        clearTimeout(state.pressTimer);
        state.pressTimer = null;
      }
      state.isDragging = false;
      el.classList.remove("is-touch-dragging");
      clearHover();
    }

    function handleStart(e) {
      if (e.touches.length !== 1) return;       // ignoramos pinch
      state.pressTimer = setTimeout(() => {
        state.isDragging = true;
        el.classList.add("is-touch-dragging");
        // Pequeña vibración háptica si el dispositivo lo soporta —
        // confirma al usuario "ya estás en modo arrastrar".
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try { navigator.vibrate(10); } catch { /* ignore */ }
        }
        onStart?.();
      }, LONG_PRESS_MS);
    }

    function handleMove(e) {
      if (!state.isDragging) {
        // Si el usuario se mueve antes del long-press, asumimos que
        // está haciendo scroll y cancelamos el drag pendiente.
        if (state.pressTimer) {
          clearTimeout(state.pressTimer);
          state.pressTimer = null;
        }
        return;
      }
      // Bloqueamos el scroll de la página mientras se arrastra.
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = elem?.closest("[data-drop-date]");
      if (state.currentTarget !== cell) {
        state.currentTarget?.classList.remove("drop-target-active");
        cell?.classList.add("drop-target-active");
        state.currentTarget = cell;
      }
    }

    function handleEnd() {
      const { isDragging, currentTarget } = state;
      if (isDragging && currentTarget) {
        const date = currentTarget.dataset.dropDate;
        if (date) onDrop?.(date);
      } else if (isDragging) {
        // Long-press se completó pero no había drop target → cancel.
        onCancel?.();
      }
      reset();
    }

    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchmove",  handleMove,  { passive: false });
    el.addEventListener("touchend",   handleEnd);
    el.addEventListener("touchcancel", handleEnd);

    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove",  handleMove);
      el.removeEventListener("touchend",   handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
      reset();
    };
  }, [enabled, onStart, onDrop, onCancel]);

  return elementRef;
}
