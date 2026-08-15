import Mention from '@tiptap/extension-mention'
import { listDrainMembers } from '@/services/drainsApi'

// Same deterministic-hue idea as deriveIdentity's color derivation, but
// synchronous (no crypto.subtle) since renderHTML can't await — good enough
// for "consistent color per person," which is all a mention pill needs.
// Returns both a solid text color and a translucent background — string-
// concatenating "22" (hex alpha shorthand) onto an hsl() value doesn't work
// like it does for hex colors, hsl() needs its own explicit alpha argument,
// confirmed by testing the resulting CSS wasn't being applied.
function colorsForEmail(email: string) {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return { text: `hsl(${hue}, 35%, 45%)`, background: `hsl(${hue}, 35%, 45%, 0.13)` }
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
    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'px-2 py-1.5 text-xs text-muted-foreground'
      empty.textContent = 'No matching members'
      container.appendChild(empty)
      return
    }
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

    const hint = document.createElement('div')
    hint.className = 'mt-0.5 border-t px-2 pt-1 text-[10px] text-muted-foreground'
    hint.textContent = '↑↓ navigate · ↵ select · Esc cancel'
    container!.appendChild(hint)
  }

  return {
    onStart: (props: any) => {
      items = props.items
      onPick = props.command ? (email: string) => props.command({ id: email }) : null
      container = document.createElement('div')
      container.setAttribute('data-suggestion-popup', 'mention')
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
      const { text: color, background } = colorsForEmail(node.attrs.id || '')
      return [
        'span',
        {
          class: 'mention-pill',
          'data-type': 'mention',
          'data-id': node.attrs.id,
          style: `background:${background};color:${color}`,
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
