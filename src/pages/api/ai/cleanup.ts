import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { chatComplete } from '@/lib/minimax'
import { escapeHtml } from '@/lib/htmlEscape'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return new Response(JSON.stringify({ error: 'Nothing to clean up' }), { status: 400 })

  const raw = await chatComplete([
    {
      role: 'system',
      content:
        'Rewrite the following rough note into a clean, well-written engineering log entry — a sentence or two, plain prose, first person, no headings, no bullet points, no meta-commentary. Keep the original meaning and any technical details exactly as given.',
    },
    { role: 'user', content: text },
  ])

  return new Response(
    JSON.stringify({ text: escapeHtml(raw.trim()) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
