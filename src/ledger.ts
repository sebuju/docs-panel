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

// Names of colours the theme itself defines, so a mark follows whatever theme the editor
// wears. The webview maps each name onto the theme variable it stands for.
export const COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "cyan",
  "magenta",
  "grey"
] as const;

export const READ = "read";
const READ_STATUSES = [READ] as const;
const MAX_TAG = 40;

export interface Entry {
  status: string;
  tags: string[];
  color: string;
  hash: string;
  size: number;
  updated: string;
}

export interface Mark {
  color: string;
}

export interface Ledger {
  version: number;
  files: Record<string, Entry>;
  folders: Record<string, Mark>;
  tags: Record<string, Mark>;
}

// Two ledgers share every operation below; only the file they live in, the values they
// accept, and the meaning of an entry differ. Only the status ledger carries marks: the
// tags and colours travel with the documents the way the statuses do.
export interface LedgerSpec {
  store: vscode.Uri;
  root: vscode.Uri;
  statuses: readonly string[];
  marks: boolean;
}

const STATUS_FILE = ".docs-panel.json";
const READS_FILE = "docs-panel-reads.json";
const TRASH_DIR = ".trash";
const MAX_DEPTH = 12;

export function statusLedger(root: vscode.Uri): LedgerSpec {
  return { store: vscode.Uri.joinPath(root, STATUS_FILE), root, statuses: STATUSES, marks: true };
}

export function readsLedger(workspace: vscode.Uri, root: vscode.Uri): LedgerSpec {
  return {
    store: vscode.Uri.joinPath(workspace, ".vscode", READS_FILE),
    root,
    statuses: READ_STATUSES,
    marks: false
  };
}

export function emptyLedger(): Ledger {
  return { version: 1, files: {}, folders: {}, tags: {} };
}

export function isColor(value: unknown): value is string {
  return COLORS.includes(value as (typeof COLORS)[number]);
}

// A tag is whatever was typed, less the space around it; the same name twice is one tag.
export function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    const name = cleanTag(item);
    if (name && !out.includes(name)) {
      out.push(name);
    }
  }
  return out;
}

export function cleanTag(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TAG) : "";
}

export async function load(spec: LedgerSpec): Promise<Ledger> {
  const ledger = emptyLedger();
  try {
    const bytes = await vscode.workspace.fs.readFile(spec.store);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    for (const [path, value] of Object.entries(objectOf(parsed?.files))) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const raw = value as Record<string, unknown>;
      const entry: Entry = {
        status: spec.statuses.includes(raw.status as string) ? (raw.status as string) : "",
        tags: spec.marks ? cleanTags(raw.tags) : [],
        color: spec.marks && isColor(raw.color) ? raw.color : "",
        hash: typeof raw.hash === "string" ? raw.hash : "",
        size: typeof raw.size === "number" ? raw.size : -1,
        updated: typeof raw.updated === "string" ? raw.updated : ""
      };
      if (!isBlank(entry)) {
        ledger.files[path] = entry;
      }
    }
    if (spec.marks) {
      ledger.folders = marksOf(parsed?.folders, (key) => key);
      ledger.tags = marksOf(parsed?.tags, cleanTag);
      // A tag a file carries is always in the list, so it always has a colour to show.
      for (const entry of Object.values(ledger.files)) {
        for (const tag of entry.tags) {
          defineTag(ledger, tag);
        }
      }
    }
  } catch {
    return emptyLedger();
  }
  return ledger;
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function marksOf(value: unknown, key: (raw: string) => string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const [raw, mark] of Object.entries(objectOf(value))) {
    const name = key(raw);
    const color = (mark as Partial<Mark> | null)?.color;
    if (name && isColor(color)) {
      out[name] = { color };
    }
  }
  return out;
}

export async function save(spec: LedgerSpec, ledger: Ledger): Promise<void> {
  const files: Record<string, object> = {};
  for (const path of Object.keys(ledger.files).sort()) {
    const entry = ledger.files[path];
    files[path] = {
      ...(entry.status ? { status: entry.status } : {}),
      ...(entry.tags.length ? { tags: entry.tags } : {}),
      ...(entry.color ? { color: entry.color } : {}),
      hash: entry.hash,
      size: entry.size,
      updated: entry.updated
    };
  }
  // The marks are written only once there are some, so a ledger that holds statuses alone
  // keeps the shape it always had.
  const out: Record<string, unknown> = { version: ledger.version, files };
  if (spec.marks && Object.keys(ledger.folders).length) {
    out.folders = sorted(ledger.folders);
  }
  if (spec.marks && Object.keys(ledger.tags).length) {
    out.tags = sorted(ledger.tags);
  }
  const text = JSON.stringify(out, null, 2) + "\n";
  const folder = spec.store.with({ path: spec.store.path.split("/").slice(0, -1).join("/") });
  await vscode.workspace.fs.createDirectory(folder);
  await vscode.workspace.fs.writeFile(spec.store, new TextEncoder().encode(text));
}

function sorted<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = record[key];
  }
  return out;
}

function isBlank(entry: Entry): boolean {
  return !entry.status && !entry.tags.length && !entry.color;
}

// Every change to one file's entry goes through here: the entry is fingerprinted again so
// a move made outside the panel can still find it, and one left carrying nothing goes.
async function change(
  spec: LedgerSpec,
  relPath: string,
  edit: (entry: Entry, ledger: Ledger) => void
): Promise<Ledger> {
  const ledger = await load(spec);
  const entry: Entry = ledger.files[relPath] ?? {
    status: "",
    tags: [],
    color: "",
    hash: "",
    size: -1,
    updated: ""
  };
  edit(entry, ledger);
  if (isBlank(entry)) {
    delete ledger.files[relPath];
  } else {
    ledger.files[relPath] = { ...entry, ...(await fingerprint(spec.root, relPath)) };
  }
  await save(spec, ledger);
  return ledger;
}

