import type { APIRoute } from 'astro'
import { ulid } from 'ulid'
import { requireAuth } from '@/lib/requireAuth'
import { provisionDrainDatabase, addDirectoryDrain, getDirectoryDrains, putAdminDoc } from '@/lib/couchdb-admin'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const drains = await getDirectoryDrains(caller.email)
  return new Response(JSON.stringify({ drains }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const POST: APIRoute = async ({ request }) => {
  const caller = await requireAuth(request)
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled'
  const visibility = body.visibility === 'shared' ? 'shared' : 'private'
  const description = typeof body.description === 'string' ? body.description.trim() || undefined : undefined
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : undefined

  const dbName = `drain-${ulid().toLowerCase()}`
  await provisionDrainDatabase(dbName, caller.email)
  await putAdminDoc(dbName, {
    _id: 'notebook',
    type: 'notebook',
    title,
    description,
    tags,
    visibility,
    createdBy: caller.email,
    createdAt: Date.now(),
  })
  await addDirectoryDrain(caller.email, {
    dbName,
    title,
    description,
    tags,
    visibility,
    role: 'owner',
    joinedAt: Date.now(),
  })

  return new Response(JSON.stringify({ dbName }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
