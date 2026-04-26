import { useEffect, useState } from "react";

import { useUI } from "../hooks/useUI";
import { useAuth } from "../hooks/useAuth";
import {
  IconHome, IconCheckSquare, IconClipboard, IconUsers,
  IconWrench, IconBarChart, IconLogOut, IconBell,
} from "./Icon";
import PreferencesModal from "./PreferencesModal";

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
  const { section, setSection, drawerOpen, setDrawerOpen } = useUI();
  const { profile, logout, updateProfile } = useAuth();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const displayName = profile?.name || "Usuario";
  const initials    = getInitials(displayName);
  const roleLabel =
    profile?.role === "admin"      ? "Administrador" :
    profile?.role === "supervisor" ? "Supervisor"    :
    profile?.role === "tecnico"    ? "Técnico"       :
    "Usuario";

  // Cuando el drawer está abierto en mobile, bloqueamos el scroll del body
  // para evitar la sensación de doble scroll y para que un tap fuera del
  // drawer cierre la navegación sin "saltar" la página.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen]);

  // Tecla Escape cierra el drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  // Helper: navegar Y cerrar drawer (en desktop el cierre no hace nada).
  const go = (next) => {
    setSection(next);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Backdrop sólo presente cuando el drawer está abierto (mobile).
          Click cierra. En desktop el CSS lo oculta. */}
      <div
        className={`sidebar-backdrop ${drawerOpen ? "is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${drawerOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-badge">S</div>
          <div>
            <div className="brand-title">SMARTGROUP</div>
            <div className="brand-subtitle">Operaciones</div>
          </div>
          {/* Botón cerrar visible solo en mobile cuando el drawer está abierto */}
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Principal</div>
          <NavItem icon={IconHome}        label="Inicio"       active={section === "inicio"}        onClick={() => go("inicio")} />
          <NavItem icon={IconCheckSquare} label="Mi trabajo"   active={section === "mitrabajo"}     onClick={() => go("mitrabajo")} />

          <div className="nav-section-label">Operaciones</div>
          <NavItem icon={IconClipboard} label="Seguimiento" active={section === "instalaciones"} onClick={() => go("instalaciones")} />
          <NavItem icon={IconUsers}     label="Clientes"    active={section === "clientes"}      onClick={() => go("clientes")} />
          <NavItem icon={IconWrench}    label="Equipo"      active={section === "usuarios"}      onClick={() => go("usuarios")} />

          <div className="nav-section-label">Análisis</div>
          <NavItem icon={IconBarChart} label="Informes" active={section === "informes"} onClick={() => go("informes")} />
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
              onClick={() => setPrefsOpen(true)}
              title="Preferencias y notificaciones"
              aria-label="Preferencias y notificaciones"
            >
              <IconBell />
            </button>
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

      <PreferencesModal
        open={prefsOpen}
        profile={profile}
        onClose={() => setPrefsOpen(false)}
        onUpdated={(updated) => updateProfile(updated)}
      />
    </>
  );
}
