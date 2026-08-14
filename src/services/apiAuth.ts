import { getAuthCredential } from './authSession'

export function authHeader() {
  const cred = getAuthCredential()
  if (!cred) throw new Error('Not signed in')
  return 'Basic ' + btoa(`${cred.email}:${cred.password}`)
}

export async function parseErrorOr<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json()
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error || fallback)
}
