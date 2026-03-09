import * as vscode from 'vscode';

import { COMMAND_SHOW_PANEL, VIEW_ID } from './constants.js';
import { PixelMavViewProvider } from './webviewProvider.js';

let provider: PixelMavViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  provider = new PixelMavViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SHOW_PANEL, () => {
      provider?.focus();
    }),
  );
}

export function deactivate(): void {
  provider?.dispose();
  provider = undefined;
}
