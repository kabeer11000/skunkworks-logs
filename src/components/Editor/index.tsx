import { TextStyleKit } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import './style.css'
import { $drains } from '@/helpers/drains'

const extensions = [TextStyleKit, StarterKit]

export default ({id}: {id: string}) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: $drains.get().find((drain) => drain._id === id).title,
  })

  return (
    <>
      <EditorContent className='min-w-2xl max-w-2xl min-h-2xl' editor={editor} />
    </>
  )
}