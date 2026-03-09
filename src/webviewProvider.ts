import * as fs from 'fs';
import * as vscode from 'vscode';

import { GLOBAL_KEY_SOUND_ENABLED, VIEW_ID, WORKSPACE_KEY_CAT_SEATS } from './constants.js';

export class PixelMavViewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private get webview(): vscode.Webview | undefined {
    return this.webviewView?.webview;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: { type: string } & Record<string, unknown>) => {
      switch (message.type) {
        case 'webviewReady':
          this.onWebviewReady();
          break;

        case 'saveCatSeats':
          this.context.workspaceState.update(WORKSPACE_KEY_CAT_SEATS, message.seats);
          break;

        case 'setSoundEnabled':
          this.context.globalState.update(GLOBAL_KEY_SOUND_ENABLED, message.enabled);
          break;

        case 'spawnClaude':
          // Phase 10: launch terminal + watch JSONL
          vscode.window.showInformationMessage('Pixel Mav: spawning Claude — coming in Phase 10!');
          break;
      }
    });
  }

  private onWebviewReady(): void {
    const soundEnabled = this.context.globalState.get<boolean>(GLOBAL_KEY_SOUND_ENABLED, true);
    this.webview?.postMessage({ type: 'settingsLoaded', soundEnabled });
    // Phase 10: restore agents, send existingCats
  }

  focus(): void {
    vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  dispose(): void {
    // Phase 10: tear down file watchers, timers
  }

  private getHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

    let html = fs.readFileSync(indexPath, 'utf-8');

    html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match, attr, filePath) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, filePath as string));
      return `${attr}="${uri}"`;
    });

    return html;
  }
}
