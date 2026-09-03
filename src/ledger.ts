import * as vscode from "vscode";
import { createHash } from "crypto";

export const STATUSES = [
  "planned",
  "in progress",
  "testing",
  "done",
  "refused",
  "stale"
] as const;
export type Status = (typeof STATUSES)[number];

export const READ = "read";
const READ_STATUSES = [READ] as const;

export interface Entry {
  status: string;
  hash: string;
  size: number;
  updated: string;
}

export interface Ledger {
  version: number;
  files: Record<string, Entry>;
}

// Two ledgers share every operation below; only the file they live in, the values they
// accept, and the meaning of an entry differ.
export interface LedgerSpec {
  store: vscode.Uri;
  root: vscode.Uri;
  statuses: readonly string[];
}

const STATUS_FILE = ".docs-panel.json";
const READS_FILE = "docs-panel-reads.json";
const TRASH_DIR = ".trash";
const MAX_DEPTH = 12;

export function statusLedger(root: vscode.Uri): LedgerSpec {
  return { store: vscode.Uri.joinPath(root, STATUS_FILE), root, statuses: STATUSES };
}

export function readsLedger(workspace: vscode.Uri, root: vscode.Uri): LedgerSpec {
  return {
    store: vscode.Uri.joinPath(workspace, ".vscode", READS_FILE),
    root,
    statuses: READ_STATUSES
  };
}

export function emptyLedger(): Ledger {
  return { version: 1, files: {} };
}

export async function load(spec: LedgerSpec): Promise<Ledger> {
  try {
    const bytes = await vscode.workspace.fs.readFile(spec.store);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const files: Record<string, Entry> = {};
    for (const [path, entry] of Object.entries(parsed?.files ?? {})) {
      const value = entry as Partial<Entry>;
      if (value && spec.statuses.includes(value.status as string)) {
        files[path] = {
          status: value.status as string,
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

export async function save(spec: LedgerSpec, ledger: Ledger): Promise<void> {
  const sorted: Record<string, Entry> = {};
  for (const path of Object.keys(ledger.files).sort()) {
    sorted[path] = ledger.files[path];
  }
  const text = JSON.stringify({ version: ledger.version, files: sorted }, null, 2) + "\n";
  const folder = spec.store.with({ path: spec.store.path.split("/").slice(0, -1).join("/") });
  await vscode.workspace.fs.createDirectory(folder);
  await vscode.workspace.fs.writeFile(spec.store, new TextEncoder().encode(text));
}

export async function setStatus(
  spec: LedgerSpec,
  relPath: string,
  status: string | null
): Promise<Ledger> {
  const ledger = await load(spec);
  if (status === null) {
    delete ledger.files[relPath];
  } else {
    ledger.files[relPath] = { status, ...(await fingerprint(spec.root, relPath)) };
  }
  await save(spec, ledger);
  return ledger;
}

// A file edited on disk is no longer the file that was read, so its entry is dropped.
// Returns the ledger only when something actually changed.
export async function invalidate(spec: LedgerSpec, relPath: string): Promise<Ledger | undefined> {
  const ledger = await load(spec);
  const entry = ledger.files[relPath];
  if (!entry) {
    return undefined;
  }
  const current = await fingerprint(spec.root, relPath);
  if (current.hash === entry.hash) {
    return undefined;
  }
  delete ledger.files[relPath];
  await save(spec, ledger);
  return ledger;
}

// A move this panel performs is known exactly, so it is re-keyed instead of guessed at.
export async function rekey(spec: LedgerSpec, from: string, to: string): Promise<void> {
  const ledger = await load(spec);
  const entry = ledger.files[from];
  if (!entry) {
    return;
  }
  delete ledger.files[from];
  ledger.files[to] = { ...entry, ...(await fingerprint(spec.root, to)) };
  await save(spec, ledger);
}

// Files can also be moved from outside this panel. An entry whose path is gone is matched
// against the paths that appeared, by content first and by name second, so a rename keeps
// its status and two files sharing a name cannot be confused for one another.
export async function prune(spec: LedgerSpec): Promise<Ledger> {
  const ledger = await load(spec);
  const present = await listFiles(spec.root);

  const missing = Object.keys(ledger.files).filter((path) => !present.has(path));
  if (missing.length === 0) {
    return ledger;
  }

  const fresh = [...present].filter((path) => !(path in ledger.files));
  const freshHashes = new Map<string, string>();
  for (const path of fresh) {
    freshHashes.set(path, (await fingerprint(spec.root, path)).hash);
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
      ledger.files[to] = { ...entry, ...(await fingerprint(spec.root, to)) };
    }
  }

  await save(spec, ledger);
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
