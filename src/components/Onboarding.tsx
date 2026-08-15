import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { $identity } from '@/services/identity'
import { setAuthCredential } from '@/services/authSession'
import { createGettingStartedDrain } from '@/helpers/drains'
import AuthShell from './AuthShell'

export default function Onboarding({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validate = () => {
    const errs: { name?: string; email?: string; password?: string } = {}
    if (!name.trim()) errs.name = 'Name is required'
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    else if (!/^[\p{L}\p{M}][\p{L}\p{M}'.\- ]*$/u.test(name.trim())) errs.name = 'Enter a valid name'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address'
    if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    return errs
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setFormError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong')
        return
      }

      setAuthCredential(email.trim().toLowerCase(), password)
      $identity.set(data.identity)

      try {
        await createGettingStartedDrain(data.identity)
      } catch {
        // Non-fatal — worst case a new account just has an empty sidebar.
      }
      window.location.href = '/'
    } catch {
      setFormError('Could not reach the server. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <h2 className="font-heading text-2xl font-semibold">Create account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your name, email, and a password to get started.
      </p>
      {formError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
          {formError.includes('already exists') && (
            <>
              {' '}
              <button type="button" className="underline" onClick={onSwitchToLogin}>
                Log in instead
              </button>
            </>
          )}
        </div>
      )}
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="userName">Full name</Label>
          <Input
            id="userName"
            name="name"
            autoComplete="name"
            required
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }))
            }}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="userEmail">Email address</Label>
          <Input
            id="userEmail"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ada@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }))
            }}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="userPassword">Password</Label>
          <Input
            id="userPassword"
            name="new-password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }))
            }}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing up…' : 'Sign up'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Already have an account?{' '}
          <button type="button" className="underline" onClick={onSwitchToLogin}>
            Log in
          </button>
        </p>
      </form>
    </AuthShell>
  )
}
