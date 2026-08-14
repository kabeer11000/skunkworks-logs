import { authHeader, parseErrorOr } from './apiAuth'

export async function cleanupText(text: string): Promise<{ text: string }> {
  const res = await fetch('/api/ai/cleanup', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return parseErrorOr(res, 'Failed to clean up text')
}

export async function summarizeEntries(dbName: string, entryIds: string[]): Promise<void> {
  const res = await fetch(`/api/drains/${dbName}/summarize`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryIds }),
  })
  await parseErrorOr(res, 'Failed to summarize')
}
