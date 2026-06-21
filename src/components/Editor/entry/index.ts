import { Mark } from '@tiptap/core'
import { ReactMarkViewRenderer } from '@tiptap/react'
import Component from './component'

export default Mark.create({
  name: 'entryMark',

  addAttributes() {
    return {
      'data-author': { default: "Unknown Author" },
      'data-color': { default: "#91b5fc" },
      'data-updated-at': { default: null }, // Add this!
    }
  },

  parseHTML() {
    return [{ tag: 'entry' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['entry', HTMLAttributes]
  },

  addMarkView() {
    return ReactMarkViewRenderer(Component)
  },
})