import { useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'
import { AtSign } from 'lucide-react'
import { $drains } from '@/helpers/drains'
import { $identity } from '@/services/identity'
import { getDrainDb } from '@/services/db'
import { loadLatestPage } from '@/utils/ulid-pages'

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

interface ActivityItem {
  dbName: string
  drainTitle: string
  entryId: string
  snippet: string
  timestamp: number
  mentionsMe: boolean
}

const PER_DRAIN_LIMIT = 8
const SHOWN = 6

// Unified feed instead of separate "mentions" / "recent updates" sections —
// a mention badge on an item covers the mentions case without needing a
// second list or a tabbed UI. Only reflects what's already synced locally
// per drain (same local-first tradeoff as CommandPalette's search).
export function RecentActivity() {
  const drains = useStore($drains)
  const identity = useStore($identity)
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (drains.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    const myEmail = identity?.email?.toLowerCase()

    Promise.all(
      drains.map(async (drain: any) => {
        const db = getDrainDb(drain.dbName)
        const page = await loadLatestPage(db, PER_DRAIN_LIMIT).catch(() => [] as any[])
        return page.map(
          (doc: any): ActivityItem => ({
            dbName: drain.dbName,
            drainTitle: drain.title || 'Untitled',
            entryId: doc._id.slice('entry:'.length),
            snippet: stripHtml(doc.content).slice(0, 100),
            timestamp: doc.updatedAt || doc.createdAt,
            mentionsMe: !!myEmail && doc.content.toLowerCase().includes(`data-id="${myEmail}"`),
          })
        )
      })
    ).then((groups) => {
      if (cancelled) return
      const merged = groups
        .flat()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, SHOWN)
      setItems(merged)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [drains, identity?.email])

  if (loading || items.length === 0) return null

  return (
    <div className="shrink-0 border-t px-4 py-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Recent Activity
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <a
            key={`${item.dbName}-${item.entryId}`}
            href={`/drains/${item.dbName}#entry-${item.entryId}`}
            className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-xs outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.mentionsMe && <AtSign className="mt-0.5 size-3 shrink-0 text-violet-500" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium text-neutral-600">{item.drainTitle}</span>
                <span className="shrink-0 text-[10px] text-neutral-400">{relativeTime(item.timestamp)}</span>
              </div>
              <p className="line-clamp-1 text-muted-foreground">{item.snippet}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
