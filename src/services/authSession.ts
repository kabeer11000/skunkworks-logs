// The signed-in user's own CouchDB credentials, held only in sessionStorage
// (cleared when the tab closes — never localStorage, never a cookie). Used
// to authenticate this client's own PouchDB sync directly against CouchDB
// with Basic Auth, replacing the single shared admin credential that used
// to be embedded in VITE_COUCHDB_URL. A session cookie from CouchDB's own
// /_session can't be used here instead — it's scoped to CouchDB's origin,
// which is a different domain than this app, and a response from this
// app's server can't set a cookie for a domain it doesn't control.
const KEY = 'sk_auth'

export interface AuthCredential {
  email: string
  password: string
}

export function setAuthCredential(email: string, password: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(KEY, JSON.stringify({ email, password }))
}

export function getAuthCredential(): AuthCredential | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuthCredential() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(KEY)
}

export function logout() {
  clearAuthCredential()
  document.cookie = 'sk_identity=; path=/; max-age=0'
  window.location.href = '/'
}
