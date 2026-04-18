import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import type { ArchGraph, ArchNode } from '@codelens-ai/core'

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

const ROLE_ORDER = [
  'Runner',
  'Excel Reader',
  'Keyword Engine',
  'Page Object',
  'Utilities',
  'Config',
  'Test Data',
  'Reports',
  'Unknown',
]

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? '#888780'
}

// Typed React Flow node
type ArchFlowNode = Node<ArchNode, 'custom'>

function CustomNode({ data }: NodeProps<ArchFlowNode>) {
  const color = getRoleColor(data.role)
  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid #30363d`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        minWidth: 160,
        maxWidth: 220,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${color}40`
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div
        style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 12,
          color: '#e6edf3',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 180,
        }}
      >
        {data.label}
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color, fontWeight: 500 }}>
        {data.role}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  )
}

const nodeTypes = { custom: CustomNode }

function layoutGraph(
  archNodes: ArchNode[],
  archEdges: { from: string; to: string; label?: string }[]
): { nodes: ArchFlowNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  const sorted = [...archNodes].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  )

  for (const node of sorted) {
    g.setNode(node.id, { width: 200, height: 70 })
  }

  for (const edge of archEdges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to)
    }
  }

  dagre.layout(g)

  const nodes: ArchFlowNode[] = sorted.map((node) => {
    const pos = g.node(node.id)
    return {
      id: node.id,
      type: 'custom' as const,
      position: { x: pos.x - 100, y: pos.y - 35 },
      data: node,
    }
  })

  const edges: Edge[] = archEdges
    .filter((e) => g.hasNode(e.from) && g.hasNode(e.to))
    .map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: true,
      style: {
        stroke: getRoleColor(archNodes.find((n) => n.id === e.from)?.role ?? ''),
        strokeDasharray: '5 3',
      },
      labelStyle: { fill: '#8b949e', fontSize: 10 },
      labelBgStyle: { fill: '#161b22', fillOpacity: 0.8 },
    }))

  return { nodes, edges }
}

interface NodeGraphProps {
  graph: ArchGraph
  onNodeClick?: (node: ArchNode) => void
  height?: number
}

export default function NodeGraph({ graph, onNodeClick, height = 520 }: NodeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    const { nodes: n, edges: e } = layoutGraph(graph.nodes, graph.edges)
    setNodes(n)
    setEdges(e)
  }, [graph, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: ArchFlowNode) => {
      onNodeClick?.(node.data)
    },
    [onNodeClick]
  )

  return (
    <div style={{ height, background: '#0d1117', borderRadius: 8, border: '1px solid #30363d' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#21262d" gap={20} variant={BackgroundVariant.Dots} />
        <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
        <MiniMap
          nodeColor={(n) => getRoleColor((n.data as ArchNode).role)}
          style={{ background: '#161b22', border: '1px solid #30363d' }}
          maskColor="rgba(13,17,23,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
