import { useState, useEffect } from 'react'
import { useAnalysisStore } from '../store/analysisStore'
import { apiCallLLM } from '../api'
import type { LLMConfig, LLMProvider } from '@codelens-ai/core'

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'azure', label: 'Azure OpenAI' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'gemini', label: 'Google Gemini' },
]

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  azure: 'gpt-4o',
  openrouter: 'meta-llama/llama-3.1-8b-instruct',
  gemini: 'gemini-1.5-pro',
}

const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  azure: [],
  openrouter: [],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
}

function loadKey(provider: LLMProvider): string {
  return localStorage.getItem(`codelens-apikey-${provider}`) ?? ''
}

function saveKey(provider: LLMProvider, key: string) {
  localStorage.setItem(`codelens-apikey-${provider}`, key)
}

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const { settings, setSettings } = useAnalysisStore()

  const [provider, setProvider] = useState<LLMProvider>(settings?.provider ?? 'anthropic')
  const [apiKey, setApiKey] = useState(loadKey(settings?.provider ?? 'anthropic'))
  const [model, setModel] = useState(settings?.model ?? DEFAULT_MODELS['anthropic'])
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? '')
  const [apiVersion, setApiVersion] = useState(settings?.apiVersion ?? '2024-02-01')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    setApiKey(loadKey(provider))
    setModel(DEFAULT_MODELS[provider])
    setBaseUrl('')
    setTestStatus('idle')
  }, [provider])

  function handleSave() {
    saveKey(provider, apiKey)
    const cfg: LLMConfig = {
      provider,
      apiKey,
      model,
      ...(baseUrl ? { baseUrl } : {}),
      ...(provider === 'azure' && apiVersion ? { apiVersion } : {}),
    }
    setSettings(cfg)
    onClose()
  }

  async function handleTest() {
    setTestStatus('testing')
    setTestError('')
    try {
      const result = await apiCallLLM({
        provider,
        apiKey,
        model,
        baseUrl: baseUrl || undefined,
        apiVersion: apiVersion || undefined,
        system: 'You are a helpful assistant.',
        prompt: 'Say "hi" in exactly one word.',
      })
      if (result) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError('Empty response from LLM')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError((err as Error).message)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 10,
          width: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3' }}>LLM Settings</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20 }}
          >
            ×
          </button>
        </div>

        {/* Provider */}
        <section style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Provider</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: `1px solid ${provider === p.id ? '#BA7517' : '#30363d'}`,
                  background: provider === p.id ? '#BA751720' : '#21262d',
                  color: provider === p.id ? '#BA7517' : '#8b949e',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: provider === p.id ? 600 : 400,
                  transition: 'all 150ms',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* API Key */}
        <section style={{ marginBottom: 16 }}>
          <label style={labelStyle}>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={inputStyle}
          />
        </section>

        {/* Azure extras */}
        {provider === 'azure' && (
          <>
            <section style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://myinstance.openai.azure.com"
                style={inputStyle}
              />
            </section>
            <section style={{ marginBottom: 16 }}>
              <label style={labelStyle}>API Version</label>
              <input
                type="text"
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
                placeholder="2024-02-01"
                style={inputStyle}
              />
            </section>
          </>
        )}

        {/* Model */}
        <section style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Model</label>
          {MODEL_OPTIONS[provider].length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {MODEL_OPTIONS[provider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODELS[provider]}
              style={inputStyle}
            />
          )}
        </section>

        {/* Test + Save */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handleTest} disabled={!apiKey || testStatus === 'testing'} style={secondaryBtnStyle}>
            {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={handleSave} disabled={!apiKey} style={primaryBtnStyle}>
            Save
          </button>
          {testStatus === 'ok' && (
            <span style={{ color: '#3B6D11', fontSize: 13 }}>✓ Connected</span>
          )}
          {testStatus === 'error' && (
            <span style={{ color: '#993C1D', fontSize: 12 }}>{testError || 'Connection failed'}</span>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#8b949e',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#e6edf3',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#BA7517',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#8b949e',
  cursor: 'pointer',
  fontSize: 13,
}
