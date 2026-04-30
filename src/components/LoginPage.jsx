import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

/**
 * Logo de Smartgroup como SVG inline.
 *
 * Construido con DOS crescents (arcos de 270° con caps redondeados) que
 * se interconectan, replicando la composición del logo oficial:
 *   - Crescent superior: arco que va de la derecha-media, sube por la
 *     parte alta, baja por la izquierda hasta la parte baja-media.
 *     Abre al sureste.
 *   - Crescent inferior: el mismo arco rotado 180°. Abre al noroeste.
 * Como los centros están ligeramente desplazados (la geometría del
 * arco SVG calcula el centro a partir de los endpoints + radio), los
 * dos crescents quedan interlazados en la zona central, igual que en
 * el logo oficial.
 *
 * `currentColor` permite controlar el tono desde CSS según contexto
 * (azul brand sobre fondo claro; azul más claro sobre navy).
 */
function SmartgroupGlyph({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Crescent superior — abre al sureste */}
      <path
        d="M 50 28 A 22 22 0 1 0 28 50"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      {/* Crescent inferior — abre al noroeste, rotado 180° */}
      <path
        d="M 14 36 A 22 22 0 1 0 36 14"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

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
 * Login page — single panel centered.
 *
 * Layout:
 *   - Sin split. Una sola superficie (canvas warm) con la card del
 *     login centrada vertical y horizontalmente.
 *   - Fondo con dot grid sutil que se atenúa hacia los bordes via
 *     mask radial — añade profundidad sin distraer.
 *   - Card blanca con hairline border + sombra mínima. Logo arriba,
 *     título, subtítulo, fields, botón submit y link a soporte.
 *   - Theme toggle flotante en la esquina superior derecha.
 *   - Footer pequeño con copyright debajo de la card.
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
      <div className="login-bg-dots" aria-hidden="true" />
      <div className="login-bg-glow" aria-hidden="true" />

      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <main className="login-card">
        <div className="login-brand-lockup">
          <span className="login-brand-glyph">
            <SmartgroupGlyph size={38} />
          </span>
          <h2 className="login-brand-name">
            smartgroup<sup>®</sup>
          </h2>
        </div>

        <h1 className="login-title">Bienvenido de vuelta</h1>
        <p className="login-subtitle">
          Inicia sesión con tu cuenta para continuar.
        </p>

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <div className="login-field">
            <label htmlFor="login-email" className="login-field-label">Email</label>
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
            <label htmlFor="login-password" className="login-field-label">Contraseña</label>
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
        </form>

        <div className="login-meta">
          ¿Problemas de acceso?{" "}
          <a href="mailto:soporte@smartgroup.es">soporte@smartgroup.es</a>
        </div>
      </main>

      <footer className="login-footer">
        © {year} Smartgroup · CRM Operaciones
      </footer>
    </div>
  );
}
