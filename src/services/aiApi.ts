import { atom } from 'nanostores'
import { authHeader, parseErrorOr } from './apiAuth'

export interface AiUsage {
  used: number
  limit: number
  resetsAt: number
}

// Shared across every AI-triggering component (EditorToolbar, OutlineAside,
// UserMenu's usage indicator) so they all reflect the same up-to-date count
// without each needing its own fetch/poll.
export const $aiUsage = atom<AiUsage | null>(null)

export async function fetchAiUsage(): Promise<AiUsage> {
  const res = await fetch('/api/ai/usage', {
    headers: { Authorization: authHeader() },
  })
  const { usage } = await parseErrorOr<{ usage: AiUsage }>(res, 'Failed to load AI usage')
  $aiUsage.set(usage)
  return usage
}

export async function cleanupText(text: string): Promise<{ text: string }> {
  const res = await fetch('/api/ai/cleanup', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await parseErrorOr<{ text: string; usage: AiUsage }>(res, 'Failed to clean up text')
  $aiUsage.set(data.usage)
  return data
}

export async function summarizeEntries(dbName: string, entryIds: string[]): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}/summarize`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryIds }),
  })
  const data = await parseErrorOr<{ ok: true; usage: AiUsage }>(res, 'Failed to summarize')
  $aiUsage.set(data.usage)
}
