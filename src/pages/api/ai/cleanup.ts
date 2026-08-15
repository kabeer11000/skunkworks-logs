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
  if (!text) return new Response(JSON.stringify({ error: 'Nothing to refine' }), { status: 400 })

  const raw = await chatComplete([
    {
      role: 'system',
      content:
        'Fix the grammar, spelling, and tone of the following engineering log entry. Make minimal changes — correct mistakes and smooth awkward phrasing, but keep the original wording, structure, and meaning as close to the original as possible. Do not rewrite it into different phrasing, add headings or bullet points, or add any meta-commentary. Preserve all technical details exactly as given.',
    },
    { role: 'user', content: text },
  ])

  return new Response(
    JSON.stringify({ text: escapeHtml(raw.trim()) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
