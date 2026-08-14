import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { Globe, Lock } from 'lucide-react'
import { $drains, populateDrains } from '@/helpers/drains'
import { $identity, getStoredIdentityClient } from '@/services/identity'
import NewDrainDialog from './NewDrainDialog'

export default function AppSidebar() {
  const drains = useStore($drains)

  useEffect(() => {
    $identity.set(getStoredIdentityClient())
    populateDrains()
  }, [])

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  return (
    <aside className="flex h-full w-[30%] flex-col rounded-xl bg-background">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo/skunkworks-transparent.png" className="h-7 w-7" alt="" />
          <span className="text-sm font-medium">SkunkWorks / Logs</span>
        </a>
        <NewDrainDialog />
      </div>

      {/* Drains */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Drains
        </div>
        <div className="mb-3 text-xs text-neutral-400">
          Your personal engineering log
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {drains.map((drain: any) => {
            const shortId = drain.id.replace('notebook:', '')
            const href = `/drains/${shortId}`
            const active = currentPath === href
            return (
              <a
                key={drain.id}
                href={href}
                className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  active
                    ? 'border-neutral-300 bg-secondary'
                    : 'border-neutral-200 hover:bg-secondary/70'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="line-clamp-2 text-sm font-medium leading-snug">
                    {drain.title || 'Untitled'}
                  </span>
                  {drain.visibility === 'shared' ? (
                    <Globe className="size-3 shrink-0 text-neutral-400 mt-0.5" />
                  ) : (
                    <Lock className="size-3 shrink-0 text-neutral-400 mt-0.5" />
                  )}
                </div>
                <span className="text-[0.6875rem] text-neutral-400">
                  {drain.visibility === 'shared' ? 'Shared' : 'Private'}
                </span>
              </a>
            )
          })}
        </div>
        {drains.length === 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            No drains yet
          </p>
        )}
      </div>
    </aside>
  )
}
