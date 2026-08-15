import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { revokeApiToken } from '@/lib/couchdb-admin'

export const prerender = false

export const DELETE: APIRoute = async ({ request, params }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  await revokeApiToken(caller.email, params.token!)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
