import * as vscode from "vscode";
import { DocsPanel, VIEW_TYPE } from "./panel";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("docsPanel.open", () => DocsPanel.open(context))
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown) {
        panel.webview.options = { enableScripts: true };
        DocsPanel.restore(panel, context, state);
      }
    })
  );
}

export function deactivate(): void {}
