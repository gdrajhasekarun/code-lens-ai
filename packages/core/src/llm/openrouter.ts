import type { LLMConfig } from '../types.js'

const BASE_URL = 'https://openrouter.ai/api/v1'

export async function callOpenRouter(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  const model = config.model || 'meta-llama/llama-3.1-8b-instruct'
  const url = `${config.baseUrl || BASE_URL}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ''
}

export async function* streamOpenRouter(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  const model = config.model || 'meta-llama/llama-3.1-8b-instruct'
  const url = `${config.baseUrl || BASE_URL}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as { choices: { delta: { content?: string } }[] }
        const text = parsed.choices[0]?.delta?.content
        if (text) yield text
      } catch {
        // skip malformed chunks
      }
    }
  }
}
