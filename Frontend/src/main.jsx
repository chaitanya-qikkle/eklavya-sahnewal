import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import './styles/yardVisualization.css'
import App from './App'
import { store } from './store/store'
import { setCredentials } from './store/slices/authSlice'
import { clearLegacyAuthData, getStoredToken, getStoredUser, isTokenExpired, logout } from './services/authService'
import { registerOfflineSW } from './utils/desktopRuntime'

// Offline asset cache (web build only; Tauri ships local files).
registerOfflineSW()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root container #root not found in DOM')
}

// Keep Redux auth state in sync with persisted localStorage.
// This enables Redux-based auth checks immediately after refresh.
try {
  // Prevent legacy persistent sessions from causing auto-login.
  clearLegacyAuthData()

  const user = getStoredUser()
  const token = getStoredToken()
  if (token) {
    if (isTokenExpired(token)) {
      logout()
    } else {
      store.dispatch(setCredentials({ user, token }))
    }
  }
} catch {
  // Ignore malformed localStorage values
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
