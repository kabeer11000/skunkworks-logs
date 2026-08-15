import { useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useStore } from '@nanostores/react'
import { Lock, FileText, Notebook } from 'lucide-react'
import { $drains } from '@/helpers/drains'
import { getDrainDb } from '@/services/db'

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Resolves display text per-viewer at render time, not from anything baked
// into stored content (see ReferenceExtension.ts) — checks THIS viewer's
// own $drains (their real directory listing, already permission-scoped) to
// decide whether to show a real title/snippet or a locked placeholder.
export function ReferencePill({ node }: NodeViewProps) {
  const { refType, dbName, entryIdRef } = node.attrs
  const drains = useStore($drains)
  const drain = drains.find((d: any) => d.dbName === dbName)
  const hasAccess = !!drain

  const [snippet, setSnippet] = useState<string | null>(null)
  const [entryMissing, setEntryMissing] = useState(false)

  useEffect(() => {
    if (refType !== 'entry' || !hasAccess || !entryIdRef) return
    let cancelled = false
    getDrainDb(dbName)
      .get(`entry:${entryIdRef}`)
      .then((doc: any) => {
        if (!cancelled) setSnippet(stripHtml(doc.content).slice(0, 60))
      })
      .catch(() => {
        if (!cancelled) setEntryMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [refType, hasAccess, dbName, entryIdRef])

  if (!hasAccess) {
    return (
      <NodeViewWrapper
        as="span"
        contentEditable={false}
        className="reference-pill reference-pill-locked"
      >
        <Lock className="size-3" />
        Private reference
      </NodeViewWrapper>
    )
  }

  const href = refType === 'entry' ? `/drains/${dbName}#entry-${entryIdRef}` : `/drains/${dbName}`
  const title = drain.title || 'Untitled'

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="reference-pill">
      <a href={href}>
        {refType === 'entry' ? <FileText className="size-3" /> : <Notebook className="size-3" />}
        {refType === 'entry' ? (
          <span>
            {title}
            {entryMissing ? ' — entry not found' : snippet ? `: ${snippet}` : '…'}
          </span>
        ) : (
          <span>{title}</span>
        )}
      </a>
    </NodeViewWrapper>
  )
}
