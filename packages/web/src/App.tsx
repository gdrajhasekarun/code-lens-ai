import { useState, useCallback } from 'react'
import { useAnalysisStore } from './store/analysisStore'
import { useAnalysis } from './hooks/useAnalysis'
import NodeGraph from './components/NodeGraph'
import Drawer from './components/Drawer'
import SettingsModal from './components/SettingsModal'
import OverviewTab from './components/tabs/OverviewTab'
import KeywordTab from './components/tabs/KeywordTab'
import DepsTab from './components/tabs/DepsTab'
import ChatTab from './components/tabs/ChatTab'
import type { ArchNode } from '@codelens-ai/core'

const PHASE_LABELS: Record<string, string> = {
  'fetching-tree': 'Fetching repository structure…',
  classifying: 'Classifying architecture with AI…',
  'fetching-files': 'Reading source files…',
  analyzing: 'Running analysis passes…',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'keywords', label: 'Keyword Inventory' },
  { id: 'deps', label: 'Dependency Flow' },
  { id: 'chat', label: 'Q&A Chat' },
] as const

export default function App() {
  const store = useAnalysisStore()
  const { analyzeRepo, proceedToAnalysis } = useAnalysis()

  const [url, setUrl] = useState(() => localStorage.getItem('codelens-url') ?? '')
  const [token, setToken] = useState(() => localStorage.getItem('codelens-token') ?? '')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null)

  const isAnalyzing = ['fetching-tree', 'classifying'].includes(store.phase)
  const showGraph = ['graph', 'fetching-files', 'analyzing', 'done'].includes(store.phase)
  const showTabs = ['fetching-files', 'analyzing', 'done'].includes(store.phase)

  function handleAnalyze() {
    localStorage.setItem('codelens-url', url)
    if (token) localStorage.setItem('codelens-token', token)
    analyzeRepo(url, token || undefined)
  }

  const handleNodeClick = useCallback((node: ArchNode) => {
    setSelectedNode(node)
  }, [])

  function handleProceed() {
    proceedToAnalysis()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        height: 52,
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        background: '#161b22',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#BA7517" strokeWidth="1.5"/>
            <path d="M8 12h8M12 8v8" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>CodeLens AI</span>
          <span style={{ color: '#484f58', fontSize: 12 }}>keyword-driven framework intelligence</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{
              background: store.settings ? '#BA751720' : '#21262d',
              border: `1px solid ${store.settings ? '#BA7517' : '#30363d'}`,
              borderRadius: 6,
              color: store.settings ? '#BA7517' : '#8b949e',
              cursor: 'pointer',
              padding: '5px 10px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>⚙</span>
            {store.settings ? store.settings.model : 'Configure LLM'}
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '24px 20px' }}>
        {/* Input section */}
        {store.phase === 'idle' && (
          <div style={{ maxWidth: 680, margin: '60px auto 0' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e6edf3', marginBottom: 8, textAlign: 'center' }}>
              Analyze a Keyword-Driven Framework
            </h1>
            <p style={{ color: '#8b949e', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
              Paste a GitHub URL to get an architecture graph, keyword inventory, and dependency walkthrough.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://github.com/owner/repo"
                style={{
                  padding: '12px 16px',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 8,
                  color: '#e6edf3',
                  fontSize: 14,
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Private repo? Add GitHub token (optional)"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: 8,
                    color: '#e6edf3',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={!url.trim() || !store.settings}
                  title={!store.settings ? 'Configure LLM first' : ''}
                  style={{
                    padding: '10px 24px',
                    background: '#BA7517',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: url.trim() && store.settings ? 'pointer' : 'not-allowed',
                    opacity: url.trim() && store.settings ? 1 : 0.5,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Analyze →
                </button>
              </div>
              {!store.settings && (
                <p style={{ color: '#BA7517', fontSize: 12, textAlign: 'center' }}>
                  Configure an LLM provider in Settings before analyzing.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isAnalyzing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <p style={{ color: '#8b949e', fontSize: 14 }}>{PHASE_LABELS[store.phase] ?? 'Working…'}</p>
          </div>
        )}

        {/* Error */}
        {store.error && (
          <div style={{
            background: '#993C1D20',
            border: '1px solid #993C1D',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#e6edf3',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{store.error}</span>
            <button
              onClick={() => { store.setError(null); store.reset() }}
              style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 14 }}
            >
              ✕ Reset
            </button>
          </div>
        )}

        {/* Graph */}
        {showGraph && store.graphData && (
          <div>
            {/* Repo badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                background: '#21262d',
                border: '1px solid #30363d',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 13,
                color: '#e6edf3',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}>
                {store.repoInfo?.owner}/{store.repoInfo?.repo}
              </div>
              <span style={{ color: '#484f58', fontSize: 12 }}>
                {store.filePaths.length} files · {store.graphData.nodes.length} modules
              </span>
              <button
                onClick={() => store.reset()}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  color: '#8b949e',
                  cursor: 'pointer',
                  padding: '3px 10px',
                  fontSize: 12,
                }}
              >
                ← New analysis
              </button>
            </div>

            <NodeGraph
              graph={store.graphData}
              onNodeClick={handleNodeClick}
              height={showTabs ? 280 : 520}
            />

            {/* Proceed button */}
            {store.phase === 'graph' && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={handleProceed}
                  style={{
                    padding: '11px 32px',
                    background: '#BA7517',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Proceed to Deep Analysis →
                </button>
              </div>
            )}

            {/* Analysis tabs */}
            {showTabs && (
              <div style={{ marginTop: 20 }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid #30363d', marginBottom: 0 }}>
                  {TABS.map((tab) => {
                    const tabData = store.tabs[tab.id as keyof typeof store.tabs]
                    const isLoading = tabData.status === 'loading'
                    return (
                      <button
                        key={tab.id}
                        onClick={() => store.setActiveTab(tab.id)}
                        style={{
                          padding: '10px 16px',
                          background: 'none',
                          border: 'none',
                          borderBottom: `2px solid ${store.activeTab === tab.id ? '#BA7517' : 'transparent'}`,
                          color: store.activeTab === tab.id ? '#BA7517' : '#8b949e',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: store.activeTab === tab.id ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'color 150ms',
                        }}
                      >
                        {tab.label}
                        {isLoading && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <div style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  minHeight: 300,
                  maxHeight: 600,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {store.activeTab === 'overview' && <OverviewTab />}
                  {store.activeTab === 'keywords' && <KeywordTab />}
                  {store.activeTab === 'deps' && <DepsTab />}
                  {store.activeTab === 'chat' && <ChatTab />}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Drawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  )
}
