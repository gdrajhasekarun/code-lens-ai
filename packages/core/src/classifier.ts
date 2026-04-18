import { callLLM } from './llm/adapter.js'
import type { ArchGraph, LLMConfig } from './types.js'

const SYSTEM = `You are an expert analyzing a keyword-driven Java test automation framework.
In this framework, test execution is driven by method names stored in Excel sheets.
Keywords defined in Excel cells map directly to Java methods via reflection, switch/case
dispatch, Map<String,Method> lookup, or annotation scanning (@Keyword).
Be precise and reference actual class and method names from the code provided.`

function buildPrompt(paths: string[]): string {
  return `Analyze the following file paths from a Java test automation repository and classify
the architecture into modules. Return a JSON object with this exact structure:

{
  "nodes": [
    {
      "id": "string (unique, camelCase)",
      "label": "string (short display name, max 18 chars)",
      "role": "Runner|Keyword Engine|Excel Reader|Page Object|Config|Utilities|Test Data|Reports|Unknown",
      "path": "string (primary folder path)",
      "description": "string (1-2 sentences about this module's role)",
      "files": ["array", "of", "relevant", "file", "paths"]
    }
  ],
  "edges": [
    {
      "from": "sourceNodeId",
      "to": "targetNodeId",
      "label": "optional relationship label"
    }
  ]
}

Rules:
- Maximum 12 nodes, grouped by folder
- Every edge must reference valid node IDs
- Focus on how Excel drives test execution through the keyword dispatch mechanism
- Include the execution flow: Runner → Excel Reader → Keyword Engine → Page Object

File paths:
${paths.join('\n')}`
}

export async function classifyArchitecture(
  paths: string[],
  llm: LLMConfig
): Promise<ArchGraph> {
  const prompt = buildPrompt(paths)

  async function attempt(): Promise<ArchGraph> {
    const raw = await callLLM(llm, SYSTEM, prompt)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in LLM response')
    return JSON.parse(match[0]) as ArchGraph
  }

  try {
    return await attempt()
  } catch {
    // Retry once on parse failure
    return await attempt()
  }
}
