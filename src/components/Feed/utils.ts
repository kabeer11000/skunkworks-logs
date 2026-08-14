export function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

// Safe extraction of author name
export function safeName(val: any): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object' && typeof val.name === 'string') return val.name
  return 'Anonymous'
}

// Safe extraction of author color. Identity colors are CSS hsl() strings
// (see deriveIdentity in services/identity.ts), not hex.
export function safeColor(val: any): string {
  if (typeof val === 'string' && val.trim()) return val
  if (val && typeof val === 'object' && typeof val.color === 'string') return val.color
  return '#999'
}
