declare module '@codelens-ai/core' {
  export type LLMProvider =
    | 'anthropic'
    | 'openai'
    | 'azure'
    | 'openrouter'
    | 'gemini'
    | 'enterprise'
    | 'copilot'

  export interface LLMConfig {
    provider: LLMProvider
    apiKey: string
    model: string
    baseUrl?: string
    apiVersion?: string
    promptField?: string
    contextField?: string
    responseField?: string
    headerName?: string
    extraHeaders?: Record<string, string>
  }

  export function callLLM(
    config: LLMConfig,
    system: string,
    prompt: string
  ): Promise<string>

  export function streamLLM(
    config: LLMConfig,
    system: string,
    prompt: string
  ): AsyncGenerator<string>

  export function selectKeyFiles(paths: string[]): string[]
}
