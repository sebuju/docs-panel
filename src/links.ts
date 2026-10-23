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
  // The extension's version that wrote it: another version may resolve names differently.
  build: string;
  files: Record<string, Entry>;
  // Whether a path from the workspace root is a file, and when that was looked up: shared
  // by every document, so a name written in many is looked up once.
  outside: Record<string, { file: boolean; at: number }>;
}

const CACHE_FILE = "docs-panel-links.json";
// The workspace outside the docs is not watched, so what a lookup found there is trusted
// for this long and then looked up again.
const OUTSIDE_MS = 10 * 60 * 1000;
// Lookups at the same time; a long page can name thousands of things that are not files.
const OUTSIDE_AT_ONCE = 16;

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

  constructor(private readonly build: string) {}

  // What a document's names led to the last time they were worked out, whether or not it
  // or the docs have changed since: the page is shown with these at once, and put right
  // when of() has the answer for the document as it is now.
  async kept(workspace: vscode.Uri, relPath: string): Promise<Record<string, Link> | undefined> {
    return (await this.load(workspace)).files[relPath]?.links;
  }

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
    const links = await resolveAll(workspace, relPath, text, files, cache.outside);
    cache.files[relPath] = { mtime, tree: stamp, links };
    for (const path of Object.keys(cache.files)) {
      if (!files.has(path)) {
        delete cache.files[path];
      }
    }
    const stale = Date.now() - OUTSIDE_MS;
    for (const [path, found] of Object.entries(cache.outside)) {
      if (found.at < stale) {
        delete cache.outside[path];
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
        parsed?.version === 2 && parsed.build === this.build && parsed.files && typeof parsed.files === "object"
          ? { version: 2, build: this.build, files: parsed.files, outside: objectOf(parsed.outside) }
          : { version: 2, build: this.build, files: {}, outside: {} };
    } catch {
      this.cache = { version: 2, build: this.build, files: {}, outside: {} };
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
  files: Set<string>,
  outside: Cache["outside"]
): Promise<Record<string, Link>> {
  const tokens = new Set([...text.matchAll(TOKEN)].map((found) => found[0]));
  const find = resolver(files);
  const dir = relPath.split("/").slice(0, -1);
  const out: Record<string, Link> = {};
  const unknown = new Map<string, string[]>();
  const fresh = Date.now() - OUTSIDE_MS;
  for (const token of tokens) {
    const clean = token.replace(/\\/g, "/");
    const near = normalize([...dir, ...clean.split("/")]);
    const path = (near && files.has(near) ? near : undefined) ?? find(clean);
    if (path) {
      if (path !== relPath) {
        out[token] = { path };
      }
      continue;
    }
    const root = normalize(clean.split("/"));
    if (!root) {
      continue;
    }
    const known = outside[root];
    if (known && known.at >= fresh) {
      if (known.file) {
        out[token] = { path: root, workspace: true };
      }
      continue;
    }
    unknown.set(root, [...(unknown.get(root) ?? []), token]);
  }
  const paths = [...unknown.keys()];
  for (let i = 0; i < paths.length; i += OUTSIDE_AT_ONCE) {
    await Promise.all(
      paths.slice(i, i + OUTSIDE_AT_ONCE).map(async (path) => {
        let file = false;
        try {
          const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspace, ...path.split("/")));
          file = (stat.type & vscode.FileType.File) !== 0;
        } catch {
          // Not a file of the workspace: only a word with a dot in it.
        }
        outside[path] = { file, at: Date.now() };
        if (file) {
          for (const token of unknown.get(path) ?? []) {
            out[token] = { path, workspace: true };
          }
        }
      })
    );
  }
  return out;
}

function objectOf(value: unknown): Cache["outside"] {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Cache["outside"]) : {};
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
