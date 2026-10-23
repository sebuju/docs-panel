import * as vscode from "vscode";
import { resolver, TOKEN } from "./mentions";
import { readText } from "./corpus";
import { Link } from "./links";

// Where the files that name a doc are looked for: nowhere, the docs, or every file of the
// workspace.
export type RefScope = "off" | "docs" | "all";

// What a file names, as written: the names in its text, read the way a page's names are,
// and the targets of its links. Kept with the time and size it had, so it is read again
// only once it has changed.
interface Entry {
  mtime: number;
  size: number;
  tokens: string[];
  hrefs: string[];
}

interface Cache {
  version: number;
  // The extension's version that wrote it: another version may read the files differently.
  build: string;
  // By path from the workspace root.
  files: Record<string, Entry>;
}

const CACHE_FILE = "docs-panel-refs.json";
const READ_AT_ONCE = 16;
const MAX_LISTED = 20000;
// The panel's own files name every doc, and a dependency or a trash is no one's reference.
const EXCLUDE = "{**/node_modules/**,**/.git/**,**/.trash/**,**/.docs-panel.json,.vscode/docs-panel-*.json}";
const EXCLUDED = /(^|\/)(node_modules|\.git|\.trash)(\/|$)|(^|\/)\.docs-panel\.json$|^\.vscode\/docs-panel-[^/]*\.json$/;
const HREFS = [
  /\]\(\s*<?([^)\s>]+)>?/g,
  /^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/gm,
  /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi
];

export function refsUri(workspace: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspace, ".vscode", CACHE_FILE);
}

