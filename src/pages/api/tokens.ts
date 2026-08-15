import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { createApiToken, listApiTokens } from '@/lib/couchdb-admin'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const tokens = await listApiTokens(caller.email)
  return new Response(JSON.stringify({ tokens }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const POST: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Unnamed token'

  const token = await createApiToken(caller.email, name)
  return new Response(JSON.stringify({ token }), { status: 201, headers: { 'Content-Type': 'application/json' } })
}
