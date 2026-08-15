import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getAiUsage } from '@/lib/couchdb-admin'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const usage = await getAiUsage(caller.email)
  return new Response(JSON.stringify({ usage }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
