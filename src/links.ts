import * as vscode from "vscode";
import { createHash } from "crypto";
import { resolver, TOKEN } from "./mentions";

// Where a name written in a document leads: a file of the docs, opened in the panel, or
// any other file of the workspace, opened in an editor.
export interface Link {
  path: string;
  workspace?: boolean;
}

interface Entry {
  mtime: number;
  tree: string;
  links: Record<string, Link>;
}

interface Cache {
  version: number;
  files: Record<string, Entry>;
}

const CACHE_FILE = "docs-panel-links.json";

export function linksUri(workspace: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspace, ".vscode", CACHE_FILE);
}

// The same list of files always gives the same stamp, so a document's links are worked out
// again only once it has been edited or a file has come or gone.
export function treeStamp(files: Set<string>): string {
  return createHash("sha1").update([...files].sort().join("\n")).digest("hex").slice(0, 16);
}

// Looking a name up in the workspace costs a stat for every name, so what a document's
// names lead to is kept, per document, beside the panel's other caches.
export class Links {
  private cache: Cache | undefined;

  async of(
    workspace: vscode.Uri,
    relPath: string,
    text: string,
    mtime: number,
    files: Set<string>,
    stamp: string
  ): Promise<Record<string, Link>> {
    const cache = await this.load(workspace);
    const kept = cache.files[relPath];
    if (kept && kept.mtime === mtime && kept.tree === stamp) {
      return kept.links;
    }
    const links = await resolveAll(workspace, relPath, text, files);
    cache.files[relPath] = { mtime, tree: stamp, links };
    for (const path of Object.keys(cache.files)) {
      if (!files.has(path)) {
        delete cache.files[path];
      }
    }
    await this.save(workspace, cache);
    return links;
  }

  // A purge deletes the file under the cache held here, so it is read again next time.
  forget(): void {
    this.cache = undefined;
  }

  private async load(workspace: vscode.Uri): Promise<Cache> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(linksUri(workspace))));
      this.cache =
        parsed?.version === 1 && parsed.files && typeof parsed.files === "object"
          ? { version: 1, files: parsed.files }
          : { version: 1, files: {} };
    } catch {
      this.cache = { version: 1, files: {} };
    }
    return this.cache;
  }

  private async save(workspace: vscode.Uri, cache: Cache): Promise<void> {
    const store = linksUri(workspace);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(store, ".."));
      await vscode.workspace.fs.writeFile(store, new TextEncoder().encode(JSON.stringify(cache) + "\n"));
    } catch {
      // A cache that cannot be written is worked out again next time.
    }
  }
}

// A name is first a path from the document's own folder, then any file of the docs whose
// path ends in it or, alone, has its name, and last a path from the workspace root. The
// document never links to itself.
async function resolveAll(
  workspace: vscode.Uri,
  relPath: string,
  text: string,
  files: Set<string>
): Promise<Record<string, Link>> {
  const tokens = new Set([...text.matchAll(TOKEN)].map((found) => found[0]));
  const find = resolver(files);
  const dir = relPath.split("/").slice(0, -1);
  const out: Record<string, Link> = {};
  const outside: string[] = [];
  for (const token of tokens) {
    const clean = token.replace(/\\/g, "/");
    const near = normalize([...dir, ...clean.split("/")]);
    const path = (near && files.has(near) ? near : undefined) ?? find(clean);
    if (path) {
      if (path !== relPath) {
        out[token] = { path };
      }
    } else {
      outside.push(token);
    }
  }
  await Promise.all(
    outside.map(async (token) => {
      const path = normalize(token.replace(/\\/g, "/").split("/"));
      if (!path) {
        return;
      }
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspace, ...path.split("/")));
        if (stat.type & vscode.FileType.File) {
          out[token] = { path, workspace: true };
        }
      } catch {
        // Not a file of the workspace: only a word with a dot in it.
      }
    })
  );
  return out;
}

function normalize(parts: string[]): string | undefined {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (!out.length) {
        return undefined;
      }
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.length ? out.join("/") : undefined;
}
