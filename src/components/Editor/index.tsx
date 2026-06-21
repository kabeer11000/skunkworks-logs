import { TextStyleKit } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import './style.css'
// import { $drains } from '@/helpers/drains'
import EntryMark from './entry'
import { db } from '@/services/db'

const extensions = [TextStyleKit, StarterKit, EntryMark]

// Mocking your current logged-in user state
const CURRENT_USER = {
  name: 'Jane Doe',
  color: '#ffb3ba' // A nice pink so you can see the difference
}

export default ({ id }: { id: string }) => {
  // @ts-ignore
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const saveWholeDocument = async (htmlContent: string) => {
    db.get(id).then(function (doc: any) {
      doc.updatedAt = (new Date()).toString()
      // update their age
      doc.content = htmlContent;
      // put them back
      return db.put(doc);
    })
    console.log("Saving full document to DB...", htmlContent, id)
    // Your DB logic goes here!
    // await fetch('/api/save', { method: 'POST', body: JSON.stringify({ html: htmlContent }) })
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: '',
    onMount({ editor }) {
      db.get(id).then(function (doc: any) {
        if (editor) {
          editor.commands.setContent(doc.content);
        }
      })
    },
    onSelectionUpdate({ editor }) {
      if (editor.state.selection.empty) {

        // Check who owns the mark currently at the blinking cursor
        const currentAttributes = editor.getAttributes('entryMark')
        const currentAuthor = currentAttributes['data-author']

        // If it belongs to someone else (or has no author), force the cursor to the current user
        if (currentAuthor !== CURRENT_USER.name) {
          editor.commands.setMark('entryMark', {
            'data-author': CURRENT_USER.name,
            'data-color': CURRENT_USER.color,
            'data-updated-at': new Date().toISOString()
          })
        }
      }
    },
    onUpdate({ editor }) {
      // 1. Grab the latest complete HTML string
      const currentHtml = editor.getHTML()

      // 2. Clear the previous timer if the user is still actively typing
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current)
      }

      // 3. Set a new timer. If they stop typing for 1000ms, it saves.
      saveTimeout.current = setTimeout(() => {
        saveWholeDocument(currentHtml)
      }, 1000)
    },
  });

  return (
    <>
      <EditorContent className='min-w-3xl min-h-screen px-20' editor={editor} />
    </>
  )
}