import * as vscode from 'vscode'
import * as path from 'path'
import { selectKeyFiles } from '@codelens-ai/core'

const EXCLUDE = '{**/target/**,**/.git/**,**/node_modules/**,**/*.class,**/*.jar,**/*.war,**/*.ear}'

export class WorkspaceReader {
  async getFilePaths(rootPath?: string): Promise<string[]> {
    const pattern = rootPath
      ? new vscode.RelativePattern(rootPath, '**/*')
      : '**/*'

    const uris = await vscode.workspace.findFiles(pattern as string, EXCLUDE, 500)
    const wsRoot = rootPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''

    return uris.map((uri) => {
      const rel = path.relative(wsRoot, uri.fsPath)
      return rel.replace(/\\/g, '/')
    })
  }

  async getFileContent(absolutePath: string): Promise<string> {
    try {
      const uri = vscode.Uri.file(absolutePath)
      const bytes = await vscode.workspace.fs.readFile(uri)
      return Buffer.from(bytes).toString('utf-8')
    } catch {
      return ''
    }
  }

  async getKeyFiles(
    paths: string[],
    rootPath?: string
  ): Promise<{ path: string; content: string }[]> {
    const wsRoot = rootPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
    const keyPaths = selectKeyFiles(paths)

    const results = await Promise.all(
      keyPaths.map(async (p) => {
        const abs = path.join(wsRoot, p)
        const content = await this.getFileContent(abs)
        return { path: p, content }
      })
    )

    return results.filter((r) => r.content.length > 0)
  }
}
