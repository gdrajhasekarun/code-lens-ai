import { callLLM } from './llm/adapter'
import type { KeywordMapping, LLMConfig } from './types'

const SYSTEM = `You are an expert analyzing a keyword-driven Java test automation framework.
In this framework, test execution is driven by method names stored in Excel sheets.
Keywords defined in Excel cells map directly to Java methods via reflection, switch/case
dispatch, Map<String,Method> lookup, or annotation scanning (@Keyword).
Be precise and reference actual class and method names from the code provided.`

function buildPrompt(fileContents: string): string {
  return `Analyze the following Java source code and extract all keyword mappings.
Look for these dispatch patterns:
- switch/case statements where cases are keyword strings
- Map<String, Method> or Map<String, Runnable> mappings
- Reflection-based invocation (method.invoke)
- @Keyword annotations on methods
- if-else chains dispatching on keyword strings

Return a JSON array with this exact structure:
[
  {
    "keyword": "string (the keyword name as used in Excel)",
    "methodName": "string (the Java method name)",
    "className": "string (the Java class name)",
    "description": "string (what this keyword does, 1 sentence)",
    "lineNumber": 42
  }
]

Rules:
- Maximum 50 keywords
- Return [] if no keyword dispatch pattern found
- lineNumber is optional — only include if clearly identifiable
- Return ONLY the JSON array, no explanation

Source code:
${fileContents.slice(0, 30000)}`
}

export async function extractKeywords(
  fileContents: string,
  llm: LLMConfig
): Promise<KeywordMapping[]> {
  try {
    const raw = await callLLM(llm, SYSTEM, buildPrompt(fileContents))
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as KeywordMapping[]
    return Array.isArray(parsed) ? parsed.slice(0, 50) : []
  } catch {
    return []
  }
}
