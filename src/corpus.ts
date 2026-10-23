import * as vscode from "vscode";
import { TreeNode } from "./tree";
import { IMAGES, extensionOf } from "./render";

export interface CorpusEntry {
  path: string;
  name: string;
  dir: boolean;
  text: string | null;
}

const MAX_BYTES = 2 * 1024 * 1024;
const SNIFF_BYTES = 8000;

// Everything the search across the docs looks at, in the order the tree shows it: every
// folder and file by name, and the text of every file that has text to search. A file's
// text is only read again once its time stamp has moved.
export class Corpus {
  private readonly texts = new Map<string, { mtime: number; text: string | null }>();

  async collect(root: vscode.Uri, nodes: TreeNode[]): Promise<CorpusEntry[]> {
    const out: CorpusEntry[] = [];
    const seen = new Set<string>();
    const visit = async (items: TreeNode[]) => {
      for (const node of items) {
        if (node.dir) {
          out.push({ path: node.path, name: node.name, dir: true, text: null });
          await visit(node.children ?? []);
          continue;
        }
        seen.add(node.path);
        out.push({
          path: node.path,
          name: node.name,
          dir: false,
          text: await this.text(root, node)
        });
      }
    };
    await visit(nodes);
    for (const path of [...this.texts.keys()]) {
      if (!seen.has(path)) {
        this.texts.delete(path);
      }
    }
    return out;
  }

  private async text(root: vscode.Uri, node: TreeNode): Promise<string | null> {
    const mtime = node.mtime ?? 0;
    const cached = this.texts.get(node.path);
    if (cached && cached.mtime === mtime) {
      return cached.text;
    }
    const text = await readText(vscode.Uri.joinPath(root, ...node.path.split("/")), node.path);
    this.texts.set(node.path, { mtime, text });
    return text;
  }
}

// A picture, anything too big to be a document, and anything with a NUL near its start
// have no text worth searching.
export async function readText(uri: vscode.Uri, relPath: string): Promise<string | null> {
  if (IMAGES.has(extensionOf(relPath))) {
    return null;
  }
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    if (bytes.byteLength > MAX_BYTES || bytes.subarray(0, SNIFF_BYTES).includes(0)) {
      return null;
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
