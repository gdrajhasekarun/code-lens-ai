import * as vscode from 'vscode'
import type { LLMProvider } from '@codelens-ai/core'

export interface EnterpriseConfig {
  baseUrl?: string
  headerName?: string
  promptField?: string
  contextField?: string
  responseField?: string
}

export class SecretManager {
  constructor(private context: vscode.ExtensionContext) {}

  async getKey(provider: LLMProvider): Promise<string | undefined> {
    return this.context.secrets.get(`codelens-ai.${provider}`)
  }

  async setKey(provider: LLMProvider, key: string): Promise<void> {
    return this.context.secrets.store(`codelens-ai.${provider}`, key)
  }

  async deleteKey(provider: LLMProvider): Promise<void> {
    return this.context.secrets.delete(`codelens-ai.${provider}`)
  }

  getEnterpriseConfig(): EnterpriseConfig {
    const cfg = vscode.workspace.getConfiguration('codelens-ai')
    return cfg.get<EnterpriseConfig>('enterprise') ?? {}
  }

  async setEnterpriseConfig(config: EnterpriseConfig): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('codelens-ai')
    await cfg.update('enterprise', config, vscode.ConfigurationTarget.Global)
  }

  async getSettings(): Promise<Record<string, string>> {
    const providers: LLMProvider[] = ['anthropic', 'openai', 'azure', 'openrouter', 'gemini', 'enterprise']
    const result: Record<string, string> = {}
    for (const p of providers) {
      const key = await this.getKey(p)
      if (key) result[p] = key
    }
    return result
  }
}
