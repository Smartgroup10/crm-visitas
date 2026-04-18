export default function Sidebar({ section, setSection }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-badge">S</div>
        <div>
          <div className="brand-title">SMARTGROUP</div>
          <div className="brand-subtitle">Operaciones</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Principal</div>
        <button
          className={`nav-item ${section === "inicio" ? "active" : ""}`}
          onClick={() => setSection("inicio")}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Inicio</span>
        </button>
        <button
          className={`nav-item ${section === "mitrabajo" ? "active" : ""}`}
          onClick={() => setSection("mitrabajo")}
        >
          <span className="nav-icon">✔</span>
          <span className="nav-label">Mi trabajo</span>
        </button>

        <div className="nav-section-label">Operaciones</div>
        <button
          className={`nav-item ${section === "instalaciones" ? "active" : ""}`}
          onClick={() => setSection("instalaciones")}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Seguimiento</span>
        </button>
        <button
          className={`nav-item ${section === "clientes" ? "active" : ""}`}
          onClick={() => setSection("clientes")}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Clientes</span>
        </button>
        <button
          className={`nav-item ${section === "tecnicos" ? "active" : ""}`}
          onClick={() => setSection("tecnicos")}
        >
          <span className="nav-icon">🔧</span>
          <span className="nav-label">Técnicos</span>
        </button>

        <div className="nav-section-label">Análisis</div>
        <button className="nav-item nav-soon">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Informes</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">JV</div>
          <div className="user-info">
            <div className="user-name">Jaime Vallejo</div>
            <div className="user-role">Administrador</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
