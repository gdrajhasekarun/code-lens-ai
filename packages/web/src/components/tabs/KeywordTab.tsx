import { useState, useMemo } from 'react'
import { useAnalysisStore } from '../../store/analysisStore'
import type { KeywordMapping } from '@codelens-ai/core'

type SortKey = keyof KeywordMapping

function exportCSV(data: KeywordMapping[]) {
  const header = 'Keyword,Method Name,Class,Description,Line Number'
  const rows = data.map(
    (k) =>
      `"${k.keyword}","${k.methodName}","${k.className}","${k.description}","${k.lineNumber ?? ''}"`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'keywords.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function KeywordTab() {
  const { tabs } = useAnalysisStore()
  const { status, data } = tabs.keywords

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('keyword')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data
      .filter(
        (k) =>
          k.keyword.toLowerCase().includes(q) ||
          k.methodName.toLowerCase().includes(q) ||
          k.className.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const va = String(a[sortKey] ?? '')
        const vb = String(b[sortKey] ?? '')
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
      })
  }, [data, search, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: '#8b949e' }}>
        <span className="spinner" />
        <span>Extracting keywords…</span>
      </div>
    )
  }

  if (status === 'done' && data.length === 0) {
    return (
      <div style={{ padding: 24, color: '#484f58', fontSize: 13 }}>
        No keyword mappings detected — framework may use a custom dispatch pattern.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search keywords, methods, classes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '7px 12px',
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 6,
            color: '#e6edf3',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={() => exportCSV(filtered)}
          style={{
            padding: '7px 14px',
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 6,
            color: '#8b949e',
            cursor: 'pointer',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d', position: 'sticky', top: 0, background: '#161b22' }}>
              {(['keyword', 'methodName', 'className', 'description'] as SortKey[]).map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    color: sortKey === col ? '#BA7517' : '#8b949e',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col === 'methodName' ? 'Method' : col === 'className' ? 'Class' : col.charAt(0).toUpperCase() + col.slice(1)}
                  {sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((k, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #21262d',
                  background: i % 2 === 0 ? 'transparent' : '#0d1117',
                }}
              >
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#BA7517', fontWeight: 600 }}>
                  {k.keyword}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#3B8BD4' }}>
                  {k.methodName}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#534AB7' }}>
                  {k.className}
                </td>
                <td style={{ padding: '8px 12px', color: '#8b949e', lineHeight: 1.5 }}>
                  {k.description}
                  {k.lineNumber != null && (
                    <span style={{ color: '#484f58', marginLeft: 6 }}>:{k.lineNumber}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && search && (
          <div style={{ padding: 16, color: '#484f58', textAlign: 'center' }}>
            No results for "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
