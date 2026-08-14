// Server-only. MINIMAX_API_KEY is NOT VITE_-prefixed, so Vite never inlines
// it into a client bundle — this module must only ever be imported from
// src/pages/api/** route files, never from client components.
const API_KEY = import.meta.env.MINIMAX_API_KEY as string | undefined
const BASE_URL = 'https://api.minimax.io/v1'
const MODEL = 'MiniMax-M2.7'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatComplete(messages: ChatMessage[], maxTokens = 1000): Promise<string> {
  if (!API_KEY) throw new Error('MINIMAX_API_KEY is not configured')

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      // M2.x models always think regardless of this flag — reasoning_split
      // routes that reasoning into reasoning_content instead of prefixing
      // it onto content, and it eats into max_completion_tokens, so the
      // budget needs headroom beyond just the visible answer length.
      reasoning_split: true,
      max_completion_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    throw new Error(`MiniMax API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('MiniMax API returned no content')
  return content
}
