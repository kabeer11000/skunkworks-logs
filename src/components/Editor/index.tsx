// index.tsx (notebook entry component)
import { TextStyleKit } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useRef } from 'react'
import './style.css'
import EntryMark from './entry'
import { AutoAuthorExtension } from './entry/auto-author'
import { db } from '@/services/db'
import { $drains } from '@/helpers/drains'
import { $identity } from '@/services/identity'
import { Placeholder } from '@tiptap/extensions'

export default ({ id }: { id: string }) => {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastKnownHtml = useRef<string | null>(null)

  const saveWholeDocument = async (htmlContent: string) => {
    try {
      const doc: any = await db.get(id)
      doc.updatedAt = new Date().toString()
      doc.content = htmlContent
      await db.put(doc)
      lastKnownHtml.current = htmlContent
      console.log('Saved full document to DB!')
    } catch (err) {
      console.error('Failed to update DB:', err)
    }
  }

  // Apply content that came from PouchDB (initial load or a remote peer's
  // change) without letting AutoAuthorExtension mistake the rest of the
  // document for newly-typed text from the local user.
  const applyExternalContent = (editor: any, html: string) => {
    if (html === lastKnownHtml.current) return // echo of our own write, ignore
    if (html === editor.getHTML()) {
      lastKnownHtml.current = html
      return
    }

    const { from, to } = editor.state.selection
    const hadFocus = editor.isFocused

    editor.storage.autoAuthor.suspended = true
    editor.commands.setContent(html, false)
    editor.storage.autoAuthor.suspended = false
    lastKnownHtml.current = html

    if (hadFocus) {
      const size = editor.state.doc.content.size
      const clamp = (n: number) => Math.max(0, Math.min(n, size))
      editor.commands.setTextSelection({ from: clamp(from), to: clamp(to) })
    }
  }

  const editor = useEditor({ 
    immediatelyRender: false,
    extensions: [
      TextStyleKit,
      StarterKit,
      EntryMark,
      Placeholder.configure({
        // Use a placeholder:
        placeholder: 'Click to start typing, all your changes autosave…',
      }),
      AutoAuthorExtension.configure({
        authorName: $identity.get().name,
        authorColor: $identity.get().color,
      }),
    ],
    content: '',

    onMount({ editor }) {
      const unsubscribe = $drains.listen((drains) => {
        const doc = drains.find(({ id: _id }) => _id === id)
        if (!doc || !doc.content) return
        applyExternalContent(editor, doc.content)
      })

      db.get(id)
        .then((doc: any) => {
          if (doc.content) {
            lastKnownHtml.current = doc.content
            editor.storage.autoAuthor.suspended = true
            editor.commands.setContent(doc.content, false)
            editor.storage.autoAuthor.suspended = false
          }
        })
        .catch(() => {
          console.log(`Document ${id} not found. Starting blank.`)
        })

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
          e.preventDefault()
          saveWholeDocument(editor.getHTML())
        }
      }
      window.addEventListener('keydown', handleKeydown)

      editor.storage.cleanup = () => {
        unsubscribe?.()
        window.removeEventListener('keydown', handleKeydown)
      }
    },

    onUpdate({ editor }) {
      const currentHtml = editor.getHTML()
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        saveWholeDocument(currentHtml)
      }, 1000)
    },

    onDestroy({ editor }) {
      editor?.storage?.cleanup?.()
    },
  })

  return (
    <>
      <EditorContent className="min-w-3xl min-h-screen px-20" editor={editor} />
    </>
  )
}