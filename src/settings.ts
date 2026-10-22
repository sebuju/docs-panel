import * as vscode from "vscode";

const SETTINGS_FILE = "docs-panel-settings.json";

// The panel's settings, its buckets and where it was left, beside the panel's other files,
// so a closed tab, a new window or a new version of the extension starts where it stopped.
export function settingsUri(workspace: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspace, ".vscode", SETTINGS_FILE);
}

// Undefined when there is no file, or none that can be read: the caller keeps what it has.
export async function loadSettings(workspace: vscode.Uri): Promise<unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(settingsUri(workspace))));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function saveSettings(workspace: vscode.Uri, settings: object): Promise<void> {
  const store = settingsUri(workspace);
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(store, ".."));
  await vscode.workspace.fs.writeFile(store, new TextEncoder().encode(JSON.stringify(settings, null, 2) + "\n"));
}
