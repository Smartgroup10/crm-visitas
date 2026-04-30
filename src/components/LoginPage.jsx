import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

/* Iconos inline para no añadir dependencia de libs externas */
function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4 10 6a13 13 0 0 1-3.8 4.6" />
      <path d="M6.7 6.7C3.7 8.6 2 12 2 12s4 6 10 6a10 10 0 0 0 4.5-1" />
      <path d="M14.1 14.1A3 3 0 1 1 9.9 9.9" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Login page — Field Engineering aesthetic.
 *
 * Layout:
 *   - Desktop: split 50/50 — brand panel oscuro a la izquierda con
 *     un statement editorial; form panel claro a la derecha.
 *   - Mobile: brand panel arriba reducido (160px), form panel abajo.
 *
 * El brand panel transmite identidad de marca y sólo se ve aquí, una
 * vez. Es la primera impresión: dot grid, glow ambiente, quote serif
 * grande, footer mono. La forma editorial de un manual técnico.
 *
 * El form panel es lo opuesto — calma, minimal, todo en una columna
 * de 360px. Inputs con label uppercase mono pequeño (etiquetas como
 * "EMAIL" / "CONTRASEÑA"), border hairline, focus accent.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Email o contraseña incorrectos. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const year = new Date().getFullYear();

  return (
    <div className="login-shell">
      {/* ─── Brand panel ─────────────────────────────── */}
      <aside className="login-brand-panel">
        {/* Decorative layers (no contenido — todo via CSS / pseudo) */}
        <div className="login-grid-overlay" aria-hidden="true" />
        <div className="login-glow" aria-hidden="true" />

        <div className="login-brand-header">
          <div className="login-brand-mark">
            <span className="login-brand-badge">S</span>
            <span className="login-brand-name">SMARTGROUP</span>
          </div>
          <span className="login-brand-tag">VOIP · Cámaras · Redes</span>
        </div>

        <div className="login-brand-quote">
          <p>Operaciones de campo, controladas con precisión.</p>
        </div>

        <div className="login-brand-footer">
          <span className="login-brand-footer-meta">v2.6</span>
          <span className="login-brand-footer-sep">—</span>
          <span className="login-brand-footer-meta">© {year} Smartgroup</span>
        </div>
      </aside>

      {/* ─── Form panel ──────────────────────────────── */}
      <main className="login-form-panel">
        {/* Theme toggle: discreto, esquina superior derecha del panel claro. */}
        <button
          type="button"
          className="login-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <div className="login-eyebrow">ACCESO · CRM OPERACIONES</div>
          <h1 className="login-title">Bienvenido de vuelta</h1>
          <p className="login-subtitle">
            Inicia sesión con tu cuenta corporativa para continuar.
          </p>

          <div className="login-field">
            <label htmlFor="login-email" className="login-field-label">EMAIL</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.cuenta@smartgroup.es"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-field-label">CONTRASEÑA</label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-input-action"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                <EyeIcon off={showPwd} />
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-submit-spinner" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              <>
                Iniciar sesión
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>

          <div className="login-meta">
            ¿Problemas de acceso?{" "}
            <a href="mailto:soporte@smartgroup.es">soporte@smartgroup.es</a>
          </div>
        </form>
      </main>
    </div>
  );
}
