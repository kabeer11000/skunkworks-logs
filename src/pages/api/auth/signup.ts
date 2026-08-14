import type { APIRoute } from 'astro'
import {
  couchUserExists,
  createCouchUser,
  verifyCouchLogin,
  ensureMainDbOpenToAuthenticated,
  putAdminDoc,
} from '@/lib/couchdb-admin'
import { deriveIdentity } from '@/services/identity'

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (name.length < 2) {
    return new Response(JSON.stringify({ error: 'Name must be at least 2 characters' }), { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Enter a valid email address' }), { status: 400 })
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 })
  }

  if (await couchUserExists(email)) {
    return new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 409 })
  }

  await createCouchUser(email, password)
  await ensureMainDbOpenToAuthenticated()

  const identity = await deriveIdentity(email, name)
  await putAdminDoc('main', {
    _id: `profile:${identity.publicUserId}`,
    type: 'profile',
    publicUserId: identity.publicUserId,
    name: identity.name,
    color: identity.color,
    createdAt: Date.now(),
  })

  const ok = await verifyCouchLogin(email, password)
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Account created but login verification failed' }), { status: 500 })
  }

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
