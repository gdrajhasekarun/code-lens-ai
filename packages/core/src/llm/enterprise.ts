import type { LLMConfig } from '../types.js'

export async function callEnterprise(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  if (!config.baseUrl) throw new Error('Enterprise provider requires a Base URL')

  const headerName = config.headerName ?? 'x-api-key'
  const promptField = config.promptField ?? 'prompt'
  const contextField = config.contextField ?? 'context'
  const responseField = config.responseField ?? 'response'

  const body: Record<string, string> = {
    [promptField]: `${system}\n\n---\n\n${prompt}`,
    [contextField]: '',
  }
  if (config.model) body['model'] = config.model

  const res = await fetch(`${config.baseUrl}/llm/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [headerName]: config.apiKey,
      ...config.extraHeaders,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Enterprise API error ${res.status}: ${text}`)
  }

  const data = await res.json() as Record<string, unknown>
  const value = responseField.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key]
    return undefined
  }, data)

  if (typeof value !== 'string') {
    throw new Error(
      `Enterprise API response did not contain field '${responseField}'. Got: ${JSON.stringify(data)}`
    )
  }
  return value
}

export async function* streamEnterprise(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  const result = await callEnterprise(config, system, prompt)
  yield result
}
