import { useState, useEffect } from 'react'
import { useAnalysisStore } from '../store/analysisStore'
import { apiCallLLM } from '../api'
import type { LLMConfig, LLMProvider } from '@codelens-ai/core'

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'azure', label: 'Azure OpenAI' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'enterprise', label: 'Enterprise' },
]

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  azure: 'gpt-4o',
  openrouter: 'meta-llama/llama-3.1-8b-instruct',
  gemini: 'gemini-1.5-pro',
  enterprise: '',
}

const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  azure: [],
  openrouter: [],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  enterprise: [],
}

interface ExtraHeader { key: string; value: string }

interface EnterpriseConfig {
  baseUrl: string
  headerName: string
  promptField: string
  contextField: string
  responseField: string
  extraHeaders: ExtraHeader[]
}

function loadKey(provider: LLMProvider): string {
  return localStorage.getItem(`codelens-apikey-${provider}`) ?? ''
}

function saveKey(provider: LLMProvider, key: string) {
  localStorage.setItem(`codelens-apikey-${provider}`, key)
}

function loadEnterprise(): EnterpriseConfig {
  try {
    const raw = localStorage.getItem('codelens-enterprise-config')
    if (raw) return JSON.parse(raw) as EnterpriseConfig
  } catch {}
  return { baseUrl: '', headerName: 'x-api-key', promptField: 'prompt', contextField: 'context', responseField: 'response', extraHeaders: [] }
}

