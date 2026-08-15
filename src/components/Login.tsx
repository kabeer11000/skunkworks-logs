import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { $identity } from '@/services/identity'
import { setAuthCredential } from '@/services/authSession'
import AuthShell from './AuthShell'

export default function Login({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong')
        return
      }

      setAuthCredential(email.trim().toLowerCase(), password)
      $identity.set(data.identity)
      window.location.href = '/'
    } catch {
      setFormError('Could not reach the server. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <h2 className="font-heading text-2xl font-semibold">Log in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
      {formError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      )}
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="loginEmail">Email address</Label>
          <Input
            id="loginEmail"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ada@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loginPassword">Password</Label>
          <Input
            id="loginPassword"
            name="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Logging in…' : 'Log in'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Don't have an account?{' '}
          <button type="button" className="underline" onClick={onSwitchToSignup}>
            Sign up
          </button>
        </p>
      </form>
    </AuthShell>
  )
}
