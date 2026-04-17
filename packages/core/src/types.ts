export type LLMProvider = 'anthropic' | 'openai' | 'azure' | 'openrouter' | 'gemini'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model: string
  baseUrl?: string
  apiVersion?: string
}

export type NodeRole =
  | 'Runner'
  | 'Keyword Engine'
  | 'Excel Reader'
  | 'Page Object'
  | 'Config'
  | 'Utilities'
  | 'Test Data'
  | 'Reports'
  | 'Unknown'

export interface ArchNode {
  id: string
  label: string
  role: NodeRole
  path: string
  description: string
  files: string[]
}

export interface ArchEdge {
  from: string
  to: string
  label?: string
}

export interface ArchGraph {
  nodes: ArchNode[]
  edges: ArchEdge[]
}

export interface KeywordMapping {
  keyword: string
  methodName: string
  className: string
  description: string
  lineNumber?: number
}

export interface AnalysisResult {
  graph: ArchGraph
  overview: string
  keywords: KeywordMapping[]
  dependencies: string
}