function saveEnterprise(cfg: EnterpriseConfig) {
  localStorage.setItem('codelens-enterprise-config', JSON.stringify(cfg))
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
  const [enterprise, setEnterprise] = useState<EnterpriseConfig>(loadEnterprise)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    setApiKey(loadKey(provider))
    setModel(DEFAULT_MODELS[provider])
    setBaseUrl('')
    setTestStatus('idle')
  }, [provider])

  function setEnterpriseField(field: keyof Omit<EnterpriseConfig, 'extraHeaders'>, value: string) {
    setEnterprise(prev => ({ ...prev, [field]: value }))
  }

  function setExtraHeader(index: number, field: 'key' | 'value', val: string) {
    setEnterprise(prev => {
      const updated = [...prev.extraHeaders]
      updated[index] = { ...updated[index], [field]: val }
      return { ...prev, extraHeaders: updated }
    })
  }

  function addExtraHeader() {
    setEnterprise(prev => ({ ...prev, extraHeaders: [...prev.extraHeaders, { key: '', value: '' }] }))
  }

  function removeExtraHeader(index: number) {
    setEnterprise(prev => ({ ...prev, extraHeaders: prev.extraHeaders.filter((_, i) => i !== index) }))
  }

  function handleSave() {
    saveKey(provider, apiKey)
    if (provider === 'enterprise') saveEnterprise(enterprise)

    const cfg: LLMConfig = {
      provider,
      apiKey,
      model,
      ...(baseUrl || (provider === 'enterprise' && enterprise.baseUrl)
        ? { baseUrl: provider === 'enterprise' ? enterprise.baseUrl : baseUrl }
        : {}),
      ...(provider === 'azure' && apiVersion ? { apiVersion } : {}),
      ...(provider === 'enterprise'
        ? {
            headerName: enterprise.headerName || 'x-api-key',
            promptField: enterprise.promptField || 'prompt',
            contextField: enterprise.contextField || 'context',
            responseField: enterprise.responseField || 'response',
            extraHeaders: Object.fromEntries(
              enterprise.extraHeaders.filter(h => h.key).map(h => [h.key, h.value])
            ),
          }
        : {}),
    }
    setSettings(cfg)
    onClose()
  }

  async function handleTest() {
    setTestStatus('testing')
    setTestError('')
    try {
      const cfg: LLMConfig = {
        provider,
        apiKey,
        model,
        baseUrl: provider === 'enterprise' ? enterprise.baseUrl : baseUrl || undefined,
        apiVersion: provider === 'azure' ? apiVersion : undefined,
        ...(provider === 'enterprise'
          ? {
              headerName: enterprise.headerName || 'x-api-key',
              promptField: enterprise.promptField || 'prompt',
              contextField: enterprise.contextField || 'context',
              responseField: enterprise.responseField || 'response',
              extraHeaders: Object.fromEntries(
                enterprise.extraHeaders.filter(h => h.key).map(h => [h.key, h.value])
              ),
            }
          : {}),
      }

      const testPrompt =
        provider === 'enterprise'
          ? 'Reply with the word CONNECTED and nothing else.'
          : 'Say "hi" in exactly one word.'

      const result = await apiCallLLM({
        ...cfg,
        system: 'You are a helpful assistant.',
        prompt: testPrompt,
      })

      if (provider === 'enterprise' && !result.includes('CONNECTED')) {
        setTestStatus('error')
        setTestError(`Unexpected response: ${result.slice(0, 100)}`)
      } else if (result) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError('Empty response')
      }
    } catch (err) {
      setTestStatus('error')
      setTestError((err as Error).message)
    }
  }

  const ep = enterprise
  const enterprisePreview = provider === 'enterprise' ? [
    `POST ${ep.baseUrl || '{baseUrl}'}/llm/invoke`,
    `{ "${ep.promptField || 'prompt'}": "...", "${ep.contextField || 'context'}": "" }`,
    `${ep.headerName || 'x-api-key'}: your-key`,
    ...ep.extraHeaders.filter(h => h.key).map(h => `${h.key}: ${h.value || '...'}`),
  ].join('\n') : ''

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
          maxHeight: '88vh',
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

        {/* Enterprise extras */}
        {provider === 'enterprise' && (
          <>
            <section style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Base URL *</label>
              <input
                type="text"
                value={ep.baseUrl}
                onChange={(e) => setEnterpriseField('baseUrl', e.target.value)}
                placeholder="https://internal-api.company.com"
                style={inputStyle}
              />
            </section>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <section>
                <label style={labelStyle}>API Key Header</label>
                <input
                  type="text"
                  value={ep.headerName}
                  onChange={(e) => setEnterpriseField('headerName', e.target.value)}
                  placeholder="x-api-key"
                  style={inputStyle}
                />
              </section>
              <section>
                <label style={labelStyle}>Model (optional)</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="optional"
                  style={inputStyle}
                />
              </section>
              <section>
                <label style={labelStyle}>Prompt Body Field</label>
                <input
                  type="text"
                  value={ep.promptField}
                  onChange={(e) => setEnterpriseField('promptField', e.target.value)}
                  placeholder="prompt"
                  style={inputStyle}
                />
              </section>
              <section>
                <label style={labelStyle}>Context Body Field</label>
                <input
                  type="text"
                  value={ep.contextField}
                  onChange={(e) => setEnterpriseField('contextField', e.target.value)}
                  placeholder="context"
                  style={inputStyle}
                />
              </section>
            </div>
            <section style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Response JSON Field</label>
              <input
                type="text"
                value={ep.responseField}
                onChange={(e) => setEnterpriseField('responseField', e.target.value)}
                placeholder="response  (or dot-path: data.result.text)"
                style={inputStyle}
              />
            </section>
            {/* Extra Headers */}
            <section style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Extra Headers</label>
                <button onClick={addExtraHeader} style={{ ...secondaryBtnStyle, padding: '3px 10px', fontSize: 11 }}>
                  + Add
                </button>
              </div>
              {ep.extraHeaders.length === 0 && (
                <p style={{ color: '#484f58', fontSize: 11 }}>e.g. app-id, client-id, content-type</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ep.extraHeaders.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={h.key}
                      onChange={(e) => setExtraHeader(i, 'key', e.target.value)}
                      placeholder="header-name"
                      style={{ ...inputStyle, flex: '0 0 40%' }}
                    />
                    <input
                      type="text"
                      value={h.value}
                      onChange={(e) => setExtraHeader(i, 'value', e.target.value)}
                      placeholder="value"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => removeExtraHeader(i)}
                      style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Live preview */}
            <div style={{
              background: '#0d1117',
              border: '1px solid #21262d',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 16,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#8b949e',
              whiteSpace: 'pre',
              lineHeight: 1.7,
            }}>
              {enterprisePreview}
            </div>
          </>
        )}

        {/* Model — skip for enterprise (handled above in grid) */}
        {provider !== 'enterprise' && (
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
                placeholder={DEFAULT_MODELS[provider] || 'model name'}
                style={inputStyle}
              />
            )}
          </section>
        )}

        {/* Test + Save */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleTest}
            disabled={!apiKey || testStatus === 'testing'}
            style={secondaryBtnStyle}
          >
            {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={handleSave} disabled={!apiKey} style={primaryBtnStyle}>
            Save
          </button>
          {testStatus === 'ok' && (
            <span style={{ color: '#3fbf7f', fontSize: 13 }}>✓ Connected</span>
          )}
          {testStatus === 'error' && (
            <span style={{ color: '#f87171', fontSize: 12, flex: '1 1 100%', marginTop: 6 }}>
              {testError || 'Connection failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#8b949e',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#e6edf3',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
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
