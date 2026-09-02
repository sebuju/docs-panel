import * as vscode from "vscode";
import { createHash } from "crypto";

export const STATUSES = ["planned", "in progress", "done", "stale"] as const;
export type Status = (typeof STATUSES)[number];

export interface Entry {
  status: Status;
  hash: string;
  size: number;
  updated: string;
}

export interface Ledger {
  version: number;
  files: Record<string, Entry>;
}

export const LEDGER_FILE = ".docs-panel.json";
const TRASH_DIR = ".trash";
const MAX_DEPTH = 12;

export function emptyLedger(): Ledger {
  return { version: 1, files: {} };
}

export async function readLedger(root: vscode.Uri): Promise<Ledger> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root, LEDGER_FILE));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const files: Record<string, Entry> = {};
    for (const [path, entry] of Object.entries(parsed?.files ?? {})) {
      const value = entry as Partial<Entry>;
      if (value && STATUSES.includes(value.status as Status)) {
        files[path] = {
          status: value.status as Status,
          hash: typeof value.hash === "string" ? value.hash : "",
          size: typeof value.size === "number" ? value.size : -1,
          updated: typeof value.updated === "string" ? value.updated : ""
        };
      }
    }
    return { version: 1, files };
  } catch {
    return emptyLedger();
  }
}

export async function writeLedger(root: vscode.Uri, ledger: Ledger): Promise<void> {
  const sorted: Record<string, Entry> = {};
  for (const path of Object.keys(ledger.files).sort()) {
    sorted[path] = ledger.files[path];
  }
  const text = JSON.stringify({ version: ledger.version, files: sorted }, null, 2) + "\n";
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(root, LEDGER_FILE),
    new TextEncoder().encode(text)
  );
}

export async function setStatus(
  root: vscode.Uri,
  relPath: string,
  status: Status | null
): Promise<Ledger> {
  const ledger = await readLedger(root);
  if (status === null) {
    delete ledger.files[relPath];
  } else {
    ledger.files[relPath] = { status, ...(await fingerprint(root, relPath)) };
  }
  await writeLedger(root, ledger);
  return ledger;
}

// A move this panel performs is known exactly, so it is re-keyed instead of guessed at.
export async function rekey(root: vscode.Uri, from: string, to: string): Promise<void> {
  const ledger = await readLedger(root);
  const entry = ledger.files[from];
  if (!entry) {
    return;
  }
  delete ledger.files[from];
  ledger.files[to] = { ...entry, ...(await fingerprint(root, to)) };
  await writeLedger(root, ledger);
}

// Files can also be moved from outside this panel. An entry whose path is gone is matched
// against the paths that appeared, by content first and by name second, so a rename keeps
// its status and two files sharing a name cannot be confused for one another.
export async function prune(root: vscode.Uri): Promise<Ledger> {
  const ledger = await readLedger(root);
  const present = await listFiles(root);

  const missing = Object.keys(ledger.files).filter((path) => !present.has(path));
  if (missing.length === 0) {
    return ledger;
  }

  const fresh = [...present].filter((path) => !(path in ledger.files));
  const freshHashes = new Map<string, string>();
  for (const path of fresh) {
    freshHashes.set(path, (await fingerprint(root, path)).hash);
  }

  const taken = new Set<string>();
  for (const from of missing) {
    const entry = ledger.files[from];
    const to =
      pickOne(fresh, taken, (path) => freshHashes.get(path) === entry.hash && entry.hash !== "") ??
      pickOne(fresh, taken, (path) => baseName(path) === baseName(from));

    delete ledger.files[from];
    if (to) {
      taken.add(to);
      ledger.files[to] = { ...entry, ...(await fingerprint(root, to)) };
    }
  }

  await writeLedger(root, ledger);
  return ledger;
}

// A candidate only counts when it is the single match, so an ambiguous name is dropped
// rather than attached to the wrong file.
function pickOne(
  candidates: string[],
  taken: Set<string>,
  matches: (path: string) => boolean
): string | undefined {
  const found = candidates.filter((path) => !taken.has(path) && matches(path));
  return found.length === 1 ? found[0] : undefined;
}

async function fingerprint(
  root: vscode.Uri,
  relPath: string
): Promise<Pick<Entry, "hash" | "size" | "updated">> {
  try {
    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(root, ...relPath.split("/"))
    );
    return {
      hash: createHash("sha1").update(bytes).digest("hex").slice(0, 16),
      size: bytes.byteLength,
      updated: new Date().toISOString()
    };
  } catch {
    return { hash: "", size: -1, updated: new Date().toISOString() };
  }
}

// Unlike the tree walk this one descends into the trash, because a trashed file keeps
// its ledger entry and must still count as present.
export async function listFiles(root: vscode.Uri): Promise<Set<string>> {
  const found = new Set<string>();
  await walk(root, "", 0, found);
  return found;
}

async function walk(
  uri: vscode.Uri,
  prefix: string,
  depth: number,
  found: Set<string>
): Promise<void> {
  if (depth >= MAX_DEPTH) {
    return;
  }
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return;
  }
  for (const [name, type] of entries) {
    if (name === "node_modules" || (name.startsWith(".") && name !== TRASH_DIR)) {
      continue;
    }
    const path = prefix ? `${prefix}/${name}` : name;
    if (type & vscode.FileType.Directory) {
      await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, found);
    } else if (type & vscode.FileType.File) {
      found.add(path);
    }
  }
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
