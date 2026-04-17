import * as vscode from 'vscode'
import { AnalysisPanel } from './AnalysisPanel'
import { SecretManager } from './SecretManager'

export function activate(context: vscode.ExtensionContext) {
  const secretManager = new SecretManager(context)

  context.subscriptions.push(
    vscode.commands.registerCommand('codelens-ai.analyzeWorkspace', () => {
      AnalysisPanel.createOrShow(context, secretManager)
    }),
    vscode.commands.registerCommand('codelens-ai.analyzeFolder', (uri: vscode.Uri) => {
      AnalysisPanel.createOrShow(context, secretManager, uri.fsPath)
    }),
    vscode.commands.registerCommand('codelens-ai.openSettings', () => {
      AnalysisPanel.createOrShow(context, secretManager, undefined, true)
    })
  )
}

export function deactivate() {
  // cleanup handled by disposables
}
