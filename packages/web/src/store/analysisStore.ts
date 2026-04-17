import { create } from 'zustand'
import type { ArchGraph, KeywordMapping, LLMConfig } from '@codelens-ai/core'

export type Phase =
  | 'idle'
  | 'fetching-tree'
  | 'classifying'
  | 'graph'
  | 'fetching-files'
  | 'analyzing'
  | 'done'

export type TabStatus = 'idle' | 'loading' | 'done'

export interface RepoInfo {
  owner: string
  repo: string
  token?: string
}

interface TabState<T> {
  status: TabStatus
  data: T
}

interface AnalysisState {
  repoInfo: RepoInfo | null
  filePaths: string[]
  graphData: ArchGraph | null
  phase: Phase
  error: string | null
  context: string
  tabs: {
    overview: TabState<string>
    keywords: TabState<KeywordMapping[]>
    deps: TabState<string>
  }
  settings: LLMConfig | null
  activeTab: 'overview' | 'keywords' | 'deps' | 'chat'
  selectedNodeId: string | null

  setRepoInfo: (info: RepoInfo) => void
  setFilePaths: (paths: string[]) => void
  setGraphData: (graph: ArchGraph) => void
  setPhase: (phase: Phase) => void
  setError: (error: string | null) => void
  setContext: (ctx: string) => void
  setOverview: (status: TabStatus, content?: string) => void
  appendOverview: (chunk: string) => void
  setKeywords: (status: TabStatus, data?: KeywordMapping[]) => void
  setDeps: (status: TabStatus, content?: string) => void
  appendDeps: (chunk: string) => void
  setSettings: (settings: LLMConfig) => void
  setActiveTab: (tab: 'overview' | 'keywords' | 'deps' | 'chat') => void
  setSelectedNodeId: (id: string | null) => void
  reset: () => void
}

const initialTabs = {
  overview: { status: 'idle' as TabStatus, data: '' },
  keywords: { status: 'idle' as TabStatus, data: [] as KeywordMapping[] },
  deps: { status: 'idle' as TabStatus, data: '' },
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  repoInfo: null,
  filePaths: [],
  graphData: null,
  phase: 'idle',
  error: null,
  context: '',
  tabs: { ...initialTabs },
  settings: (() => {
    try {
      const raw = localStorage.getItem('codelens-settings')
      return raw ? (JSON.parse(raw) as LLMConfig) : null
    } catch {
      return null
    }
  })(),
  activeTab: 'overview',
  selectedNodeId: null,

  setRepoInfo: (info) => set({ repoInfo: info }),
  setFilePaths: (paths) => set({ filePaths: paths }),
  setGraphData: (graph) => set({ graphData: graph }),
  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error }),
  setContext: (ctx) => set({ context: ctx }),

  setOverview: (status, content) =>
    set((s) => ({
      tabs: { ...s.tabs, overview: { status, data: content ?? s.tabs.overview.data } },
    })),
  appendOverview: (chunk) =>
    set((s) => ({
      tabs: { ...s.tabs, overview: { ...s.tabs.overview, data: s.tabs.overview.data + chunk } },
    })),

  setKeywords: (status, data) =>
    set((s) => ({
      tabs: { ...s.tabs, keywords: { status, data: data ?? s.tabs.keywords.data } },
    })),

  setDeps: (status, content) =>
    set((s) => ({
      tabs: { ...s.tabs, deps: { status, data: content ?? s.tabs.deps.data } },
    })),
  appendDeps: (chunk) =>
    set((s) => ({
      tabs: { ...s.tabs, deps: { ...s.tabs.deps, data: s.tabs.deps.data + chunk } },
    })),

  setSettings: (settings) => {
    localStorage.setItem('codelens-settings', JSON.stringify(settings))
    set({ settings })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  reset: () =>
    set({
      repoInfo: null,
      filePaths: [],
      graphData: null,
      phase: 'idle',
      error: null,
      context: '',
      tabs: {
        overview: { status: 'idle', data: '' },
        keywords: { status: 'idle', data: [] },
        deps: { status: 'idle', data: '' },
      },
      activeTab: 'overview',
      selectedNodeId: null,
    }),
}))
