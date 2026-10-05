import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import type { LegalSlug } from './legal/documents.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { appRedirect } from './landing/route.ts'
import { countArrivalFromLanding } from './analytics.ts'

// Each page loads only its own code, so the landing page never pulls in the
// canvas or the sign-in machinery.
const App = lazy(() => import('./App.tsx'))
const Landing = lazy(() => import('./landing/Landing.tsx'))
const SignInPage = lazy(() => import('./components/SignInPage.tsx'))
const LegalPage = lazy(() => import('./components/LegalPage.tsx'))

// A handful of addresses is not worth a router. The canvas lives at /app;
// the sign-in and policy pages have their own; anything else is the landing
// page, which keeps unknown paths landing somewhere useful.
let path = window.location.pathname.replace(/\/+$/, '')
const LEGAL_PATHS: Record<string, LegalSlug> = { '/privacy': 'privacy', '/terms': 'terms', '/cookies': 'cookies' }
const legal = LEGAL_PATHS[path] ?? null
const isSignIn = path === '/signin'

// A returning reader (work saved here, or signed in) goes straight to the
// canvas, without a reload; so does a sign-in link from an older email.
if (!legal && !isSignIn && path !== '/app') {
  const to = appRedirect(window.location, localStorage)
  if (to) {
    window.history.replaceState(window.history.state, '', to)
    path = '/app'
  }
}
const isApp = path === '/app'
if (isApp) countArrivalFromLanding()

// The canvas applies the saved theme in an effect, which the other pages
// never run. Doing it here covers them all, and spares the canvas a light
// flash on load. Read-only, so it cannot look like a fresh local edit to sync.
document.documentElement.dataset.theme =
  localStorage.getItem('gita-connects-theme') === 'dark' ? 'dark' : 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        {isSignIn ? <SignInPage /> : legal ? <LegalPage slug={legal} /> : isApp ? <App /> : <Landing />}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
