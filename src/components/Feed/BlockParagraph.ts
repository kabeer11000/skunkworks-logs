import Paragraph from '@tiptap/extension-paragraph'

// Every top-level paragraph IS a block/entry. entryId is the stable link
// back to its `entry:<notebookId>:<entryId>` PouchDB doc — null means the
// block hasn't been assigned one yet (see AssignBlockId).
export const BlockParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entryId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-entry-id'),
        renderHTML: (attrs: any) => (attrs.entryId ? { 'data-entry-id': attrs.entryId } : {}),
      },
      authorColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-author-color'),
        renderHTML: (attrs: any) =>
          attrs.authorColor ? { 'data-author-color': attrs.authorColor, style: `background-color:${tint(attrs.authorColor)}` } : {},
      },
      authorName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-author-name'),
        renderHTML: (attrs: any) => {
          if (!attrs.authorName) return {}
          const time = attrs.updatedAt
            ? new Date(Number(attrs.updatedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''
          return {
            'data-author-name': attrs.authorName,
            title: time ? `${attrs.authorName} · ${time}` : attrs.authorName,
          }
        },
      },
      updatedAt: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-updated-at'),
        renderHTML: (attrs: any) => (attrs.updatedAt ? { 'data-updated-at': attrs.updatedAt } : {}),
      },
    }
  },
})

function tint(color: string, alpha = 0.12) {
  const m = color.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/)
  if (!m) return color
  return `hsl(${m[1]} ${m[2]}% ${m[3]}% / ${alpha})`
}
