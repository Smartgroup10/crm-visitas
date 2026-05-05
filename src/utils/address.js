/**
 * Helpers para direcciones de tarea y enlaces a Maps.
 *
 * La dirección vive en la propia tarea (no en el cliente) porque un
 * cliente puede tener varias sedes — la dirección concreta a la que
 * va el técnico depende de la intervención. Los campos camelCase
 * (`address`, `city`, `postalCode`, `locationNotes`) son los que
 * existen en el draft del frontend (taskMapper traduce a snake_case
 * al persistir).
 *
 * Decisiones:
 *  - Usamos Google Maps porque es el denominador común: en iOS abre
 *    Apple Maps si el usuario tiene el handler asignado, en Android
 *    abre Google Maps directamente, y en desktop abre el navegador.
 *  - El endpoint /maps/search/?api=1&query=... es el oficial Maps URL
 *    spec — funciona sin API key y respeta Universal Links de iOS.
 *  - No intentamos geocoding aquí: si la dirección está bien escrita,
 *    Google la encuentra; si no, el usuario verá el resultado más
 *    cercano y puede ajustar manualmente. Sin dependencias externas.
 */

/**
 * ¿La tarea tiene al menos una pieza de dirección útil?
 * Sirve para decidir si pintamos el bloque "Cómo llegar". */
export function hasAddress(task) {
  if (!task) return false;
  return Boolean(
    (task.address && task.address.trim()) ||
    (task.city && task.city.trim()) ||
    (task.postalCode && task.postalCode.trim())
  );
}

/**
 * Compone "calle, CP ciudad" filtrando vacíos. Resultado idóneo para
 * el query de Maps y para mostrar al usuario.
 *
 * Ejemplos:
 *   { address: "C/ Mayor 12", city: "Madrid", postalCode: "28013" }
 *     → "C/ Mayor 12, 28013 Madrid"
 *   { address: "C/ Mayor 12" } → "C/ Mayor 12"
 *   {} → "" */
export function formatAddress(task) {
  if (!task) return "";
  const street = (task.address || "").trim();
  const city = (task.city || "").trim();
  const cp = (task.postalCode || "").trim();
  const cityLine = [cp, city].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ");
}

/**
 * URL para Maps con la dirección como búsqueda. En móvil con la app
 * de Maps instalada, abre la app nativa; en desktop, el navegador.
 * Usa la spec oficial Google Maps URLs (sin API key necesaria).
 *
 * Devuelve null si no hay dirección suficiente — el caller debe
 * gatear el botón con `hasAddress(task)` antes de pintarlo. */
export function getMapsUrl(task) {
  const formatted = formatAddress(task);
  if (!formatted) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}`;
}
