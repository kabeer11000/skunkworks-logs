import { useEffect, useState } from 'react'
import { deriveIdentity } from '@/services/identity'

// Small overlapping-circle avatar stack for a drain's members, Google
// Docs-style. Colors reuse the same per-email derivation used for author
// attribution elsewhere, so a person's color is consistent across the app.
export function AvatarGroup({ emails, max = 4 }: { emails: string[]; max?: number }) {
  const [colors, setColors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(emails.map(async (email) => [email, (await deriveIdentity(email, '')).color] as const)).then(
      (pairs) => {
        if (!cancelled) setColors(Object.fromEntries(pairs))
      }
    )
    return () => {
      cancelled = true
    }
  }, [emails.join(',')])

  if (emails.length === 0) return null

  const shown = emails.slice(0, max)
  const overflow = emails.length - shown.length

  return (
    <div className="flex -space-x-1.5">
      {shown.map((email) => (
        <div
          key={email}
          title={email}
          className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-background text-[9px] font-medium text-white"
          style={{ background: colors[email] ?? '#999' }}
        >
          {email[0]?.toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={`+${overflow} more`}
          className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-medium text-muted-foreground"
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
