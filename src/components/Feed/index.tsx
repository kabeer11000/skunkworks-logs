import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { DOMSerializer } from '@tiptap/pm/model'
import { db } from '@/services/db'
import { $identity } from '@/services/identity'
import { loadLatestPage, loadOlderPage } from '@/utils/ulid-pages'
import { createEntry, saveEntry, deleteEntry, resolveConflicts, type EntryIdentity } from '@/services/entries'
// @ts-ignore - plain JS module
import { sanitizeHtml } from '@/services/sanitize'
import { BlockParagraph } from './BlockParagraph'
import { AssignBlockId } from './AssignBlockId'

const PAGE_SIZE = 50
const SAVE_DEBOUNCE_MS = 500

// One entry doc renders as one <p data-entry-id="..."> block in a single
// shared editor — this turns a stored `<p>inner</p>` back into a block
// tagged with its id + current author, safely (DOM APIs escape attrs).
function entryToBlockHtml(entry: any, rid: string) {
  const src = document.createElement('div')
  src.innerHTML = entry.content || '<p></p>'
  const innerSrc = src.firstElementChild as HTMLElement | null

  const p = document.createElement('p')
  p.innerHTML = innerSrc ? sanitizeHtml(innerSrc.innerHTML) : ''
  p.setAttribute('data-entry-id', rid)
  if (entry.updatedByColor) p.setAttribute('data-author-color', entry.updatedByColor)
  if (entry.updatedByName) p.setAttribute('data-author-name', entry.updatedByName)
  if (entry.updatedAt) p.setAttribute('data-updated-at', String(entry.updatedAt))
  return p.outerHTML
}

