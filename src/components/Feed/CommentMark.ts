import { Mark } from '@tiptap/core'

// Lives inside the paragraph's own content, so applying/removing it goes
// through the normal editor onUpdate -> scheduleSave -> flushBlocks path —
// no separate save/sync code needed for the highlight itself. Must stay in
// services/sanitize.js's allowlist or every save strips it back out.
export const CommentMark = Mark.create({
  name: 'comment',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs: any) => (attrs.commentId ? { 'data-comment-id': attrs.commentId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'mark[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0]
  },
})
