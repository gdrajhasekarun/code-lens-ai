import type { LLMConfig } from '../types.js'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[]
    }
  }[]
}

export async function callGemini(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  const model = config.model || 'gemini-1.5-pro'
  const base = config.baseUrl || BASE_URL
  const url = `${base}/models/${model}:generateContent?key=${config.apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as GeminiResponse
  return data.candidates[0]?.content?.parts[0]?.text ?? ''
}

export async function* streamGemini(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  const model = config.model || 'gemini-1.5-pro'
  const base = config.baseUrl || BASE_URL
  const url = `${base}/models/${model}:streamGenerateContent?key=${config.apiKey}&alt=sse`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new Error(`Gemini error ${res.status}: ${text}`)
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
      try {
        const parsed = JSON.parse(payload) as GeminiResponse
        const text = parsed.candidates[0]?.content?.parts[0]?.text
        if (text) yield text
      } catch {
        // skip malformed chunks
      }
    }
  }
}
