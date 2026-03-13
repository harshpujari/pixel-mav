import * as fs from 'fs';
import * as vscode from 'vscode';

import { AgentManager } from './agentManager.js';
import { GLOBAL_KEY_SOUND_ENABLED, VIEW_ID, WORKSPACE_KEY_CAT_SEATS } from './constants.js';

export class PixelMavViewProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;
  private agentManager: AgentManager | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspacePath: string,
  ) {}

  private get webview(): vscode.Webview | undefined {
    return this.webviewView?.webview;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Create the AgentManager with a callback that posts to the webview
    this.agentManager = new AgentManager(
      (msg) => this.webview?.postMessage(msg),
      this.workspacePath,
    );

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

        case 'focusCat': {
          const agent = this.agentManager?.getAgent(message.agentId as string);
          if (agent?.terminalRef) {
            agent.terminalRef.show();
          }
          break;
        }

        case 'closeCat': {
          const agent = this.agentManager?.getAgent(message.agentId as string);
          if (agent?.terminalRef) {
            agent.terminalRef.dispose();
          }
          break;
        }
      }
    });
  }

  private onWebviewReady(): void {
    const soundEnabled = this.context.globalState.get<boolean>(GLOBAL_KEY_SOUND_ENABLED, true);
    this.webview?.postMessage({ type: 'settingsLoaded', soundEnabled });

    // Start agent detection and send any existing agents to the webview
    this.agentManager?.start();
    const existingCats = this.agentManager?.getExistingCatsMessage();
    if (existingCats) {
      this.webview?.postMessage(existingCats);
    }
  }

  focus(): void {
    vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  /**
   * Debug: simulate a full agent lifecycle with timed messages.
   * Spawns a cat, cycles through active/idle/permission/despawn.
   */
  debugSimulate(): void {
    const post = (msg: Record<string, unknown>) => this.webview?.postMessage(msg);
    const id = 'debug-1';

    // t=0s: spawn
    post({ type: 'catSpawned', agentId: id, breed: 'tabby', hueShift: 0, seatCol: 7, seatRow: 3, isSubagent: false, parentAgentId: null });

    // t=2s: agent starts typing (Edit tool)
    setTimeout(() => post({ type: 'agentActive', agentId: id, tool: 'Edit', catState: 'type' }), 2000);

    // t=6s: agent switches to reading (Read tool)
    setTimeout(() => post({ type: 'agentActive', agentId: id, tool: 'Read', catState: 'read' }), 6000);

    // t=9s: agent goes idle (turn ends)
    setTimeout(() => post({ type: 'agentIdle', agentId: id }), 9000);

    // t=14s: agent active again (Bash tool)
    setTimeout(() => post({ type: 'agentActive', agentId: id, tool: 'Bash', catState: 'type' }), 14000);

    // t=17s: permission prompt
    setTimeout(() => post({ type: 'agentPermission', agentId: id, tool: 'Bash' }), 17000);

    // t=20s: back to active after permission granted
    setTimeout(() => post({ type: 'agentActive', agentId: id, tool: 'Write', catState: 'type' }), 20000);

    // t=24s: idle again
    setTimeout(() => post({ type: 'agentIdle', agentId: id }), 24000);

    // t=28s: spawn a sub-agent
    setTimeout(() => {
      post({ type: 'catSpawned', agentId: 'debug-sub-1', breed: 'tabby', hueShift: 0, seatCol: 11, seatRow: 3, isSubagent: true, parentAgentId: id });
      post({ type: 'agentActive', agentId: 'debug-sub-1', tool: 'Task', catState: 'type' });
    }, 28000);

    // t=34s: sub-agent finishes
    setTimeout(() => post({ type: 'catDespawned', agentId: 'debug-sub-1' }), 34000);

    // t=37s: main agent despawns
    setTimeout(() => post({ type: 'catDespawned', agentId: id }), 37000);

    vscode.window.showInformationMessage('Pixel Mav: debug simulation started (37s cycle)');
  }

  dispose(): void {
    this.agentManager?.dispose();
    this.agentManager = undefined;
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
