const VAULT_KEY = 'sk_vault';

export function getVault() {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setVaultKey(notebookId, key) {
  const vault = getVault();
  vault[notebookId] = key;
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function getVaultKey(notebookId) {
  return getVault()[notebookId] || null;
}
