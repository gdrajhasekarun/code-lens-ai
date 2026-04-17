import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAnalysisStore } from '../../store/analysisStore'

export default function OverviewTab() {
  const { tabs } = useAnalysisStore()
  const { status, data } = tabs.overview

  if (status === 'loading' && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: '#8b949e' }}>
        <span className="spinner" />
        <span>Generating overview…</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
      <div className={`prose ${status === 'loading' ? 'typing-cursor' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data}</ReactMarkdown>
      </div>
    </div>
  )
}