export default function Feed({ notebookId }: { notebookId: string }) {
  const identity = $identity.get()
  const entryPrefix = `entry:${notebookId}:`
  const rawId = (fullId: string) => fullId.slice(entryPrefix.length)
  const fullId = (rid: string) => `${entryPrefix}${rid}`

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<EntryIdentity>(identity)
  const oldestFullIdRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const loadingOlderRef = useRef(false)
  // The pagination IntersectionObserver isn't created until this flips —
  // otherwise its very first (always-fires-once) callback reports the
  // sentinel as "in view" against an empty, unscrolled container, and
  // since that's the only edge IntersectionObserver ever reports for a
  // steady state, gating just the callback body would swallow that one
  // legitimate trigger and pagination would never fire again.
  const [initialLoaded, setInitialLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // rid -> last content this client knows is persisted (skip redundant saves,
  // and skip re-applying a remote change that's just an echo of our own write).
  const lastSavedRef = useRef<Map<string, string>>(new Map())
  // rid -> true once a doc for it exists in PouchDB (create vs update).
  const existsInDbRef = useRef<Set<string>>(new Set())

  identityRef.current = identity

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ paragraph: false }),
      BlockParagraph,
      Placeholder.configure({ placeholder: 'Click to start typing, all your changes autosave…' }),
      AssignBlockId.configure({ getIdentity: () => identityRef.current }),
    ],
    content: '',
    onUpdate: () => scheduleSave(),
  })

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }, [])

  const findBlock = useCallback(
    (rid: string) => {
      if (!editor) return null
      let found: { pos: number; node: any } | null = null
      editor.state.doc.forEach((node, pos) => {
        if (found || node.type.name !== 'paragraph') return
        if (node.attrs.entryId === rid) found = { pos, node }
      })
      return found
    },
    [editor]
  )

  // Debounced: walk every top-level block, save whatever changed since the
  // last known-persisted content, and remove docs for blocks that vanished
  // (merged away via backspace) so they don't reappear from a stale doc.
  const flushBlocks = useCallback(async () => {
    if (!editor) return
    const identity = identityRef.current
    if (!identity) return

    const currentIds = new Set<string>()
    const ops: Promise<any>[] = []

    editor.state.doc.forEach((node: any) => {
      if (node.type.name !== 'paragraph' || !node.attrs.entryId) return
      const rid = node.attrs.entryId
      currentIds.add(rid)

      const html = serializeBlockContent(editor, node)
      if (lastSavedRef.current.get(rid) === html) return

      if (!existsInDbRef.current.has(rid)) {
        if (html === '<p></p>') return // never persist an empty new block
        ops.push(
          createEntry(notebookId, html, identity, rid).then((doc) => {
            if (doc) {
              existsInDbRef.current.add(rid)
              lastSavedRef.current.set(rid, html)
            }
          })
        )
      } else {
        ops.push(
          saveEntry(fullId(rid), html, identity).then(() => {
            lastSavedRef.current.set(rid, html)
          })
        )
      }
    })

    for (const rid of existsInDbRef.current) {
      if (!currentIds.has(rid)) {
        ops.push(
          deleteEntry(fullId(rid)).then(() => {
            existsInDbRef.current.delete(rid)
            lastSavedRef.current.delete(rid)
          })
        )
      }
    }

    await Promise.all(ops)
  }, [editor, notebookId])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushBlocks, SAVE_DEBOUNCE_MS)
  }, [flushBlocks])

  // Initial load — latest page, jump to the bottom like a chat/log view.
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    loadLatestPage(notebookId, PAGE_SIZE).then((page) => {
      if (cancelled) return
      const html = page.map((e: any) => entryToBlockHtml(e, rawId(e._id))).join('')
      editor.commands.setContent(html || '<p></p>')
      page.forEach((e: any) => {
        const rid = rawId(e._id)
        existsInDbRef.current.add(rid)
        lastSavedRef.current.set(rid, e.content)
      })
      oldestFullIdRef.current = page[0]?._id ?? null
      hasMoreRef.current = page.length === PAGE_SIZE
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        setInitialLoaded(true)
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId])

  // Load older pages when the top sentinel scrolls into view, preserving
  // scroll position so the prepend doesn't yank the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const scrollEl = scrollRef.current
    if (!sentinel || !scrollEl || !editor || !initialLoaded) return

    const observer = new IntersectionObserver(
      async (observerEntries) => {
        if (!observerEntries[0].isIntersecting) return
        if (loadingOlderRef.current || !hasMoreRef.current || !oldestFullIdRef.current) return

        loadingOlderRef.current = true
        const prevScrollHeight = scrollEl.scrollHeight
        const page = await loadOlderPage(notebookId, oldestFullIdRef.current, PAGE_SIZE)

        if (page.length > 0) {
          const html = page.map((e: any) => entryToBlockHtml(e, rawId(e._id))).join('')
          editor.commands.insertContentAt(0, html, { updateSelection: false })
          page.forEach((e: any) => {
            const rid = rawId(e._id)
            existsInDbRef.current.add(rid)
            lastSavedRef.current.set(rid, e.content)
          })
          oldestFullIdRef.current = page[0]._id
          requestAnimationFrame(() => {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight
          })
        }
        hasMoreRef.current = page.length === PAGE_SIZE
        loadingOlderRef.current = false
      },
      { root: scrollEl }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId, initialLoaded])

  // Live changes feed — patch just the affected block, never the whole doc.
  useEffect(() => {
    if (!editor) return
    const changes = db
      .changes({ since: 'now', live: true, include_docs: true, conflicts: true })
      .on('change', async (change: any) => {
        if (!change.id.startsWith(entryPrefix)) return
        const rid = rawId(change.id)

        if (change.deleted) {
          const block = findBlock(rid)
          if (block) editor.commands.deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
          existsInDbRef.current.delete(rid)
          lastSavedRef.current.delete(rid)
          return
        }

        let doc = change.doc
        if (doc._conflicts?.length) {
          doc = await resolveConflicts(change.id)
        }
        if (!doc || lastSavedRef.current.get(rid) === doc.content) return // echo of our own write

        existsInDbRef.current.add(rid)
        lastSavedRef.current.set(rid, doc.content)

        const block = findBlock(rid)
        const innerHtml = innerOf(doc.content)

        if (block) {
          const from = block.pos + 1
          const to = block.pos + block.node.nodeSize - 1
          editor.commands.insertContentAt({ from, to }, sanitizeHtml(innerHtml), { updateSelection: false })
          editor.commands.command(({ tr }: any) => {
            tr.setNodeAttribute(block.pos, 'authorColor', doc.updatedByColor)
            tr.setNodeAttribute(block.pos, 'authorName', doc.updatedByName)
            tr.setNodeAttribute(block.pos, 'updatedAt', doc.updatedAt)
            tr.setMeta('addToHistory', false)
            return true
          })
        } else {
          const wasNearBottom = isNearBottom(scrollRef.current)
          editor.commands.insertContentAt(editor.state.doc.content.size, entryToBlockHtml(doc, rid), {
            updateSelection: false,
          })
          if (wasNearBottom) scrollToBottom()
        }
      })
    return () => changes.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notebookId])

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) editor?.chain().focus('end').run()
  }

  if (!identity) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div ref={sentinelRef} />
        <div className="min-h-full" onClick={handleContainerClick}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

// Serializes just this block's inline content back into the plain
// `<p>...</p>` shape stored in the entry doc — no data-entry-id etc.
function serializeBlockContent(editor: any, node: any) {
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const frag = serializer.serializeFragment(node.content)
  const wrapper = document.createElement('div')
  wrapper.appendChild(frag)
  return `<p>${wrapper.innerHTML}</p>`
}

function innerOf(pHtml: string) {
  const div = document.createElement('div')
  div.innerHTML = pHtml || '<p></p>'
  const p = div.firstElementChild as HTMLElement | null
  return p ? p.innerHTML : ''
}

function isNearBottom(el: HTMLElement | null, threshold = 120) {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}
