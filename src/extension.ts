import * as vscode from 'vscode';

import { COMMAND_DEBUG_SIM, COMMAND_SHOW_PANEL, VIEW_ID } from './constants.js';
import { PixelMavViewProvider } from './webviewProvider.js';

let provider: PixelMavViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  provider = new PixelMavViewProvider(context, workspacePath);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SHOW_PANEL, () => {
      provider?.focus();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_DEBUG_SIM, () => {
      provider?.debugSimulate();
    }),
  );
}

export function deactivate(): void {
  provider?.dispose();
  provider = undefined;
}
