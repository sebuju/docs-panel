import * as vscode from "vscode";
import { promises as fs } from "fs";
import { homedir } from "os";
import * as path from "path";

export interface Mention {
  token: string;
  at: string;
  session: string;
  role: string;
  excerpt: string;
}

interface Cache {
  version: number;
  sessions: Record<string, number>;
  hits: Mention[];
}

const CACHE_FILE = "docs-panel-mentions.json";
const EXCERPT = 140;
const NEWLINE = 10;

// Flat character classes only: a nested repeat over the same characters backtracks so
// badly that a megabyte of log never finishes.
const TOKEN = /[\w-][\w.\-\\/]*\.[A-Za-z][A-Za-z0-9]{0,5}/g;

// A workspace path is the session folder's name with every separator flattened.
export function sessionsDir(workspace: vscode.Uri): string {
  return path.join(
    homedir(),
    ".claude",
    "projects",
    workspace.fsPath.replace(/[^A-Za-z0-9]/g, "-")
  );
}

function cacheUri(workspace: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspace, ".vscode", CACHE_FILE);
}

function emptyCache(): Cache {
  return { version: 1, sessions: {}, hits: [] };
}

async function loadCache(workspace: vscode.Uri): Promise<Cache> {
  try {
    const bytes = await vscode.workspace.fs.readFile(cacheUri(workspace));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed?.version !== 1 || !parsed.sessions || !Array.isArray(parsed.hits)) {
      return emptyCache();
    }
    return { version: 1, sessions: parsed.sessions, hits: parsed.hits };
  } catch {
    return emptyCache();
  }
}

async function saveCache(workspace: vscode.Uri, cache: Cache): Promise<void> {
  const store = cacheUri(workspace);
  const text = JSON.stringify(cache) + "\n";
  await vscode.workspace.fs.createDirectory(
    store.with({ path: store.path.split("/").slice(0, -1).join("/") })
  );
  await vscode.workspace.fs.writeFile(store, new TextEncoder().encode(text));
}

// Session logs only ever grow, so a file whose size has not moved is never opened and
// one that has grown is read from where the last pass stopped.
export async function refresh(workspace: vscode.Uri): Promise<Mention[]> {
  const dir = sessionsDir(workspace);
  const cache = await loadCache(workspace);

  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((name) => name.endsWith(".jsonl"));
  } catch {
    return cache.hits;
  }

  let changed = false;
  const present = new Set(names);
  for (const name of Object.keys(cache.sessions)) {
    if (!present.has(name)) {
      delete cache.sessions[name];
      cache.hits = cache.hits.filter((hit) => hit.session !== sessionId(name));
      changed = true;
    }
  }

  for (const name of names) {
    let size: number;
    try {
      size = (await fs.stat(path.join(dir, name))).size;
    } catch {
      continue;
    }
    const done = cache.sessions[name] ?? 0;
    if (size === done) {
      continue;
    }
    const session = sessionId(name);
    // A file that shrank was rewritten rather than appended to, so its hits start over.
    const from = size < done ? 0 : done;
    if (from === 0 && done > 0) {
      cache.hits = cache.hits.filter((hit) => hit.session !== session);
    }
    const scanned = await scan(path.join(dir, name), from, size, session);
    cache.hits.push(...scanned.hits);
    cache.sessions[name] = from + scanned.consumed;
    changed = true;
  }

  if (changed) {
    cache.hits.sort((a, b) => a.at.localeCompare(b.at));
    await saveCache(workspace, cache);
  }
  return cache.hits;
}

function sessionId(name: string): string {
  return name.slice(0, -".jsonl".length);
}

async function scan(
  file: string,
  from: number,
  to: number,
  session: string
): Promise<{ hits: Mention[]; consumed: number }> {
  const hits: Mention[] = [];
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(to - from);
    await handle.read(buffer, 0, buffer.length, from);
    // A half-written line is left for the next pass, which also keeps the offset on a
    // byte boundary no multi-byte character can straddle.
    const end = buffer.lastIndexOf(NEWLINE);
    if (end < 0) {
      return { hits, consumed: 0 };
    }
    for (const line of buffer.subarray(0, end + 1).toString("utf8").split("\n")) {
      collect(line, session, hits);
    }
    return { hits, consumed: end + 1 };
  } finally {
    await handle.close();
  }
}

function collect(line: string, session: string, out: Mention[]): void {
  if (!line) {
    return;
  }
  let entry: any;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  const role = entry?.type;
  if (entry?.isMeta || (role !== "user" && role !== "assistant")) {
    return;
  }
  const at = typeof entry.timestamp === "string" ? entry.timestamp : "";
  for (const text of texts(entry.message?.content)) {
    for (const found of text.matchAll(TOKEN)) {
      out.push({
        token: found[0],
        at,
        session,
        role,
        excerpt: excerptAt(text, found.index ?? 0, found[0].length)
      });
    }
  }
}

// What was said, and nothing else: tool results are file contents rather than talk, and
// a slash command's wrapper was never typed at the panel's files.
function texts(content: unknown): string[] {
  if (typeof content === "string") {
    return content.includes("<command-name>") || content.includes("<local-command-caveat>")
      ? []
      : [content];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);
}

function excerptAt(text: string, index: number, length: number): string {
  const pad = Math.max(0, Math.floor((EXCERPT - length) / 2));
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + body + (end < text.length ? "…" : "");
}

// Tokens are kept as they were written, so the files they belong to are worked out here
// against whatever the tree holds now: a doc added later gets its history with no reparse.
export function match(hits: Mention[], files: Set<string>): Record<string, Mention[]> {
  const byPath = new Map<string, string>();
  const byName = new Map<string, string | null>();
  for (const file of files) {
    byPath.set(file.toLowerCase(), file);
    const name = (file.split("/").pop() ?? file).toLowerCase();
    byName.set(name, byName.has(name) ? null : file);
  }

  const out: Record<string, Mention[]> = {};
  for (const hit of hits) {
    const file = resolve(hit.token, byPath, byName);
    if (file) {
      (out[file] ??= []).push(hit);
    }
  }
  return out;
}

// The longest tail of the token that names a file wins; a bare name only counts when one
// file in the tree carries it, so two README.md are never taken for one another.
function resolve(
  token: string,
  byPath: Map<string, string>,
  byName: Map<string, string | null>
): string | undefined {
  const parts = token.replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const file = byPath.get(parts.slice(i).join("/"));
    if (file) {
      return file;
    }
  }
  return byName.get(parts[parts.length - 1] ?? "") ?? undefined;
}
