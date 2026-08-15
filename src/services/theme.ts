export type Theme = 'light' | 'dark' | 'system'

const KEY = 'sk_theme'

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system'
  const raw = localStorage.getItem(KEY)
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

function prefersDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}

// Only matters while 'system' is selected — re-applies if the OS-level
// preference flips while the app is open (e.g. system dark mode schedule).
export function watchSystemTheme() {
  if (typeof matchMedia === 'undefined') return () => {}
  const mql = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getStoredTheme() === 'system') applyTheme('system')
  }
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
