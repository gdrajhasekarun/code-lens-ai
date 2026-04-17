import { useAnalysisStore } from '../store/analysisStore'
import { apiGetTree, apiGetContent, apiStreamLLM, apiCallLLM } from '../api'
import { selectKeyFiles } from '@codelens-ai/core'
import type { KeywordMapping } from '@codelens-ai/core'

const SYSTEM = `You are an expert analyzing a keyword-driven Java test automation framework.
In this framework, test execution is driven by method names stored in Excel sheets.
Keywords defined in Excel cells map directly to Java methods via reflection, switch/case
dispatch, Map<String,Method> lookup, or annotation scanning (@Keyword).
Be precise and reference actual class and method names from the code provided.`

function parseOwnerRepo(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(?:\/|$)/)
  if (!match) throw new Error('Invalid GitHub URL — expected https://github.com/owner/repo')
  return { owner: match[1], repo: match[2] }
}

function buildContext(files: { path: string; content: string }[]): string {
  const MAX_TOTAL = 50 * 1024
  const MAX_FILE = 3000
  const parts: string[] = []
  let total = 0

  for (const f of files) {
    if (!f.content) continue
    const truncated = f.content.length > MAX_FILE ? f.content.slice(0, MAX_FILE) + '\n... [truncated]' : f.content
    const entry = `\n\n// FILE: ${f.path}\n${truncated}`
    if (total + entry.length > MAX_TOTAL) break
    parts.push(entry)
    total += entry.length
  }

  return parts.join('')
}

export function useAnalysis() {
  const store = useAnalysisStore()

  async function analyzeRepo(url: string, token?: string) {
    store.setError(null)

    if (!store.settings) {
      store.setError('Configure an LLM provider in Settings first')
      return
    }

    try {
      const { owner, repo } = parseOwnerRepo(url)
      store.setRepoInfo({ owner, repo, token })
      store.setPhase('fetching-tree')

      const paths = await apiGetTree(owner, repo, token)
      store.setFilePaths(paths)
      store.setPhase('classifying')

      const classifyPrompt = `Analyze these file paths from a Java test automation repository and return an architecture graph as JSON.

Return ONLY this JSON structure (no markdown fences):
{
  "nodes": [
    {
      "id": "camelCaseId",
      "label": "Short Name",
      "role": "Runner|Keyword Engine|Excel Reader|Page Object|Config|Utilities|Test Data|Reports|Unknown",
      "path": "src/main/folder",
      "description": "What this module does in 1-2 sentences.",
      "files": ["path/File.java"]
    }
  ],
  "edges": [
    { "from": "nodeId1", "to": "nodeId2", "label": "calls" }
  ]
}

Rules: max 12 nodes, edges must reference valid IDs, focus on keyword dispatch flow.

File paths:
${paths.slice(0, 200).join('\n')}`

      let graphJson = ''
      const graphStream = apiStreamLLM({
        ...store.settings,
        system: SYSTEM,
        prompt: classifyPrompt,
      })

      for await (const chunk of graphStream) {
        graphJson += chunk
      }

      try {
        const match = graphJson.match(/\{[\s\S]*\}/)
        if (match) {
          store.setGraphData(JSON.parse(match[0]))
        }
      } catch {
        // Retry with non-streaming call
        try {
          const raw = await apiCallLLM({
            ...store.settings,
            system: SYSTEM,
            prompt: classifyPrompt,
          })
          const match = raw.match(/\{[\s\S]*\}/)
          if (match) store.setGraphData(JSON.parse(match[0]))
        } catch {
          store.setError('Failed to parse architecture graph — try again')
          store.setPhase('idle')
          return
        }
      }

      store.setPhase('graph')
    } catch (err) {
      store.setError((err as Error).message)
      store.setPhase('idle')
    }
  }

  async function proceedToAnalysis() {
    if (!store.settings || !store.repoInfo) return

    try {
      store.setPhase('fetching-files')
      const keyPaths = selectKeyFiles(store.filePaths)
      const files = await apiGetContent(
        store.repoInfo.owner,
        store.repoInfo.repo,
        keyPaths,
        store.repoInfo.token
      )
      const context = buildContext(files)
      store.setContext(context)
      store.setPhase('analyzing')

      // Run 3 passes concurrently
      await Promise.all([
        runOverviewPass(context),
        runKeywordsPass(files),
        runDepsPass(context),
      ])

      store.setPhase('done')
    } catch (err) {
      store.setError((err as Error).message)
    }
  }

  async function runOverviewPass(context: string) {
    store.setOverview('loading', '')

    const prompt = `Analyze this keyword-driven Java test automation framework and produce a structured overview.

Use these exact section headers:
## What This Framework Tests
## Tech Stack
## How Excel Drives Execution
## Execution Flow
## Key Design Patterns

Be concise and specific. Reference actual class names from the code.

${context}`

    try {
      const stream = apiStreamLLM({ ...store.settings!, system: SYSTEM, prompt })
      for await (const chunk of stream) {
        store.appendOverview(chunk)
      }
      store.setOverview('done')
    } catch (err) {
      store.setOverview('done', `Error: ${(err as Error).message}`)
    }
  }

  async function runKeywordsPass(files: { path: string; content: string }[]) {
    store.setKeywords('loading')

    const keywordFiles = files
      .filter(f => {
        const lower = f.path.toLowerCase()
        return (
          lower.includes('keyword') ||
          lower.includes('action') ||
          lower.includes('dispatch') ||
          lower.includes('executor') ||
          lower.includes('engine')
        )
      })
      .slice(0, 5)

    const content = keywordFiles.length > 0
      ? keywordFiles.map(f => `// FILE: ${f.path}\n${f.content.slice(0, 5000)}`).join('\n\n')
      : files.slice(0, 3).map(f => `// FILE: ${f.path}\n${f.content.slice(0, 3000)}`).join('\n\n')

    const prompt = `Extract all keyword mappings from this Java code. Return ONLY a JSON array (no markdown):
[
  {
    "keyword": "keywordName",
    "methodName": "javaMethodName",
    "className": "JavaClassName",
    "description": "What this keyword does",
    "lineNumber": 42
  }
]
Return [] if none found. Max 50 items.

${content}`

    try {
      const raw = await apiCallLLM({ ...store.settings!, system: SYSTEM, prompt })
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0]) as KeywordMapping[]
        store.setKeywords('done', Array.isArray(parsed) ? parsed : [])
      } else {
        store.setKeywords('done', [])
      }
    } catch {
      store.setKeywords('done', [])
    }
  }

  async function runDepsPass(context: string) {
    store.setDeps('loading', '')

    const prompt = `Analyze the execution flow of this keyword-driven Java test automation framework.

Use these exact section headers:
## Entry Point
## Excel Reading
## Keyword Dispatch
## Page Object Invocation
## Reporting & Teardown

Be specific — reference actual class and method names.

${context}`

    try {
      const stream = apiStreamLLM({ ...store.settings!, system: SYSTEM, prompt })
      for await (const chunk of stream) {
        store.appendDeps(chunk)
      }
      store.setDeps('done')
    } catch (err) {
      store.setDeps('done', `Error: ${(err as Error).message}`)
    }
  }

  return { analyzeRepo, proceedToAnalysis }
}
