/**
 * Componente genérico de "estado vacío".
 *
 * Props:
 *  - icon: uno de los presets ("inbox" | "search" | "users" | "check" |
 *          "folder") o un ReactNode arbitrario (SVG, emoji, etc.)
 *  - title: texto principal
 *  - eyebrow: opcional, mono uppercase pequeño que va sobre el title.
 *             Útil cuando el contexto necesita una etiqueta (ej. "FILTROS").
 *  - description: texto secundario opcional
 *  - action: { label, onClick, variant? } opcional — pinta un botón de CTA
 *  - compact: cuando queremos un empty state más discreto (paneles secundarios)
 *
 * Las ilustraciones son SVG bespoke — escenas pequeñas con detalles
 * tonales (no iconos genéricos). Comparten paleta stone + brand.
 */
export default function EmptyState({
  icon = "inbox",
  title,
  eyebrow,
  description,
  action,
  compact = false,
}) {
  const iconNode = typeof icon === "string" ? <PresetIllustration name={icon} /> : icon;

  return (
    <div className={`empty-state-v2 ${compact ? "empty-state-v2--compact" : ""}`}>
      <div className="empty-state-icon" aria-hidden="true">
        {iconNode}
      </div>
      {eyebrow && <div className="empty-state-eyebrow">{eyebrow}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && (
        <button
          type="button"
          className={action.variant === "primary" ? "btn-primary" : "btn-secondary"}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Ilustraciones bespoke. 64x64, line + fill subtle. Las construimos
 * con `currentColor` heredado del wrapper más capas de tonos stone
 * para dar profundidad sin colores chillones.
 *
 * Convención: trazos en `currentColor` (heredan ink-faint del wrapper),
 * acentos brand para señalar el "punto vivo" de la escena (un dot, un
 * tick, una línea).
 */
function PresetIllustration({ name }) {
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
          {/* Dot grid sutil de fondo — eco del bg del login */}
          <g fill="currentColor" opacity="0.18">
            <circle cx="10" cy="10" r="1" />
            <circle cx="22" cy="10" r="1" />
            <circle cx="34" cy="10" r="1" />
            <circle cx="46" cy="10" r="1" />
            <circle cx="10" cy="22" r="1" />
            <circle cx="46" cy="22" r="1" />
            <circle cx="10" cy="34" r="1" />
            <circle cx="46" cy="34" r="1" />
            <circle cx="10" cy="46" r="1" />
            <circle cx="22" cy="46" r="1" />
            <circle cx="34" cy="46" r="1" />
            <circle cx="46" cy="46" r="1" />
          </g>
          {/* Lente */}
          <circle cx="26" cy="26" r="13" stroke="currentColor" strokeWidth="2" />
          <circle cx="26" cy="26" r="9" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          {/* Mango */}
          <line x1="36" y1="36" x2="50" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          {/* Acento brand — el "ping" del cursor */}
          <circle cx="26" cy="26" r="2" fill="var(--brand)" />
        </svg>
      );

    case "users":
      return (
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
          {/* Tres figuras: la del centro + dos satélites en sombra */}
          <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
          <path d="M10 38 c0 -6 4 -10 10 -10 s10 4 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />

          <circle cx="44" cy="18" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <path d="M36 32 c0 -4 3 -8 8 -8 s8 4 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

          {/* Figura central — más pesada, brand */}
          <circle cx="32" cy="40" r="7" stroke="var(--brand)" strokeWidth="2" />
          <path d="M20 58 c0 -7 5 -12 12 -12 s12 5 12 12" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "check":
      return (
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
          {/* Anillo orbital sutil */}
          <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeDasharray="2 4" />
          {/* Círculo principal con check */}
          <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="2" />
          <path
            d="M22 32 l7 7 l13 -14"
            stroke="var(--brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Tres dots de "completado" alrededor */}
          <circle cx="58" cy="14" r="1.5" fill="currentColor" opacity="0.4" />
          <circle cx="6" cy="20" r="1.5" fill="currentColor" opacity="0.4" />
          <circle cx="50" cy="56" r="1.5" fill="currentColor" opacity="0.4" />
        </svg>
      );

    case "folder":
      return (
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
          {/* Carpeta de fondo — segunda capa */}
          <path
            d="M10 20 h12 l3 3 h22 v22 a2 2 0 0 1 -2 2 H12 a2 2 0 0 1 -2 -2 Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            opacity="0.35"
          />
          {/* Carpeta principal */}
          <path
            d="M14 26 h12 l3 3 h22 v22 a2 2 0 0 1 -2 2 H16 a2 2 0 0 1 -2 -2 Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Hairlines internas — sugieren contenido */}
          <line x1="20" y1="38" x2="34" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
          <line x1="20" y1="44" x2="40" y2="44" stroke="currentColor" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
          {/* Acento brand — "nuevo" */}
          <circle cx="48" cy="20" r="3.5" fill="var(--brand)" />
        </svg>
      );

    case "inbox":
    default:
      return (
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
          {/* Bandeja superior con tapadera angular */}
          <path
            d="M10 36 L18 16 h28 l8 20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Bandeja base */}
          <path
            d="M10 36 v14 a2 2 0 0 0 2 2 h40 a2 2 0 0 0 2 -2 v-14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Slot de salida */}
          <path
            d="M10 36 h12 l4 6 h12 l4 -6 h12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Líneas internas — papel apilado, opacidad escalonada */}
          <line x1="22" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
          <line x1="24" y1="27" x2="40" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
          {/* Punto activo: una "tarea" lista para entrar */}
          <circle cx="32" cy="42" r="2.5" fill="var(--brand)" />
        </svg>
      );
  }
}
