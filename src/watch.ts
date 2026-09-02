import * as vscode from "vscode";

export interface WatchHandlers {
  onTreeChange: () => void;
  onFileChange: (relPath: string) => void;
}

const DEBOUNCE_MS = 120;

export function watchRoot(root: vscode.Uri, handlers: WatchHandlers): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, "**/*")
  );

  let timer: NodeJS.Timeout | undefined;
  let treeDirty = false;
  const changed = new Set<string>();

  const flush = () => {
    timer = undefined;
    const paths = [...changed];
    changed.clear();
    if (treeDirty) {
      treeDirty = false;
      handlers.onTreeChange();
    }
    for (const path of paths) {
      handlers.onFileChange(path);
    }
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  const relative = (uri: vscode.Uri): string | undefined => {
    const rootPath = root.path.endsWith("/") ? root.path : root.path + "/";
    return uri.path.startsWith(rootPath) ? uri.path.slice(rootPath.length) : undefined;
  };

  watcher.onDidCreate(() => {
    treeDirty = true;
    schedule();
  });
  watcher.onDidDelete(() => {
    treeDirty = true;
    schedule();
  });
  watcher.onDidChange((uri) => {
    const path = relative(uri);
    if (path) {
      changed.add(path);
      schedule();
    }
  });

  return new vscode.Disposable(() => {
    if (timer) {
      clearTimeout(timer);
    }
    watcher.dispose();
  });
}
