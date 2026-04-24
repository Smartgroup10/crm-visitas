import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIProvider'
import { ToastProvider } from './context/ToastProvider'
import { ConfirmProvider } from './context/ConfirmProvider'
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
      <ConfirmProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>,
)
