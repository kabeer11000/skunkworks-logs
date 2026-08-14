import Mention from '@tiptap/extension-mention'
import { listDrainMembers } from '@/services/drainsApi'

// Same deterministic-hue idea as deriveIdentity's color derivation, but
// synchronous (no crypto.subtle) since renderHTML can't await — good enough
// for "consistent color per person," which is all a mention pill needs.
function colorForEmail(email: string) {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 35%, 45%)`
}

// Cached per drain for the lifetime of this editor instance — members don't
// change often enough to justify refetching on every keystroke while typing
// after "@".
const membersCache = new Map<string, Promise<string[]>>()

function getMembers(dbName: string): Promise<string[]> {
  let cached = membersCache.get(dbName)
  if (!cached) {
    cached = listDrainMembers(dbName).catch(() => [])
    membersCache.set(dbName, cached)
  }
  return cached
}

// Vanilla-DOM suggestion popup (no tippy.js dependency) — positioned via the
// clientRect Tiptap's suggestion plugin already computes from cursor
// position, matching the popover styling used elsewhere (AddCommentPopover).
function renderSuggestionList() {
  let container: HTMLDivElement | null = null
  let items: string[] = []
  let selected = 0
  let onPick: ((email: string) => void) | null = null

  const draw = () => {
    if (!container) return
    container.innerHTML = ''
    items.forEach((email, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = email
      btn.className = `block w-full truncate rounded-md px-2 py-1 text-left text-sm ${
        i === selected ? 'bg-accent' : ''
      }`
      btn.onmousedown = (e) => {
        e.preventDefault()
        onPick?.(email)
      }
      container!.appendChild(btn)
    })
  }

  return {
    onStart: (props: any) => {
      items = props.items
      onPick = props.command ? (email: string) => props.command({ id: email }) : null
      container = document.createElement('div')
      container.className =
        'fixed z-50 min-w-[180px] max-w-[260px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'
      document.body.appendChild(container)
      const rect = props.clientRect?.()
      if (rect && container) {
        container.style.left = `${rect.left}px`
        container.style.top = `${rect.bottom + 4}px`
      }
      draw()
    },
    onUpdate: (props: any) => {
      items = props.items
      selected = 0
      const rect = props.clientRect?.()
      if (rect && container) {
        container.style.left = `${rect.left}px`
        container.style.top = `${rect.bottom + 4}px`
      }
      draw()
    },
    onKeyDown: (props: any) => {
      if (!items.length) return false
      if (props.event.key === 'ArrowDown') {
        selected = (selected + 1) % items.length
        draw()
        return true
      }
      if (props.event.key === 'ArrowUp') {
        selected = (selected - 1 + items.length) % items.length
        draw()
        return true
      }
      if (props.event.key === 'Enter') {
        onPick?.(items[selected])
        return true
      }
      if (props.event.key === 'Escape') {
        container?.remove()
        return true
      }
      return false
    },
    onExit: () => {
      container?.remove()
      container = null
    },
  }
}

export function createMentionExtension(dbName: string) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention-pill' },
    // The Mention node's own renderHTML only auto-adds data-type/data-id
    // wrapping when this callback returns a plain string — since a full
    // ["span", attrs, text] array is returned here instead (needed for the
    // inline color style), both attributes have to be set explicitly or
    // parseHTML (which matches span[data-type="mention"]) can't round-trip
    // a mention back out of stored/reloaded content.
    renderHTML({ node }) {
      const color = colorForEmail(node.attrs.id || '')
      return [
        'span',
        {
          class: 'mention-pill',
          'data-type': 'mention',
          'data-id': node.attrs.id,
          style: `background:${color}22;color:${color}`,
        },
        `@${node.attrs.id}`,
      ]
    },
    suggestion: {
      char: '@',
      items: async ({ query }: { query: string }) => {
        const members = await getMembers(dbName)
        return members.filter((email) => email.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
      },
      render: renderSuggestionList,
    },
  })
}
