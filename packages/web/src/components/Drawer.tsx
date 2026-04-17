import { useEffect, useRef } from 'react'
import type { ArchNode } from '@codelens-ai/core'

const ROLE_COLORS: Record<string, string> = {
  Runner: '#3B8BD4',
  'Keyword Engine': '#BA7517',
  'Excel Reader': '#3B6D11',
  'Page Object': '#534AB7',
  Config: '#5F5E5A',
  Utilities: '#993556',
  'Test Data': '#0F6E56',
  Reports: '#993C1D',
  Unknown: '#888780',
}

interface DrawerProps {
  node: ArchNode | null
  onClose: () => void
}

export default function Drawer({ node, onClose }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (node) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [node, onClose])

  const color = node ? (ROLE_COLORS[node.role] ?? '#888780') : '#888780'

  return (
    <>
      {node && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 40,
          }}
        />
      )}
      <div
        ref={ref}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 320,
          height: '100vh',
          background: '#161b22',
          borderLeft: '1px solid #30363d',
          zIndex: 50,
          transform: node ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {node && (
          <>
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    background: `${color}20`,
                    color,
                    border: `1px solid ${color}40`,
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  {node.role}
                </span>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#e6edf3',
                  }}
                >
                  {node.label}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 4,
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#484f58', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Path
                </div>
                <code
                  style={{
                    display: 'block',
                    background: '#21262d',
                    color: '#BA7517',
                    padding: '6px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {node.path}
                </code>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#484f58', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Description
                </div>
                <p style={{ color: '#8b949e', lineHeight: 1.7, fontSize: 13 }}>
                  {node.description}
                </p>
              </div>

              {node.files.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#484f58', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Files ({node.files.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                    {node.files.map((f, i) => (
                      <code
                        key={i}
                        style={{
                          display: 'block',
                          background: '#21262d',
                          color: '#8b949e',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {f}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
