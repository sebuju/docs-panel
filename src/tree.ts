import * as vscode from "vscode";

export interface TreeNode {
  path: string;
  name: string;
  dir: boolean;
  children?: TreeNode[];
}

const MAX_DEPTH = 12;
const SKIP = new Set(["node_modules"]);

export async function buildTree(root: vscode.Uri): Promise<TreeNode[]> {
  return walk(root, "", 0);
}

async function walk(uri: vscode.Uri, prefix: string, depth: number): Promise<TreeNode[]> {
  if (depth >= MAX_DEPTH) {
    return [];
  }

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return [];
  }

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const [name, type] of entries) {
    if (name.startsWith(".") || SKIP.has(name)) {
      continue;
    }
    const path = prefix ? `${prefix}/${name}` : name;
    if (type & vscode.FileType.Directory) {
      dirs.push({
        path,
        name,
        dir: true,
        children: await walk(vscode.Uri.joinPath(uri, name), path, depth + 1)
      });
    } else if (type & vscode.FileType.File) {
      files.push({ path, name, dir: false });
    }
  }

  const byName = (a: TreeNode, b: TreeNode) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  dirs.sort(byName);
  files.sort(byName);
  return [...dirs, ...files];
}
