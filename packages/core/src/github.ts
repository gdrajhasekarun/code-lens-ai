const GITHUB_API = 'https://api.github.com'

function headers(token?: string): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === retries - 1
      if (isLast) throw err
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
    }
  }
  throw new Error('Unreachable')
}

export async function fetchTree(
  owner: string,
  repo: string,
  token?: string
): Promise<string[]> {
  return withRetry(async () => {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      { headers: headers(token) }
    )

    if (res.status === 404) {
      throw new Error('Repository not found — check URL or make it public')
    }
    if (res.status === 403) {
      throw new Error('Rate limited or private repo — add a GitHub token')
    }
    if (res.status === 429) {
      throw new Error('Rate limited — try again later')
    }
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}`)
    }

    const data = (await res.json()) as {
      tree: { path: string; type: string }[]
    }
    return data.tree
      .filter(item => item.type === 'blob')
      .map(item => item.path)
  })
}

export async function fetchFile(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string> {
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { headers: headers(token) }
    )
    if (!res.ok) return ''
    const data = (await res.json()) as { content?: string; encoding?: string }
    if (data.encoding !== 'base64' || !data.content) return ''
    const base64 = data.content.replace(/\n/g, '')
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

export function selectKeyFiles(paths: string[]): string[] {
  const EXCLUDE = /\/(target|node_modules|\.git)\//
  const EXCLUDE_EXT = /\.(class|jar|war|ear|png|jpg|jpeg|gif|ico|svg|zip|gz|tar)$/i

  const filtered = paths.filter(
    p => !EXCLUDE.test(`/${p}/`) && !EXCLUDE_EXT.test(p)
  )

  const priority1: string[] = []
  const priority2: string[] = []
  const priority3: string[] = []
  const rest: string[] = []

  for (const p of filtered) {
    const name = p.split('/').pop() ?? ''
    if (
      name === 'pom.xml' ||
      name === 'build.gradle' ||
      name === 'testng.xml' ||
      name === 'suite.xml'
    ) {
      priority1.push(p)
    } else if (
      name.endsWith('.properties') ||
      /^log4j.*\.xml$/i.test(name) ||
      /^extent.*\.xml$/i.test(name)
    ) {
      priority2.push(p)
    } else if (name.endsWith('.java')) {
      priority3.push(p)
    } else {
      rest.push(p)
    }
  }

  const selected = [
    ...priority1,
    ...priority2,
    ...priority3.slice(0, 25),
    ...rest.slice(0, 5),
  ]

  return selected.slice(0, 35)
}
