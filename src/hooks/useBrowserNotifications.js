import { useCallback, useEffect, useState } from "react";

/**
 * Wrapper alrededor de la Notification API del navegador.
 *
 *  - Detecta soporte (móviles antiguos, navegadores raros, http inseguro).
 *  - Expone `permission` reactivo ("default" / "granted" / "denied") y
 *    `request()` para pedirlo.
 *  - Persiste una preferencia local "el usuario quiere notificaciones del
 *    navegador" en localStorage. Esto NO sustituye al permiso del SO; es
 *    el toggle "yo quiero" del usuario en NUESTRA UI. Sin permiso no
 *    pasa nada; con permiso y toggle off, tampoco. Hace falta ambos.
 *  - Expone `notify({ title, body, tag, data })` que dispara la
 *    notificación si todo está OK. Devuelve la instancia para que el
 *    caller pueda ponerle un onclick y hacer focus a la pestaña.
 *
 * Filosofía:
 *   No pedimos permiso al cargar (eso es agresivo y suele dar denegación
 *   instantánea en navegadores modernos). El usuario lo activa
 *   explícitamente desde Preferencias. El toggle "yo quiero" se guarda
 *   en localStorage; el permiso del SO se refleja en `permission`.
 */

const STORAGE_KEY = "crm.notifications.enabled";

function isSupported() {
  return typeof window !== "undefined"
    && "Notification" in window
    && typeof window.Notification.requestPermission === "function";
}

function readEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeEnabled(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage puede fallar en modo privado; lo ignoramos.
  }
}

export function useBrowserNotifications() {
  const supported = isSupported();
  const [permission, setPermission] = useState(() =>
    supported ? window.Notification.permission : "denied"
  );
  const [enabled, setEnabledState] = useState(() => readEnabled());

  // Mantener `permission` sincronizado: algunos navegadores no emiten
  // eventos al cambiar el permiso desde la UI del navegador. Releemos
  // cuando la pestaña vuelve a foco (cubre el caso "el usuario fue a
  // ajustes del navegador y volvió"). Es barato.
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPermission(window.Notification.permission);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [supported]);

  const setEnabled = useCallback((value) => {
    writeEnabled(value);
    setEnabledState(value);
  }, []);

  const request = useCallback(async () => {
    if (!supported) return "denied";
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      // Si lo concedió, asumimos que quiere recibirlas: dejamos el
      // toggle local en true. Si lo deniega, no forzamos enabled=false
      // por si el navegador se lo concede luego desde ajustes.
      if (result === "granted") setEnabled(true);
      return result;
    } catch {
      return "denied";
    }
  }, [supported, setEnabled]);

  /**
   * Lanza la notificación si supported + permission='granted' + enabled.
   * `tag` permite reemplazar notificaciones del mismo origen (p. ej. si
   * la misma tarea dispara dos veces, sólo se muestra la última).
   * Devuelve la instancia (o null) para que el caller adjunte onclick.
   */
  const notify = useCallback(
    ({ title, body, tag, data, requireInteraction = false } = {}) => {
      if (!supported || permission !== "granted" || !enabled) return null;
      if (!title) return null;
      try {
        const n = new window.Notification(title, {
          body: body || "",
          tag: tag || undefined,
          // Icono branded de la app (SVG 192px). Si el navegador no lo
          // soporta — Safari macOS p. ej. — cae al favicon del sitio
          // automáticamente, así que no perdemos nada.
          icon: "/notif-icon.svg",
          badge: "/notif-icon.svg",
          data: data || {},
          requireInteraction,
          // renotify forzaría sonido aunque la tag sea la misma; no
          // queremos eso (re-emisiones del backend no deberían molestar
          // si el usuario ya vio la notificación).
        });
        return n;
      } catch {
        // Algunos navegadores rechazan crear Notification fuera de un
        // gesto del usuario en condiciones específicas; no pasa nada.
        return null;
      }
    },
    [supported, permission, enabled]
  );

  return {
    supported,
    permission,    // "default" | "granted" | "denied"
    enabled,       // toggle local ("yo quiero recibirlas")
    setEnabled,
    request,
    notify,
    // Atajo de UX: ¿está todo listo para enviar? Útil en la UI para
    // pintar el banner correcto.
    ready: supported && permission === "granted" && enabled,
  };
}
