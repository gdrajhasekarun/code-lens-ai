import type { LLMConfig } from '../types.js'
import { callAnthropic, streamAnthropic } from './anthropic.js'
import { callOpenAI, streamOpenAI } from './openai.js'
import { callOpenRouter, streamOpenRouter } from './openrouter.js'
import { callGemini, streamGemini } from './gemini.js'
import { callEnterprise, streamEnterprise } from './enterprise.js'

export async function callLLM(
  config: LLMConfig,
  system: string,
  prompt: string
): Promise<string> {
  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config, system, prompt)
    case 'openai':
    case 'azure':
      return callOpenAI(config, system, prompt)
    case 'openrouter':
      return callOpenRouter(config, system, prompt)
    case 'gemini':
      return callGemini(config, system, prompt)
    case 'enterprise':
      return callEnterprise(config, system, prompt)
    case 'copilot':
      throw new Error('Copilot provider is only available inside the VS Code extension.')
    default:
      throw new Error(`Unknown provider: ${(config as LLMConfig).provider}`)
  }
}

export async function* streamLLM(
  config: LLMConfig,
  system: string,
  prompt: string
): AsyncGenerator<string> {
  switch (config.provider) {
    case 'anthropic':
      yield* streamAnthropic(config, system, prompt)
      break
    case 'openai':
    case 'azure':
      yield* streamOpenAI(config, system, prompt)
      break
    case 'openrouter':
      yield* streamOpenRouter(config, system, prompt)
      break
    case 'gemini':
      yield* streamGemini(config, system, prompt)
      break
    case 'enterprise':
      yield* streamEnterprise(config, system, prompt)
      break
    case 'copilot':
      throw new Error('Copilot provider is only available inside the VS Code extension.')
    default:
      throw new Error(`Unknown provider: ${(config as LLMConfig).provider}`)
  }
}
