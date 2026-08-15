import type { APIRoute } from 'astro'
import { requireAuth } from '@/lib/requireAuth'
import { getAdminDoc, updateAdminDoc } from '@/lib/couchdb-admin'
import { deriveIdentity } from '@/services/identity'

export const prerender = false

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAuth(request)
  if (!auth) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2) {
    return new Response(JSON.stringify({ error: 'Name must be at least 2 characters' }), { status: 400 })
  }

  const { publicUserId } = await deriveIdentity(auth.email, name)
  const existing = await getAdminDoc('main', `profile:${publicUserId}`)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'No profile found for this account' }), { status: 404 })
  }

  await updateAdminDoc(
    'main',
    `profile:${publicUserId}`,
    (doc) => ({ ...doc, name }),
    () => existing
  )

  const identity = { publicUserId, name, color: existing.color, email: auth.email }

  // Name isn't re-derived server-side on every load — it's read straight
  // from this cookie (see AppSidebar.tsx's getStoredIdentityClient), so a
  // stale cookie would silently undo the rename on the next page load.
  cookies.set('sk_identity', JSON.stringify(identity), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  return new Response(JSON.stringify({ identity }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
