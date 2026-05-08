import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useUI } from "../hooks/useUI";
import { useAuth } from "../hooks/useAuth";
import { TECH_AVATAR_COLORS } from "../data/constants";
import { SmartgroupGlyph, SmartgroupWordmark } from "./SmartgroupLogo";
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

/**
 * Color de avatar derivado del nombre del usuario. Determinístico:
 * la misma persona ve siempre el mismo color, lo que ayuda a
 * reconocer iniciales repetidas (ej. dos "JV" distintos). El hash
 * es banal a propósito — sólo necesitamos repartir entre la paleta. */
function colorFromName(name) {
  if (!name) return TECH_AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TECH_AVATAR_COLORS[h % TECH_AVATAR_COLORS.length];
}

/**
 * Item de navegación. Acepta opcionalmente un `badge` numérico —
 * cuando se pasa > 0, muestra un counter mono a la derecha. Si
 * `tone` es "critical", se pinta en rojo discreto (urgencias). */
function NavItem({ icon: Icon, label, active, onClick, disabled, badge, tone }) {
  const showBadge = typeof badge === "number" && badge > 0;
  const badgeClass = tone === "critical" ? "nav-badge nav-badge-critical" : "nav-badge";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`nav-item ${active ? "active" : ""} ${disabled ? "nav-soon" : ""}`}
    >
      <span className="nav-icon"><Icon /></span>
      <span className="nav-label">{label}</span>
      {showBadge && (
        <span className={badgeClass} aria-label={`${badge} requieren atención`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ attentionCount = 0 }) {
  const { section, setSection, drawerOpen, setDrawerOpen } = useUI();
  const { profile, logout, updateProfile } = useAuth();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const displayName = profile?.name || "Usuario";
  const initials    = getInitials(displayName);
  const avatarColor = colorFromName(profile?.name || profile?.email || "");
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

  // Listener para que la paleta de comandos pueda abrir Preferencias
  // sin tener que mover el modal a App.jsx (vive aquí porque
  // conceptualmente pertenece al usuario logueado, igual que el botón
  // del icono 🔔 que lo abre normalmente).
  useEffect(() => {
    const handler = () => setPrefsOpen(true);
    window.addEventListener("crm:open-prefs", handler);
    return () => window.removeEventListener("crm:open-prefs", handler);
  }, []);

  // Helper: navegar Y cerrar drawer (en desktop el cierre no hace nada).
  const go = (next) => {
    setSection(next);
    setDrawerOpen(false);
  };

  // ─── Magic indicator del sidebar ─────────────────────
  // Una pequeña barra brand a la izquierda del item activo que
  // se desliza suavemente al cambiar de sección, en lugar de
  // saltar al nuevo item. Patrón Linear / Vercel.
  //
  // useLayoutEffect mide DESPUÉS del render pero ANTES del paint,
  // así no hay flash en el primer load. Recalculamos cuando
  // cambia `section`.
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState({ y: 0, h: 0, ready: false });

  /* eslint-disable react-hooks/set-state-in-effect --
   * Caso legítimo de "measure DOM after render → set state": no hay
   * forma de calcular la posición del item activo sin haber pintado
   * primero. useLayoutEffect garantiza que la medida se haga ANTES
   * del paint, así que no hay flash visible para el usuario. */
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector(".nav-item.active");
    if (!active) {
      setIndicator((s) => ({ ...s, ready: false }));
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    setIndicator({
      y: itemRect.top - navRect.top,
      h: itemRect.height,
      ready: true,
    });
  }, [section]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          <span className="sidebar-brand-glyph" aria-hidden="true">
            <SmartgroupGlyph size={22} color="#7c8cff" />
          </span>
          <span className="sidebar-brand-wordmark" aria-label="Smartgroup">
            <SmartgroupWordmark height={12} color="#fafaf9" />
          </span>
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

        <nav className="sidebar-nav" ref={navRef}>
          {/* Magic indicator: barra brand absolute que se desliza
              entre los items activos. La posición la medimos vía
              useLayoutEffect en el componente. */}
          <span
            className={`sidebar-active-indicator ${indicator.ready ? "is-ready" : ""}`}
            style={{
              transform: `translateY(${indicator.y}px)`,
              height: `${indicator.h}px`,
            }}
            aria-hidden="true"
          />
          <div className="nav-section-label">Principal</div>
          <NavItem icon={IconHome}        label="Inicio"       active={section === "inicio"}        onClick={() => go("inicio")} />
          <NavItem
            icon={IconCheckSquare}
            label="Mi trabajo"
            active={section === "mitrabajo"}
            onClick={() => go("mitrabajo")}
            badge={attentionCount}
            tone="critical"
          />

          <div className="nav-section-label">Operaciones</div>
          <NavItem icon={IconClipboard} label="Seguimiento" active={section === "instalaciones"} onClick={() => go("instalaciones")} />
          <NavItem icon={IconUsers}     label="Clientes"    active={section === "clientes"}      onClick={() => go("clientes")} />
          <NavItem icon={IconWrench}    label="Equipo"      active={section === "usuarios"}      onClick={() => go("usuarios")} />

          <div className="nav-section-label">Análisis</div>
          <NavItem icon={IconBarChart} label="Informes" active={section === "informes"} onClick={() => go("informes")} />
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" style={{ background: avatarColor }}>
              {initials}
            </div>
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
