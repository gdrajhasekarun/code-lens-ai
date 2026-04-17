import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAnalysisStore } from '../../store/analysisStore'
import { apiStreamLLM } from '../../api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "What happens when a keyword isn't found?",
  'Which class initializes the browser?',
  'How are test results reported?',
  'What Excel columns does the framework expect?',
]

const SYSTEM = `You are an expert analyzing a keyword-driven Java test automation framework.
In this framework, test execution is driven by method names stored in Excel sheets.
Keywords defined in Excel cells map directly to Java methods via reflection, switch/case
dispatch, Map<String,Method> lookup, or annotation scanning (@Keyword).
Be precise and reference actual class and method names from the code provided.`

export default function ChatTab() {
  const { settings, context, filePaths } = useAnalysisStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || !settings || streaming) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setStreaming(true)

    const historyContext = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const ctxTruncated = context.slice(0, 8000)
    const pathsPreview = filePaths.slice(0, 50).join('\n')

    const prompt = `${historyContext ? `Prior conversation:\n${historyContext}\n\n` : ''}Repository file structure (sample):\n${pathsPreview}\n\nCode context:\n${ctxTruncated}\n\nUser question: ${text}`

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages((m) => [...m, assistantMsg])

    try {
      const stream = apiStreamLLM({ ...settings, system: SYSTEM, prompt })
      for await (const chunk of stream) {
        setMessages((m) => {
          const updated = [...m]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch (err) {
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `Error: ${(err as Error).message}`,
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div>
            <p style={{ color: '#484f58', fontSize: 12, marginBottom: 12 }}>
              Ask anything about this framework:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: '6px 12px',
                    background: '#21262d',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    color: '#8b949e',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.borderColor = '#BA7517')}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.borderColor = '#30363d')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: msg.role === 'user' ? '#BA751730' : '#3B8BD430',
                border: `1px solid ${msg.role === 'user' ? '#BA7517' : '#3B8BD4'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: msg.role === 'user' ? '#BA7517' : '#3B8BD4',
                flexShrink: 0,
              }}
            >
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#21262d' : '#161b22',
                border: `1px solid ${msg.role === 'user' ? '#30363d' : '#21262d'}`,
              }}
            >
              {msg.role === 'assistant' ? (
                <div
                  className={`prose ${streaming && i === messages.length - 1 ? 'typing-cursor' : ''}`}
                  style={{ fontSize: 13 }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ color: '#e6edf3', fontSize: 13, lineHeight: 1.6 }}>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #21262d' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this framework… (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1,
              padding: '9px 12px',
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#e6edf3',
              fontSize: 13,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            style={{
              padding: '9px 16px',
              background: '#BA7517',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: input.trim() && !streaming ? 'pointer' : 'default',
              opacity: input.trim() && !streaming ? 1 : 0.5,
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {streaming ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
