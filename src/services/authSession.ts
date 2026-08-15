// The signed-in user's own CouchDB credentials (never a cookie — see the
// cross-origin note below). Used to authenticate this client's own PouchDB
// sync directly against CouchDB with Basic Auth, replacing the single shared
// admin credential that used to be embedded in VITE_COUCHDB_URL. A session
// cookie from CouchDB's own /_session can't be used here instead — it's
// scoped to CouchDB's origin, which is a different domain than this app, and
// a response from this app's server can't set a cookie for a domain it
// doesn't control.
//
// localStorage, not sessionStorage: sessionStorage is scoped per tab, but
// the sk_identity cookie (checked server-side, see index.astro) is a single
// year-long cookie shared across every tab. Storing the credential in
// sessionStorage meant opening drains.dev in a *new* tab while already
// logged in elsewhere saw the cookie but an empty per-tab credential store,
// which AppSidebar.tsx treated as "signed out" and force-cleared the cookie
// for every tab — the actual cause of users randomly landing on the
// logged-out page. localStorage matches the cookie's actual lifetime.
const KEY = 'sk_auth'

export interface AuthCredential {
  email: string
  password: string
}

export function setAuthCredential(email: string, password: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify({ email, password }))
}

export function getAuthCredential(): AuthCredential | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuthCredential() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}

export function logout() {
  clearAuthCredential()
  document.cookie = 'sk_identity=; path=/; max-age=0'
  window.location.href = '/'
}
