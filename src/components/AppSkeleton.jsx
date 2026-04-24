/**
 * Skeleton de la aplicación mientras se cargan los datos iniciales.
 *
 * Evita el "flash en blanco" y da sensación de que la app ya está ahí,
 * simplemente poblándose. Imita a grandes rasgos la silueta de:
 *  - sidebar a la izquierda
 *  - topbar arriba (contadores)
 *  - panel principal (calendario + panel lateral)
 */
export default function AppSkeleton() {
  return (
    <div className="app-shell skeleton-shell" aria-busy="true" aria-label="Cargando datos">
      {/* Sidebar silhouette */}
      <aside className="skeleton-sidebar">
        <div className="sk sk-logo" />
        <div className="sk sk-nav-item" />
        <div className="sk sk-nav-item" />
        <div className="sk sk-nav-item" />
        <div className="sk sk-nav-item" />
        <div className="sk sk-nav-item" />
      </aside>

      <div className="main-shell">
        {/* Topbar silhouette */}
        <div className="skeleton-topbar">
          <div className="skeleton-topbar-left">
            <div className="sk sk-title" />
            <div className="sk sk-subtitle" />
          </div>
          <div className="skeleton-topbar-right">
            <div className="sk sk-chip" />
            <div className="sk sk-chip" />
            <div className="sk sk-chip" />
            <div className="sk sk-btn" />
          </div>
        </div>

        {/* Content silhouette */}
        <div className="skeleton-content">
          <div className="skeleton-calendar">
            <div className="skeleton-calendar-header">
              <div className="sk sk-btn-sm" />
              <div className="sk sk-label" />
              <div className="sk sk-btn-sm" />
            </div>
            <div className="skeleton-calendar-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="sk sk-cell" />
              ))}
            </div>
          </div>

          <div className="skeleton-side">
            <div className="sk sk-panel-title" />
            <div className="sk sk-row" />
            <div className="sk sk-row" />
            <div className="sk sk-row" />
            <div className="sk sk-row short" />
          </div>
        </div>
      </div>
    </div>
  );
}
