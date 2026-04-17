import { callLLM } from './llm/adapter'
import type { LLMConfig } from './types'

const SYSTEM = `You are an expert analyzing a keyword-driven Java test automation framework.
In this framework, test execution is driven by method names stored in Excel sheets.
Keywords defined in Excel cells map directly to Java methods via reflection, switch/case
dispatch, Map<String,Method> lookup, or annotation scanning (@Keyword).
Be precise and reference actual class and method names from the code provided.`

function buildPrompt(context: string): string {
  return `Analyze the following Java test automation codebase and provide a detailed plain-English
walkthrough of the full execution flow. Structure your response with these exact sections:

## Entry Point
Describe the test runner class, how TestNG/JUnit triggers execution.

## Excel Reading
Describe how Excel files are read, which library is used (Apache POI, JXL), what columns are expected.

## Keyword Dispatch
Describe how Excel keyword values are resolved to Java methods (switch/case, reflection, Map lookup, annotation).

## Page Object Invocation
Describe how Page Objects are instantiated and browser actions are performed (Selenium, Playwright).

## Reporting & Teardown
Describe how test results are reported (Extent Reports, Allure, TestNG reports) and how cleanup happens.

Codebase:
${context.slice(0, 45000)}`
}

export async function analyzeDependencies(
  context: string,
  llm: LLMConfig
): Promise<string> {
  return callLLM(llm, SYSTEM, buildPrompt(context))
}
