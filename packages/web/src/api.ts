declare global {
  interface Window {
    VITE_TARGET?: string
    vscodeApi?: {
      postMessage: (msg: unknown) => void
    }
  }
}

const IS_VSCODE =
  typeof window !== 'undefined' &&
  (window.VITE_TARGET === 'vscode' || typeof window.vscodeApi !== 'undefined')

// ─── Pending VSCode callbacks ─────────────────────────────────────────────────
const pendingCallbacks = new Map<
  string,
  { resolve: (v: string) => void; reject: (e: Error) => void; chunks: string[] }
>()
const pendingTreeCallbacks: Array<(paths: string[]) => void> = []
const pendingFileCallbacks: Array<(files: { path: string; content: string }[]) => void> = []

if (IS_VSCODE) {
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as Record<string, unknown>
    if (!msg || typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'FILE_TREE': {
        const cb = pendingTreeCallbacks.shift()
        if (cb) cb(msg.paths as string[])
        break
      }
      case 'FILE_CONTENT': {
        const cb = pendingFileCallbacks.shift()
        if (cb) cb(msg.files as { path: string; content: string }[])
        break
      }
      case 'LLM_TOKEN': {
        const entry = pendingCallbacks.get(msg.streamId as string)
        if (entry) entry.chunks.push(msg.token as string)
        break
      }
      case 'LLM_DONE': {
        const entry = pendingCallbacks.get(msg.streamId as string)
        if (entry) {
          entry.resolve(entry.chunks.join(''))
          pendingCallbacks.delete(msg.streamId as string)
        }
        break
      }
      case 'LLM_ERROR': {
        const entry = pendingCallbacks.get(msg.streamId as string)
        if (entry) {
          entry.reject(new Error(msg.error as string))
          pendingCallbacks.delete(msg.streamId as string)
        }
        break
      }
    }
  })
}

// ─── GitHub ───────────────────────────────────────────────────────────────────
export async function apiGetTree(
  owner: string,
  repo: string,
  token?: string
): Promise<string[]> {
  if (IS_VSCODE) {
    return new Promise(resolve => {
      pendingTreeCallbacks.push(resolve)
      window.vscodeApi?.postMessage({ type: 'REQUEST_TREE' })
    })
  }

  const res = await fetch('/api/github/tree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail: string }).detail || res.statusText)
  }
  const data = (await res.json()) as { paths: string[] }
  return data.paths
}

export async function apiGetContent(
  owner: string,
  repo: string,
  paths: string[],
  token?: string
): Promise<{ path: string; content: string }[]> {
  if (IS_VSCODE) {
    return new Promise(resolve => {
      pendingFileCallbacks.push(resolve)
      window.vscodeApi?.postMessage({ type: 'REQUEST_FILES', paths })
    })
  }

  const res = await fetch('/api/github/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, paths, token }),
  })
  if (!res.ok) throw new Error(res.statusText)
  const data = (await res.json()) as { files: { path: string; content: string }[] }
  return data.files
}

// ─── LLM streaming ───────────────────────────────────────────────────────────
export interface LLMStreamParams {
  provider: string
  apiKey: string
  model: string
  baseUrl?: string
  apiVersion?: string
  promptField?: string
  contextField?: string
  responseField?: string
  headerName?: string
  system: string
  prompt: string
}

export async function* apiStreamLLM(params: LLMStreamParams): AsyncGenerator<string> {
  if (IS_VSCODE) {
    const streamId = crypto.randomUUID()
    const chunks: string[] = []
    let done = false
    let error: Error | null = null

    pendingCallbacks.set(streamId, {
      chunks,
      resolve: () => { done = true },
      reject: (e: Error) => { error = e; done = true },
    })

    window.vscodeApi?.postMessage({ type: 'LLM_STREAM', streamId, ...params })

    while (!done) {
      while (chunks.length > 0) yield chunks.shift()!
      if (!done) await new Promise(r => setTimeout(r, 20))
    }
    while (chunks.length > 0) yield chunks.shift()!
    if (error) throw error
    return
  }

  const res = await fetch('/api/llm/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail: string }).detail || res.statusText)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') return
      yield payload
    }
  }
}

export async function apiCallLLM(params: LLMStreamParams): Promise<string> {
  if (IS_VSCODE) {
    const callId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      pendingCallbacks.set(callId, { chunks: [], resolve, reject })
      window.vscodeApi?.postMessage({ type: 'LLM_CALL', callId, ...params })
    })
  }

  const res = await fetch('/api/llm/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(res.statusText)
  const data = (await res.json()) as { content: string }
  return data.content
}
