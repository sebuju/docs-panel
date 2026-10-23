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

  // Every entry is read at once, and the results kept in the folder's own order, so a slow
  // disk costs the time of the slowest entry and not of all of them one after another.
  let trash: TreeNode[] | undefined;
  const read = await Promise.all(
    entries.map(async ([name, type]): Promise<TreeNode | undefined> => {
      const path = prefix ? `${prefix}/${name}` : name;
      // The docs root's own .trash is the panel's trash, and is walked on its own.
      if (bins && prefix && name === TRASH && type & vscode.FileType.Directory) {
        trash = (await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, false)).nodes;
        return undefined;
      }
      if (name.startsWith(".") || SKIP.has(name)) {
        return undefined;
      }
      if (type & vscode.FileType.Directory) {
        const inner = await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, bins);
        return {
          path,
          name,
          dir: true,
          children: inner.nodes,
          ...(inner.trash ? { trash: inner.trash } : {})
        };
      }
      if (type & vscode.FileType.File) {
        return { path, name, dir: false, mtime: await modified(vscode.Uri.joinPath(uri, name)) };
      }
      return undefined;
    })
  );
  const dirs = read.filter((node): node is TreeNode => !!node && node.dir);
  const files = read.filter((node): node is TreeNode => !!node && !node.dir);

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
