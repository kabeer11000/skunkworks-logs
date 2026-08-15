import { authHeader, parseErrorOr } from './apiAuth'

export interface ApiToken {
  token: string
  name: string
  createdAt: number
  lastUsedAt: number | null
}

export async function listApiTokens(): Promise<ApiToken[]> {
  const res = await fetch('/api/tokens', { headers: { Authorization: authHeader() } })
  const data = await parseErrorOr<{ tokens: ApiToken[] }>(res, 'Failed to load tokens')
  return data.tokens
}

export async function createApiToken(name: string): Promise<string> {
  const res = await fetch('/api/tokens', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await parseErrorOr<{ token: string }>(res, 'Failed to create token')
  return data.token
}

export async function revokeApiToken(token: string): Promise<void> {
  const res = await fetch(`/api/tokens/${token}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader() },
  })
  await parseErrorOr(res, 'Failed to revoke token')
}
