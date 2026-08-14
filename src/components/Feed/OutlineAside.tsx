import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

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
export function OutlineAside({ editor }: { editor: Editor }) {
  const [days, setDays] = useState<{ key: string; label: string; entryId: string }[]>([])

  useEffect(() => {
    const recompute = () => {
      const seen = new Set<string>()
      const next: { key: string; label: string; entryId: string }[] = []
      editor.state.doc.forEach((node: any) => {
        if (node.type.name !== 'paragraph' || !node.attrs.entryId || !node.attrs.createdAt) return
        const ts = Number(node.attrs.createdAt)
        const key = new Date(ts).toDateString()
        if (seen.has(key)) return
        seen.add(key)
        next.push({ key, label: dayLabel(ts), entryId: node.attrs.entryId })
      })
      setDays(next)
    }

    recompute()
    editor.on('update', recompute)
    return () => {
      editor.off('update', recompute)
    }
  }, [editor])

  const jumpTo = (entryId: string) => {
    editor.view.dom.querySelector(`p[data-entry-id="${entryId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <div className="w-40 shrink-0">
      {/* top-8 matches scrollRef's pt-8 in index.tsx, and z-20 keeps this
          above the top fade gradient (z-10) so it doesn't wash out white
          right where it pins — sticky was already applied, it just looked
          broken sitting exactly under that overlay. */}
      <div className="sticky top-8 z-20 flex flex-col gap-0.5">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => jumpTo(d.entryId)}
            className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}
