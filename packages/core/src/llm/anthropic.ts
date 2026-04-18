import Anthropic from '@anthropic-ai/sdk'
import type { LLMConfig } from '../types.js'

function getClient(config: LLMConfig): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
}

export async function callAnthropic(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  const client = getClient(config)
  const model = config.model || 'claude-sonnet-4-20250514'

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') return ''
  return block.text
}

export async function* streamAnthropic(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  const client = getClient(config)
  const model = config.model || 'claude-sonnet-4-20250514'

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}
