import { useUI } from "../hooks/useUI";
import { useAuth } from "../hooks/useAuth";
import {
  IconHome, IconCheckSquare, IconClipboard, IconUsers,
  IconWrench, IconBarChart, IconKey, IconLogOut,
} from "./Icon";

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function NavItem({ icon: Icon, label, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`nav-item ${active ? "active" : ""} ${disabled ? "nav-soon" : ""}`}
    >
      <span className="nav-icon"><Icon /></span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

export default function Sidebar() {
  const { section, setSection } = useUI();
  const { profile, logout }     = useAuth();

  const displayName = profile?.name || "Usuario";
  const initials    = getInitials(displayName);
  const isAdmin     = profile?.role === "admin";
  const roleLabel =
    profile?.role === "admin"      ? "Administrador" :
    profile?.role === "supervisor" ? "Supervisor"    :
    profile?.role === "tecnico"    ? "Técnico"       :
    "Usuario";

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
        <NavItem icon={IconHome}        label="Inicio"       active={section === "inicio"}        onClick={() => setSection("inicio")} />
        <NavItem icon={IconCheckSquare} label="Mi trabajo"   active={section === "mitrabajo"}     onClick={() => setSection("mitrabajo")} />

        <div className="nav-section-label">Operaciones</div>
        <NavItem icon={IconClipboard} label="Seguimiento" active={section === "instalaciones"} onClick={() => setSection("instalaciones")} />
        <NavItem icon={IconUsers}     label="Clientes"    active={section === "clientes"}      onClick={() => setSection("clientes")} />
        <NavItem icon={IconWrench}    label="Técnicos"    active={section === "tecnicos"}      onClick={() => setSection("tecnicos")} />

        <div className="nav-section-label">Análisis</div>
        <NavItem icon={IconBarChart} label="Informes" disabled />

        {isAdmin && (
          <>
            <div className="nav-section-label">Administración</div>
            <NavItem icon={IconKey} label="Usuarios" active={section === "usuarios"} onClick={() => setSection("usuarios")} />
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{displayName}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <button
            className="logout-btn"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <IconLogOut />
          </button>
        </div>
      </div>
    </aside>
  );
}
