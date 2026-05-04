/* eslint-disable react-refresh/only-export-components --
 * Entry point: este archivo monta la app. `Root` es un wrapper local
 * que decide entre LoginPage y App según authLoading + user. No se
 * exporta a propósito (no hay consumidor externo). */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIProvider'
import { ToastProvider } from './context/ToastProvider'
import { ConfirmProvider } from './context/ConfirmProvider'
import { NotificationStackProvider } from './context/NotificationStackProvider'
import { useAuth } from './hooks/useAuth'
import App from './App'
import LoginPage from './components/LoginPage'

function Root() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <UIProvider>
      <App />
    </UIProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <NotificationStackProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ConfirmProvider>
      </NotificationStackProvider>
    </ToastProvider>
  </StrictMode>,
)
