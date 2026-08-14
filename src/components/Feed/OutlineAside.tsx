import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Sparkles } from 'lucide-react'
import { summarizeEntries } from '@/services/aiApi'

function dayLabel(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

// A Google Docs-style outline, but grouped by day instead of heading —
// entries here are plain log lines (heading/list/etc. block types are
// deliberately disabled, see StarterKit.configure in index.tsx), so a day
// boundary is the natural section marker. Only reflects days currently
// loaded into the editor; scrolling up loads older pages and grows this list.
export function OutlineAside({ editor, dbName }: { editor: Editor; dbName: string }) {
  const [days, setDays] = useState<{ key: string; label: string; entryId: string; entryIds: string[] }[]>([])
  const [summarizing, setSummarizing] = useState<string | null>(null)

  useEffect(() => {
    const recompute = () => {
      const byDay = new Map<string, { label: string; entryId: string; entryIds: string[] }>()
      editor.state.doc.forEach((node: any) => {
        // Summary entries (source: 'ai-summary') aren't real log lines for a
        // day — including them would let "summarize this day" re-summarize
        // its own previous summary on a second click.
        if (node.type.name !== 'paragraph' || !node.attrs.entryId || !node.attrs.createdAt || node.attrs.source) return
        const ts = Number(node.attrs.createdAt)
        const key = new Date(ts).toDateString()
        const existing = byDay.get(key)
        if (existing) {
          existing.entryIds.push(node.attrs.entryId)
        } else {
          byDay.set(key, { label: dayLabel(ts), entryId: node.attrs.entryId, entryIds: [node.attrs.entryId] })
        }
      })
      setDays(Array.from(byDay, ([key, v]) => ({ key, ...v })))
    }

    recompute()
    editor.on('update', recompute)
    return () => {
      editor.off('update', recompute)
    }
  }, [editor])

  const handleSummarize = async (key: string, entryIds: string[]) => {
    setSummarizing(key)
    try {
      await summarizeEntries(dbName, entryIds)
    } catch {
      // Best-effort — the button just stops spinning; nothing to roll back
      // since no local state was optimistically changed.
    } finally {
      setSummarizing(null)
    }
  }

  const jumpTo = (entryId: string) => {
    editor.view.dom.querySelector(`p[data-entry-id="${entryId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <div className="w-40 shrink-0">
      {/* top-16 matches scrollRef's pt-16 in index.tsx, and z-20 keeps this
          above the top fade gradient (z-10) so it doesn't wash out white
          right where it pins — sticky was already applied, it just looked
          broken sitting exactly under that overlay. */}
      <div className="sticky top-16 z-20 flex flex-col gap-0.5">
        {days.map((d) => (
          <div key={d.key} className="group/day flex items-center">
            <button
              type="button"
              onClick={() => jumpTo(d.entryId)}
              className="flex-1 rounded-md px-2 py-1 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {d.label}
            </button>
            <button
              type="button"
              title="Summarize this day"
              onClick={() => handleSummarize(d.key, d.entryIds)}
              disabled={summarizing === d.key}
              className="rounded-md p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100"
            >
              <Sparkles className={`size-3 ${summarizing === d.key ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
