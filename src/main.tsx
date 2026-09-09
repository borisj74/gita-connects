import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SignInPage from './components/SignInPage.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// One extra address is not worth a router. Anything that is not the sign-in
// page is the canvas, which keeps unknown paths landing somewhere useful.
const path = window.location.pathname.replace(/\/+$/, '')
const isSignIn = path === '/signin'

// The canvas applies the saved theme in an effect, which the sign-in page
// never runs. Doing it here covers both, and spares the canvas a light flash
// on load. Read-only, so it cannot look like a fresh local edit to sync.
document.documentElement.dataset.theme =
  localStorage.getItem('gita-connects-theme') === 'dark' ? 'dark' : 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isSignIn ? <SignInPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
