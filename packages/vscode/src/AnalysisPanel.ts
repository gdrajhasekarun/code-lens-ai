import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { streamLLM, callLLM } from '@codelens-ai/core'
import type { LLMConfig, LLMProvider } from '@codelens-ai/core'
import type { SecretManager } from './SecretManager'
import { WorkspaceReader } from './WorkspaceReader'

type InboundMessage =
  | { type: 'REQUEST_TREE' }
  | { type: 'REQUEST_FILES'; paths: string[] }
  | { type: 'LLM_STREAM'; streamId: string; provider: string; apiKey: string; model: string; baseUrl?: string; apiVersion?: string; promptField?: string; contextField?: string; responseField?: string; headerName?: string; system: string; prompt: string }
  | { type: 'LLM_CALL'; callId: string; provider: string; apiKey: string; model: string; baseUrl?: string; apiVersion?: string; promptField?: string; contextField?: string; responseField?: string; headerName?: string; system: string; prompt: string }
  | { type: 'SAVE_KEY'; provider: string; apiKey: string }
  | { type: 'GET_SETTINGS' }

export class AnalysisPanel {
  private static panels = new Map<string, AnalysisPanel>()
  private readonly panel: vscode.WebviewPanel
  private readonly reader: WorkspaceReader
  private rootPath: string | undefined
  private disposables: vscode.Disposable[] = []

  private constructor(
    context: vscode.ExtensionContext,
    private secrets: SecretManager,
    rootPath?: string,
    openSettings = false
  ) {
    this.rootPath = rootPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    this.reader = new WorkspaceReader()

    this.panel = vscode.window.createWebviewPanel(
      'codelens-ai',
      'CodeLens AI',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'dist')),
        ],
        retainContextWhenHidden: true,
      }
    )

    this.panel.webview.html = this.buildHtml(context)
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this.panel.webview.onDidReceiveMessage(
      (msg: InboundMessage) => this.handleMessage(msg, context),
      null,
      this.disposables
    )

    // Send init after a short delay for the webview to load
    setTimeout(() => {
      const wsName = vscode.workspace.name ?? path.basename(this.rootPath ?? 'workspace')
      this.panel.webview.postMessage({
        type: 'INIT',
        workspaceName: wsName,
        rootPath: this.rootPath ?? '',
      })
      if (openSettings) {
        this.panel.webview.postMessage({ type: 'OPEN_SETTINGS' })
      }
    }, 500)
  }

  static createOrShow(
    context: vscode.ExtensionContext,
    secrets: SecretManager,
    rootPath?: string,
    openSettings = false
  ) {
    const key = rootPath ?? 'workspace'
    if (AnalysisPanel.panels.has(key)) {
      AnalysisPanel.panels.get(key)!.panel.reveal()
      return
    }
    const p = new AnalysisPanel(context, secrets, rootPath, openSettings)
    AnalysisPanel.panels.set(key, p)
  }

  private async handleMessage(msg: InboundMessage, _context: vscode.ExtensionContext) {
    switch (msg.type) {
      case 'REQUEST_TREE': {
        const paths = await this.reader.getFilePaths(this.rootPath)
        this.panel.webview.postMessage({ type: 'FILE_TREE', paths })
        break
      }
      case 'REQUEST_FILES': {
        const files = await this.reader.getKeyFiles(msg.paths, this.rootPath)
        this.panel.webview.postMessage({ type: 'FILE_CONTENT', files })
        break
      }
      case 'LLM_STREAM': {
        const config: LLMConfig = {
          provider: msg.provider as LLMProvider,
          apiKey: msg.apiKey,
          model: msg.model,
          baseUrl: msg.baseUrl,
          apiVersion: msg.apiVersion,
          promptField: msg.promptField,
          contextField: msg.contextField,
          responseField: msg.responseField,
          headerName: msg.headerName,
        }
        try {
          for await (const token of streamLLM(config, msg.system, msg.prompt)) {
            this.panel.webview.postMessage({ type: 'LLM_TOKEN', token, streamId: msg.streamId })
          }
          this.panel.webview.postMessage({ type: 'LLM_DONE', streamId: msg.streamId })
        } catch (err) {
          this.panel.webview.postMessage({
            type: 'LLM_ERROR',
            error: (err as Error).message,
            streamId: msg.streamId,
          })
        }
        break
      }
      case 'LLM_CALL': {
        const config: LLMConfig = {
          provider: msg.provider as LLMProvider,
          apiKey: msg.apiKey,
          model: msg.model,
          baseUrl: msg.baseUrl,
          apiVersion: msg.apiVersion,
          promptField: msg.promptField,
          contextField: msg.contextField,
          responseField: msg.responseField,
          headerName: msg.headerName,
        }
        try {
          const content = await callLLM(config, msg.system, msg.prompt)
          this.panel.webview.postMessage({ type: 'LLM_DONE', streamId: msg.callId, token: content })
        } catch (err) {
          this.panel.webview.postMessage({
            type: 'LLM_ERROR',
            error: (err as Error).message,
            streamId: msg.callId,
          })
        }
        break
      }
      case 'SAVE_KEY': {
        await this.secrets.setKey(msg.provider as LLMProvider, msg.apiKey)
        break
      }
      case 'GET_SETTINGS': {
        const storedKeys = await this.secrets.getSettings()
        this.panel.webview.postMessage({ type: 'SETTINGS', storedKeys })
        break
      }
    }
  }

  private buildHtml(context: vscode.ExtensionContext): string {
    const distPath = path.join(context.extensionPath, 'dist')

    if (!fs.existsSync(distPath)) {
      return `<!DOCTYPE html><html><body style="background:#0d1117;color:#e6edf3;font-family:sans-serif;padding:40px">
        <h2>CodeLens AI</h2>
        <p>Web app not built. Run <code>pnpm build:web</code> and copy the output to <code>packages/vscode/dist</code>.</p>
      </body></html>`
    }

    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8')
    const webview = this.panel.webview

    // Rewrite asset URLs to webview URIs
    const rewritten = indexHtml
      .replace(/(src|href)="\/([^"]+)"/g, (_, attr, src) => {
        const uri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, src)))
        return `${attr}="${uri}"`
      })
      .replace(
        '</head>',
        `<script>window.VITE_TARGET = 'vscode'; const vscode = acquireVsCodeApi(); window.vscodeApi = vscode;</script>\n</head>`
      )

    return rewritten
  }

  private dispose() {
    for (const [k, v] of AnalysisPanel.panels) {
      if (v === this) AnalysisPanel.panels.delete(k)
    }
    this.panel.dispose()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }
}
