import OpenAI, { AzureOpenAI } from 'openai'
import type { LLMConfig } from '../types'

function getClient(config: LLMConfig): OpenAI {
  if (config.provider === 'azure') {
    return new AzureOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      apiVersion: config.apiVersion || '2024-02-01',
    })
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
}

export async function callOpenAI(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  const client = getClient(config)
  const model = config.model || 'gpt-4o'

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function* streamOpenAI(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  const client = getClient(config)
  const model = config.model || 'gpt-4o'

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    stream: true,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
  }
}