// The files that name a doc: every file is read once for what it names, and the answer
// for every doc at once is worked out from that and kept until a file or the tree
// changes. The docs are known from the tree, with their times; the rest of the workspace
// is listed once and then followed by a watcher, so a file is only looked at again when
// it has changed.
export class Refs {
  private cache: Cache | undefined;
  private listed: string[] | undefined;
  // Whether the workspace's files have been checked against the cache since the watcher
  // started; until then any of them may have changed unseen.
  private checked = false;
  private readonly dirty = new Set<string>();
  private watcher: vscode.FileSystemWatcher | undefined;
  private generation = 0;
  private index: { key: string; by: Map<string, string[]> } | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly build: string, private readonly changed: () => void) {}

  // "root" is the docs folder from the workspace root, "" when they are one; "docs" every
  // doc by its path in the docs, with its modified time.
  of(
    workspace: vscode.Uri,
    root: string,
    target: string,
    scope: RefScope,
    docs: Map<string, number>,
    stamp: string
  ): Promise<Link[]> {
    // One pass at a time, so two pages opened quickly never read the same files twice.
    const run = this.queue.then(() => this.find(workspace, root, target, scope, docs, stamp));
    this.queue = run.catch(() => undefined);
    return run;
  }

  // A purge deletes the file under the cache held here, so it is read again next time.
  forget(): void {
    this.cache = undefined;
    this.index = undefined;
    this.generation++;
  }

  dispose(): void {
    this.stopWatching();
  }

  private async find(
    workspace: vscode.Uri,
    root: string,
    target: string,
    scope: RefScope,
    docs: Map<string, number>,
    stamp: string
  ): Promise<Link[]> {
    if (scope === "off") {
      this.stopWatching();
      return [];
    }
    const cache = await this.load(workspace);
    const wsPath = (path: string) => (root ? `${root}/${path}` : path);
    const docPath = (path: string): string | undefined => {
      const rel = !root ? path : path.startsWith(`${root}/`) ? path.slice(root.length + 1) : undefined;
      return rel !== undefined && docs.has(rel) ? rel : undefined;
    };

    // Each source with the time the tree gave it, or none for a file outside the docs.
    const sources = new Map<string, number | undefined>();
    for (const [path, mtime] of docs) {
      sources.set(wsPath(path), mtime);
    }
    if (scope === "all") {
      this.watch(workspace);
      if (!this.listed) {
        const found = await vscode.workspace.findFiles(new vscode.RelativePattern(workspace, "**/*"), EXCLUDE, MAX_LISTED);
        this.listed = found.map((uri) => relativeTo(workspace, uri)).filter((path) => !EXCLUDED.test(path));
      }
      for (const path of this.listed) {
        if (!sources.has(path)) {
          sources.set(path, undefined);
        }
      }
    } else {
      this.stopWatching();
    }

    let changed = false;
    for (const path of Object.keys(cache.files)) {
      const underDocs = !root || path.startsWith(`${root}/`);
      if (!sources.has(path) && (scope === "all" || underDocs)) {
        delete cache.files[path];
        changed = true;
      }
    }

    const look: [string, number | undefined][] = [];
    for (const [path, mtime] of sources) {
      const kept = cache.files[path];
      if (mtime !== undefined ? !kept || kept.mtime !== mtime : !kept || !this.checked || this.dirty.has(path)) {
        look.push([path, mtime]);
      }
    }
    for (let i = 0; i < look.length; i += READ_AT_ONCE) {
      const read = await Promise.all(look.slice(i, i + READ_AT_ONCE).map(([path, mtime]) => this.read(workspace, path, mtime, cache.files[path])));
      read.forEach((entry, j) => {
        if (entry) {
          cache.files[look[i + j][0]] = entry;
          changed = true;
        }
      });
    }
    if (scope === "all") {
      this.checked = true;
      this.dirty.clear();
    }
    if (changed) {
      this.generation++;
      await this.save(workspace, cache);
    }

    const key = `${scope}|${root}|${stamp}|${this.generation}`;
    if (this.index?.key !== key) {
      this.index = { key, by: this.invert(cache, sources, docs, docPath) };
    }
    return (this.index.by.get(target) ?? [])
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((path) => {
        const doc = docPath(path);
        return doc !== undefined ? { path: doc } : { path, workspace: true };
      });
  }

  // A name leads where it does on a page: from the file's own folder first, then to the
  // doc whose path ends in it or, alone, has its name. A link's target is only ever taken
  // from the file's own folder. A file naming itself is no reference.
  private invert(
    cache: Cache,
    sources: Map<string, number | undefined>,
    docs: Map<string, number>,
    docPath: (path: string) => string | undefined
  ): Map<string, string[]> {
    const find = resolver(new Set(docs.keys()));
    const by = new Map<string, string[]>();
    for (const path of sources.keys()) {
      const entry = cache.files[path];
      if (!entry) {
        continue;
      }
      const dir = path.split("/").slice(0, -1);
      const near = (name: string) => {
        const joined = normalize([...dir, ...name.split("/")]);
        return joined === undefined ? undefined : docPath(joined);
      };
      const hits = new Set<string>();
      for (const href of entry.hrefs) {
        const hit = near(href);
        if (hit !== undefined) {
          hits.add(hit);
        }
      }
      for (const token of entry.tokens) {
        const clean = token.replace(/\\/g, "/");
        const hit = near(clean) ?? find(clean);
        if (hit !== undefined) {
          hits.add(hit);
        }
      }
      const self = docPath(path);
      for (const hit of hits) {
        if (hit !== self) {
          const list = by.get(hit);
          if (list) {
            list.push(path);
          } else {
            by.set(hit, [path]);
          }
        }
      }
    }
    return by;
  }

  // A doc's time comes from the tree; any other file's is looked up, and the file is read
  // only when its time or size is not what the cache has. Undefined keeps what is kept.
  private async read(workspace: vscode.Uri, path: string, mtime: number | undefined, kept: Entry | undefined): Promise<Entry | undefined> {
    const uri = vscode.Uri.joinPath(workspace, ...path.split("/"));
    let size = -1;
    if (mtime === undefined) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        mtime = stat.mtime;
        size = stat.size;
      } catch {
        return { mtime: 0, size: -1, tokens: [], hrefs: [] };
      }
      if (kept && kept.mtime === mtime && kept.size === size) {
        return undefined;
      }
    }
    const text = await readText(uri, path);
    return { mtime, size, ...namesIn(text ?? "") };
  }

  // Outside the docs nothing else is watching, so the workspace is, while it is searched.
  private watch(workspace: vscode.Uri): void {
    if (this.watcher) {
      return;
    }
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspace, "**/*"));
    const mark = (uri: vscode.Uri, listing: boolean) => {
      const path = relativeTo(workspace, uri);
      if (EXCLUDED.test(path)) {
        return;
      }
      if (listing) {
        this.listed = undefined;
      }
      this.dirty.add(path);
      this.changed();
    };
    watcher.onDidChange((uri) => mark(uri, false));
    watcher.onDidCreate((uri) => mark(uri, true));
    watcher.onDidDelete((uri) => mark(uri, true));
    this.watcher = watcher;
  }

  private stopWatching(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
    this.checked = false;
    this.listed = undefined;
    this.dirty.clear();
  }

  private async load(workspace: vscode.Uri): Promise<Cache> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(refsUri(workspace))));
      this.cache =
        parsed?.version === 1 && parsed.build === this.build && parsed.files && typeof parsed.files === "object"
          ? { version: 1, build: this.build, files: parsed.files }
          : { version: 1, build: this.build, files: {} };
    } catch {
      this.cache = { version: 1, build: this.build, files: {} };
    }
    return this.cache;
  }

  private async save(workspace: vscode.Uri, cache: Cache): Promise<void> {
    const store = refsUri(workspace);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(store, ".."));
      await vscode.workspace.fs.writeFile(store, new TextEncoder().encode(JSON.stringify(cache) + "\n"));
    } catch {
      // A cache that cannot be written is worked out again next time.
    }
  }
}

// Only a target in the workspace is kept: no scheme, no other host, no anchor alone.
function namesIn(text: string): { tokens: string[]; hrefs: string[] } {
  const tokens = new Set([...text.matchAll(TOKEN)].map((found) => found[0]));
  const hrefs = new Set<string>();
  for (const pattern of HREFS) {
    for (const found of text.matchAll(pattern)) {
      const value = found[1];
      if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(value)) {
        continue;
      }
      let clean = value.split(/[?#]/)[0];
      try {
        clean = decodeURIComponent(clean);
      } catch {
        // Left as written.
      }
      if (clean) {
        hrefs.add(clean.replace(/\\/g, "/"));
      }
    }
  }
  return { tokens: [...tokens], hrefs: [...hrefs] };
}

function relativeTo(root: vscode.Uri, uri: vscode.Uri): string {
  const rootPath = root.path.endsWith("/") ? root.path : root.path + "/";
  return uri.path.startsWith(rootPath) ? uri.path.slice(rootPath.length) : uri.path;
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
