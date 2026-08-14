import { useStore } from '@nanostores/react'
import { Globe, Lock, Plus } from 'lucide-react'
import { $drains } from '@/helpers/drains'
import NewDrainDialog from './NewDrainDialog'

export default function DrainsGrid() {
  const drains = useStore($drains)

  if (drains.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="font-medium">No drains yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first drain to start logging entries.
            </p>
          </div>
        </div>
        <NewDrainDialog />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Your drains</h2>
        <NewDrainDialog />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {drains.map((drain: any) => {
          const shortId = drain.id.replace('notebook:', '')
          const href = `/drains/${shortId}`
          return (
            <a
              key={drain.id}
              href={href}
              className="group flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors hover:border-neutral-300 hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 font-medium leading-snug">
                  {drain.title || 'Untitled'}
                </span>
                {drain.visibility === 'shared' ? (
                  <Globe className="size-4 shrink-0 text-neutral-400" />
                ) : (
                  <Lock className="size-4 shrink-0 text-neutral-400" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {drain.visibility === 'private' && !drain.unlocked
                  ? 'Locked'
                  : drain.visibility === 'shared'
                    ? 'Shared drain'
                    : 'Private drain'}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
