// Plain-text preview for entry content (RecentActivity, CommandPalette) —
// strips tags AND decodes entities via the DOM parser, so text that went
// through htmlEscape.ts (AI cleanup/summary responses) doesn't leak literal
// "&#39;"-style entities into a snippet that's rendered as plain JSX text
// (only markup-consuming contexts like set:html re-parse and decode those).
export function stripHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}
