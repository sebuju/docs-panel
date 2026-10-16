import * as vscode from "vscode";

export interface TreeNode {
  path: string;
  name: string;
  dir: boolean;
  mtime?: number;
  children?: TreeNode[];
  // What lies in the folder's own .trash: not entries of the folder, but its bin.
  trash?: TreeNode[];
}

const MAX_DEPTH = 12;
const SKIP = new Set(["node_modules"]);
const TRASH = ".trash";

// "bins" reads each folder's own .trash as that folder's bin. The trash itself is walked
// without, so a bin is never looked for inside one.
export async function buildTree(root: vscode.Uri, bins = true): Promise<TreeNode[]> {
  return (await walk(root, "", 0, bins)).nodes;
}

async function walk(
  uri: vscode.Uri,
  prefix: string,
  depth: number,
  bins: boolean
): Promise<{ nodes: TreeNode[]; trash?: TreeNode[] }> {
  if (depth >= MAX_DEPTH) {
    return { nodes: [] };
  }

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return { nodes: [] };
  }

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];
  let trash: TreeNode[] | undefined;

  for (const [name, type] of entries) {
    const path = prefix ? `${prefix}/${name}` : name;
    // The docs root's own .trash is the panel's trash, and is walked on its own.
    if (bins && prefix && name === TRASH && type & vscode.FileType.Directory) {
      trash = (await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, false)).nodes;
      continue;
    }
    if (name.startsWith(".") || SKIP.has(name)) {
      continue;
    }
    if (type & vscode.FileType.Directory) {
      const inner = await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, bins);
      dirs.push({
        path,
        name,
        dir: true,
        children: inner.nodes,
        ...(inner.trash ? { trash: inner.trash } : {})
      });
    } else if (type & vscode.FileType.File) {
      files.push({ path, name, dir: false, mtime: await modified(vscode.Uri.joinPath(uri, name)) });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  // The most recently touched file is the one being worked on, so it heads its folder.
  files.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return { nodes: [...dirs, ...files], trash };
}

async function modified(uri: vscode.Uri): Promise<number> {
  try {
    return (await vscode.workspace.fs.stat(uri)).mtime;
  } catch {
    return 0;
  }
}
