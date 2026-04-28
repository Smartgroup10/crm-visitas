/**
 * Detecta si el cliente está en macOS / iOS.
 *
 * Lo usamos sólo para etiquetar atajos de teclado en la UI:
 *   - Mac muestra el símbolo ⌘ (Command)
 *   - Resto (Windows, Linux, ChromeOS, móvil Android) muestra "Ctrl"
 *
 * `navigator.platform` está siendo deprecado pero sigue funcionando en
 * todos los navegadores actuales. Como respaldo usamos `userAgent`.
 * No es crítico que falle: si la detección no funciona, mostramos
 * "Ctrl" — la mayoría de usuarios están en Windows y la app va sobre
 * un CRM corporativo de Smartgroup, no de un público mac-heavy.
 */
export const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(
    (navigator.platform || "") + " " + (navigator.userAgent || "")
  );

/** Símbolo del modificador principal: ⌘ en Mac, "Ctrl" en el resto. */
export const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl";

/**
 * Etiqueta para mostrar atajos del tipo Mod+Letra. En Mac usa ⌘+K
 * sin separador; en Windows "Ctrl K" con espacio. Cumple con la
 * convención visual de cada plataforma.
 */
export function modKeyLabel(letter) {
  return IS_MAC ? `⌘${letter.toUpperCase()}` : `Ctrl ${letter.toUpperCase()}`;
}
