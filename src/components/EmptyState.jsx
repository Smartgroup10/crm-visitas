/**
 * Componente genérico de "estado vacío".
 *
 * Props:
 *  - icon: uno de los presets ("inbox" | "search" | "users" | "check" | "folder")
 *          o un ReactNode arbitrario (SVG, emoji, etc.)
 *  - title: texto principal
 *  - description: texto secundario opcional
 *  - action: { label, onClick, variant? } opcional — pinta un botón de CTA
 *  - compact: cuando queremos un empty state más discreto (paneles secundarios)
 */
export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  compact = false,
}) {
  const iconNode = typeof icon === "string" ? <PresetIcon name={icon} /> : icon;

  return (
    <div className={`empty-state-v2 ${compact ? "empty-state-v2--compact" : ""}`}>
      <div className="empty-state-icon" aria-hidden="true">
        {iconNode}
      </div>
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

function PresetIcon({ name }) {
  // SVGs sencillos, monocromos, 48x48. Usan currentColor para heredar del wrapper.
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="20" cy="20" r="11" />
          <path d="M29 29 l10 10" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="17" r="6" />
          <path d="M6 40c0-7 5-12 12-12s12 5 12 12" strokeLinecap="round" />
          <circle cx="33" cy="15" r="5" />
          <path d="M42 38c0-5-3-9-8-10" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="24" cy="24" r="18" />
          <path d="M16 24 l6 6 l12 -12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 14 h12 l4 4 h20 v22 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 Z" strokeLinejoin="round" />
        </svg>
      );
    case "inbox":
    default:
      return (
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 28 L12 10 h24 l6 18 M6 28 v12 a2 2 0 0 0 2 2 h32 a2 2 0 0 0 2 -2 v-12 M6 28 h10 l3 5 h10 l3 -5 h10" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
  }
}