export function setStatus(
  spec: LedgerSpec,
  relPath: string,
  status: string | null
): Promise<Ledger> {
  return change(spec, relPath, (entry) => {
    entry.status = status ?? "";
  });
}

export function setTags(spec: LedgerSpec, relPath: string, tags: unknown): Promise<Ledger> {
  return change(spec, relPath, (entry, ledger) => {
    entry.tags = cleanTags(tags);
    for (const tag of entry.tags) {
      defineTag(ledger, tag);
    }
  });
}

// A folder has no content to fingerprint, so its colour is kept by path alone.
export async function setColor(
  spec: LedgerSpec,
  relPath: string,
  color: string | null,
  dir: boolean
): Promise<Ledger> {
  if (!dir) {
    return change(spec, relPath, (entry) => {
      entry.color = isColor(color) ? color : "";
    });
  }
  const ledger = await load(spec);
  if (isColor(color)) {
    ledger.folders[relPath] = { color };
  } else {
    delete ledger.folders[relPath];
  }
  await save(spec, ledger);
  return ledger;
}

export async function setTagColor(spec: LedgerSpec, name: string, color: string): Promise<Ledger> {
  const ledger = await load(spec);
  if (ledger.tags[name] && isColor(color)) {
    ledger.tags[name] = { color };
    await save(spec, ledger);
  }
  return ledger;
}

// Renaming onto a tag that already exists merges the two, and the older one's colour wins.
export async function renameTag(spec: LedgerSpec, from: string, to: string): Promise<Ledger> {
  const ledger = await load(spec);
  const name = cleanTag(to);
  if (!name || name === from || !ledger.tags[from]) {
    return ledger;
  }
  for (const entry of Object.values(ledger.files)) {
    if (entry.tags.includes(from)) {
      entry.tags = cleanTags(entry.tags.map((tag) => (tag === from ? name : tag)));
    }
  }
  ledger.tags[name] ??= ledger.tags[from];
  delete ledger.tags[from];
  await save(spec, ledger);
  return ledger;
}

export async function deleteTag(spec: LedgerSpec, name: string): Promise<Ledger> {
  const ledger = await load(spec);
  for (const [path, entry] of Object.entries(ledger.files)) {
    entry.tags = entry.tags.filter((tag) => tag !== name);
    if (isBlank(entry)) {
      delete ledger.files[path];
    }
  }
  delete ledger.tags[name];
  await save(spec, ledger);
  return ledger;
}

// A new tag takes the first colour no other tag has, and once they are all taken the
// list goes round again.
function defineTag(ledger: Ledger, name: string): void {
  if (ledger.tags[name]) {
    return;
  }
  const used = new Set(Object.values(ledger.tags).map((mark) => mark.color));
  const color =
    COLORS.find((value) => !used.has(value)) ??
    COLORS[Object.keys(ledger.tags).length % COLORS.length];
  ledger.tags[name] = { color };
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

// A folder's colour names its path, and so does every folder's below it.
export async function rekeyFolders(spec: LedgerSpec, from: string, to: string): Promise<void> {
  if (!spec.marks) {
    return;
  }
  const ledger = await load(spec);
  const moved = Object.keys(ledger.folders).filter(
    (path) => path === from || path.startsWith(`${from}/`)
  );
  if (!moved.length) {
    return;
  }
  const marks = moved.map((path) => ledger.folders[path]);
  moved.forEach((path) => delete ledger.folders[path]);
  moved.forEach((path, i) => {
    ledger.folders[to + path.slice(from.length)] = marks[i];
  });
  await save(spec, ledger);
}

// Files can also be moved from outside this panel. An entry whose path is gone is matched
// against the paths that appeared, by content first and by name second, so a rename keeps
// its status and two files sharing a name cannot be confused for one another. A folder
// has nothing to match by, so one that is gone takes its colour with it.
export async function prune(spec: LedgerSpec): Promise<Ledger> {
  const ledger = await load(spec);
  const { files: present, folders } = await listTree(spec.root);

  let changed = false;
  for (const path of Object.keys(ledger.folders)) {
    if (!folders.has(path)) {
      delete ledger.folders[path];
      changed = true;
    }
  }

  const missing = Object.keys(ledger.files).filter((path) => !present.has(path));
  if (missing.length === 0) {
    if (changed) {
      await save(spec, ledger);
    }
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

export async function listFiles(root: vscode.Uri): Promise<Set<string>> {
  return (await listTree(root)).files;
}

// Unlike the tree walk this one descends into the trash, because a trashed file keeps
// its ledger entry and must still count as present.
export async function listTree(
  root: vscode.Uri
): Promise<{ files: Set<string>; folders: Set<string> }> {
  const found = { files: new Set<string>(), folders: new Set<string>() };
  await walk(root, "", 0, found);
  return found;
}

async function walk(
  uri: vscode.Uri,
  prefix: string,
  depth: number,
  found: { files: Set<string>; folders: Set<string> }
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
      found.folders.add(path);
      await walk(vscode.Uri.joinPath(uri, name), path, depth + 1, found);
    } else if (type & vscode.FileType.File) {
      found.files.add(path);
    }
  }
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
