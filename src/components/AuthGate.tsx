import { useState } from 'react'
import Onboarding from './Onboarding'
import Login from './Login'

// Cookie presence used to gate rendering (see index.astro/[drain].astro) is
// no longer a security signal now that real passwords exist — it's just
// "does this browser look logged in." A returning user on a new device has
// no cookie and needs Login, not Onboarding, so both live behind one gate
// with a toggle instead of assuming new-vs-returning from cookie state.
export default function AuthGate() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')

  return mode === 'signup' ? (
    <Onboarding onSwitchToLogin={() => setMode('login')} />
  ) : (
    <Login onSwitchToSignup={() => setMode('signup')} />
  )
}
