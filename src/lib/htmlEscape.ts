// Server-side escaping for text going into HTML this app stores/renders,
// used anywhere content originates from something other than the client's
// own sanitizeHtml (which needs a browser window and can't run here) —
// GitHub webhook payloads, LLM completions.
export function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Plain-text extraction for feeding stored entry HTML into an LLM prompt —
// not a security boundary, just strips markup so the model sees prose.
export function stripHtmlTags(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
