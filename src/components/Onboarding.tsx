import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { $identity, deriveIdentity, saveIdentityClient } from '@/services/identity'
import { db } from '@/services/db'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const validate = () => {
    const errs: { name?: string; email?: string } = {}
    if (!name.trim()) errs.name = 'Name is required'
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address'
    return errs
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setIsLoading(true)

    const identity = await deriveIdentity(email, name)
    saveIdentityClient(identity)
    $identity.set(identity)

    try {
      await db.put({
        _id: `profile:${identity.publicUserId}`,
        type: 'profile',
        publicUserId: identity.publicUserId,
        name: identity.name,
        color: identity.color,
        createdAt: Date.now(),
      })
      window.location.href = '/'
    } catch (err: any) {
      if (err?.status !== 409) throw err
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="flex max-h-[700px] w-full max-w-5xl overflow-hidden rounded-2xl">
        {/* Left panel — branding */}
        <div className="hidden w-1/2 flex-col justify-between border-r bg-white p-12 text-neutral-900 md:flex">
          <div>
            <img src="/logo/skunkworks-transparent.png" className="h-10 w-10" alt="" />
            <h1 className="mt-8 text-[2.75rem] font-bold leading-[1.1] tracking-tight">
              Your engineering
              <br />
              log, finally
              <br />
              organized.
            </h1>
            <p className="mt-6 text-[0.8125rem] leading-relaxed text-neutral-500">
              SkunkWorks Logs is a personal drain for every release, incident, and decision —
              offline-first, syncable, and built for engineers who ship.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-neutral-400">
              <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9l6-6 1.5 1.5L6.5 12z" fill="currentColor"/>
              </svg>
              Offline-first, syncable across devices
            </div>
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-neutral-400">
              <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9l6-6 1.5 1.5L6.5 12z" fill="currentColor"/>
              </svg>
              Per-drain encryption for private drains
            </div>
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-neutral-400">
              <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9l6-6 1.5 1.5L6.5 12z" fill="currentColor"/>
              </svg>
              No account required to browse shared drains
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 items-center justify-center bg-background p-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 md:hidden">
              <img src="/logo/skunkworks-transparent.png" className="h-10 w-10" alt="" />
            </div>
            <h2 className="font-heading text-2xl font-semibold">Create account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your name and email to get started.
            </p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="userName">Full name</Label>
                <Input
                  id="userName"
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
                  type="email"
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing up…' : 'Sign up'}
              </Button>
              <p className="text-xs text-muted-foreground">
                This identifies your entries across devices.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
