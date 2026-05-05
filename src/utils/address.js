/**
 * Helpers para direcciones de cliente y enlaces a Maps.
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
 * Devuelve true si el cliente tiene al menos una pieza de dirección
 * útil (calle/ciudad/CP). Sirve para decidir si pintamos el bloque
 * de "Cómo llegar" o lo omitimos. */
export function hasAddress(client) {
  if (!client) return false;
  return Boolean(
    (client.address && client.address.trim()) ||
    (client.city && client.city.trim()) ||
    (client.postal_code && client.postal_code.trim())
  );
}

/**
 * Compone "calle, CP ciudad" filtrando los campos vacíos. Resultado
 * idóneo para el query string de Maps y para mostrar al usuario.
 *
 * Ejemplos:
 *   { address: "C/ Mayor 12", city: "Madrid", postal_code: "28013" }
 *     → "C/ Mayor 12, 28013 Madrid"
 *   { address: "C/ Mayor 12", city: "", postal_code: "" }
 *     → "C/ Mayor 12"
 *   {} → "" */
export function formatAddress(client) {
  if (!client) return "";
  const street = (client.address || "").trim();
  const city = (client.city || "").trim();
  const cp = (client.postal_code || "").trim();
  const cityLine = [cp, city].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ");
}

/**
 * URL para Maps con la dirección como búsqueda. En móvil con la app
 * de Maps instalada, abre la app nativa; en desktop, el navegador.
 * Usa la spec oficial Google Maps URLs (sin API key necesaria).
 *
 * Devuelve null si no hay dirección suficiente — el caller debe
 * gatear el botón con `hasAddress(client)` antes de pintarlo. */
export function getMapsUrl(client) {
  const formatted = formatAddress(client);
  if (!formatted) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}`;
}
