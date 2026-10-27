import * as vscode from "vscode";
import { createHash } from "crypto";

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

// A tag's pill has black text whatever the theme, so its colours are the panel's own: light
// enough for black to read on at 7:1 or better, and far enough apart to tell from one
// another. A new tag takes the next one in this order, which keeps neighbours unalike.
export const TAG_COLORS = [
  "red",
  "yellow",
  "blue",
  "green",
  "purple",
  "orange",
  "cyan",
  "pink",
  "lime",
  "brown",
  "teal",
  "magenta",
  "sky",
  "amber",
  "mint",
  "coral",
  "lavender",
  "olive",
  "peach",
  "sand",
  "grey",
  "silver"
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
  // A tag's letters, shown in place of its name where the name does not fit.
  short?: string;
}

// How a tag's pill is drawn, beyond its colour. Only a tag has these, never a folder.
export interface TagStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  white?: boolean;
  square?: boolean;
  // One or two characters the name is put between: "[]" draws "[plan]".
  wrap?: string;
}

export type TagMark = Mark & TagStyle;

const STYLE_FLAGS = ["bold", "italic", "underline", "white", "square"] as const;

export interface Ledger {
  version: number;
  files: Record<string, Entry>;
  folders: Record<string, Mark>;
  tags: Record<string, TagMark>;
  // Every tag, in the order it is listed wherever tags are listed.
  tagOrder: string[];
}

// Two ledgers share every operation below; only the file they live in, the values they
// accept, and the meaning of an entry differ. The reads ledger holds a status per file;
// the marks ledger holds tags and colours, which travel with the documents.
export interface LedgerSpec {
  store: vscode.Uri;
  root: vscode.Uri;
  statuses: readonly string[];
  marks: boolean;
  // The folders under the root, by their path from it, that hold the files it keys; none
  // means the whole root.
  dirs?: string[];
}

export const MARKS_FILE = ".docs-panel.json";
const READS_FILE = "docs-panel-reads.json";
// The reads ledger keyed every file by its path from the one docs folder there was; since
// there can be several, it keys them by their path from the workspace.
const READS_VERSION = 2;
const TRASH_DIR = ".trash";
const MAX_DEPTH = 12;

export function marksLedger(root: vscode.Uri): LedgerSpec {
  return { store: vscode.Uri.joinPath(root, MARKS_FILE), root, statuses: [], marks: true };
}

// "dirs" are the docs folders, by their path from the workspace, "" for the workspace itself.
export function readsLedger(workspace: vscode.Uri, dirs: string[]): LedgerSpec {
  return {
    store: vscode.Uri.joinPath(workspace, ".vscode", READS_FILE),
    root: workspace,
    statuses: READ_STATUSES,
    marks: false,
    dirs: dirs.includes("") ? undefined : dirs
  };
}

// A reads ledger written before there could be several docs folders keys its files from
// the one there was; "prefix" is that folder's path from the workspace, and each key is
// put behind it once. A ledger already keyed from the workspace is left alone.
export async function rebaseReads(spec: LedgerSpec, prefix: string): Promise<void> {
  let version: unknown;
  try {
    version = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(spec.store)))?.version;
  } catch {
    return;
  }
  if (typeof version === "number" && version >= READS_VERSION) {
    return;
  }
  const ledger = await load(spec);
  if (prefix) {
    const files: Record<string, Entry> = {};
    for (const [path, entry] of Object.entries(ledger.files)) {
      files[`${prefix}/${path}`] = entry;
    }
    ledger.files = files;
  }
  await save(spec, ledger);
}

export function emptyLedger(): Ledger {
  return { version: 1, files: {}, folders: {}, tags: {}, tagOrder: [] };
}

export function isColor(value: unknown): value is string {
  return COLORS.includes(value as (typeof COLORS)[number]);
}

export function isTagColor(value: unknown): value is string {
  return TAG_COLORS.includes(value as (typeof TAG_COLORS)[number]);
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
      ledger.folders = marksOf(parsed?.folders, (key) => key, isColor);
      ledger.tags = marksOf(parsed?.tags, cleanTag, isTagColor);
      for (const [raw, mark] of Object.entries(objectOf(parsed?.tags))) {
        const name = cleanTag(raw);
        if (ledger.tags[name]) {
          ledger.tags[name] = { ...ledger.tags[name], ...styleOf(mark) };
        }
      }
      ledger.tagOrder = Array.isArray(parsed?.tagOrder) ? parsed.tagOrder.map(cleanTag) : [];
      shortenTags(ledger);
      // A tag a file carries is always in the list, so it always has a colour to show.
      for (const entry of Object.values(ledger.files)) {
        for (const tag of entry.tags) {
          defineTag(ledger, tag);
        }
      }
      orderTags(ledger);
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

function marksOf(
  value: unknown,
  key: (raw: string) => string,
  valid: (color: unknown) => color is string
): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const [raw, mark] of Object.entries(objectOf(value))) {
    const name = key(raw);
    const color = (mark as Partial<Mark> | null)?.color;
    const short = (mark as Partial<Mark> | null)?.short;
    if (name && valid(color)) {
      out[name] = typeof short === "string" && short.trim() ? { color, short: short.trim() } : { color };
    }
  }
  return out;
}

// Only what is set is kept, so a tag drawn plainly is written as it always was.
export function styleOf(value: unknown): TagStyle {
  const raw = objectOf(value);
  const out: TagStyle = {};
  for (const flag of STYLE_FLAGS) {
    if (raw[flag] === true) {
      out[flag] = true;
    }
  }
  const wrap = typeof raw.wrap === "string" ? Array.from(raw.wrap.replace(/\s+/g, "")).slice(0, 2).join("") : "";
  if (wrap) {
    out.wrap = wrap;
  }
  return out;
}

// The order kept names each tag once; a tag it does not name, from an older ledger or one
// edited by hand, goes after the rest, by name.
function orderTags(ledger: Ledger): void {
  const seen = new Set<string>();
  const order = ledger.tagOrder.filter((name) => {
    const keep = !!ledger.tags[name] && !seen.has(name);
    seen.add(name);
    return keep;
  });
  const rest = Object.keys(ledger.tags)
    .filter((name) => !seen.has(name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  ledger.tagOrder = [...order, ...rest];
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
  // The marks are written only once there are some, so the reads ledger keeps the shape it
  // always had.
  const out: Record<string, unknown> = { version: spec.marks ? ledger.version : READS_VERSION, files };
  if (spec.marks && Object.keys(ledger.folders).length) {
    out.folders = sorted(ledger.folders);
  }
  if (spec.marks && Object.keys(ledger.tags).length) {
    out.tags = sorted(ledger.tags);
    orderTags(ledger);
    out.tagOrder = ledger.tagOrder;
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

// "known" are the tags as the panel shows them, from every docs folder's ledger: a tag new
// to this one takes the colour, letters and style it already has elsewhere.
export function setTags(
  spec: LedgerSpec,
  relPath: string,
  tags: unknown,
  known: Record<string, TagMark> = {}
): Promise<Ledger> {
  return change(spec, relPath, (entry, ledger) => {
    entry.tags = cleanTags(tags);
    for (const tag of entry.tags) {
      defineTag(ledger, tag, known[tag]);
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
  if (ledger.tags[name] && isTagColor(color)) {
    ledger.tags[name] = { ...ledger.tags[name], color };
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
  const mark = ledger.tags[from];
  delete ledger.tags[from];
  // A new name is a new tag to tell apart, so it is given letters of its own. It keeps the
  // old one's place in the order, unless it merges into a tag that has a place already.
  const merged = !!ledger.tags[name];
  ledger.tags[name] ??= { ...mark, short: abbreviate(name, takenShorts(ledger)) };
  ledger.tagOrder = merged
    ? ledger.tagOrder.filter((tag) => tag !== from)
    : ledger.tagOrder.map((tag) => (tag === from ? name : tag));
  await save(spec, ledger);
  return ledger;
}

export async function setTagStyle(spec: LedgerSpec, name: string, style: unknown): Promise<Ledger> {
  const ledger = await load(spec);
  const mark = ledger.tags[name];
  if (mark) {
    ledger.tags[name] = { color: mark.color, ...(mark.short ? { short: mark.short } : {}), ...styleOf(style) };
    await save(spec, ledger);
  }
  return ledger;
}

// The names in the order given; any tag left out keeps its place after them.
export async function setTagOrder(spec: LedgerSpec, names: unknown): Promise<Ledger> {
  const ledger = await load(spec);
  if (Array.isArray(names)) {
    ledger.tagOrder = [...names.map(cleanTag), ...ledger.tagOrder];
    orderTags(ledger);
    await save(spec, ledger);
  }
  return ledger;
}

export const MAX_SHORT = 8;

// The tag, other than "name", whose letters these already are, if any.
export function shortOwner(ledger: Ledger, name: string, short: string): string | undefined {
  const lower = short.trim().toLowerCase();
  return Object.keys(ledger.tags).find(
    (other) => other !== name && ledger.tags[other].short?.toLowerCase() === lower
  );
}

// Letters chosen by hand, kept only while no other tag has them.
export async function setTagShort(spec: LedgerSpec, name: string, short: string): Promise<Ledger> {
  const ledger = await load(spec);
  const value = short.replace(/\s+/g, "").slice(0, MAX_SHORT);
  if (ledger.tags[name] && value && !shortOwner(ledger, name, value)) {
    ledger.tags[name] = { ...ledger.tags[name], short: value };
    await save(spec, ledger);
  }
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
  ledger.tagOrder = ledger.tagOrder.filter((tag) => tag !== name);
  await save(spec, ledger);
  return ledger;
}

// A tag kept for its colour alone, on no file any more, goes; the names in the list are
// then exactly the tags in use.
// "used" are the tags on a file in any docs folder, when there are several: a tag on none
// of this one's files is still in use while another's file has it.
export async function pruneTags(
  spec: LedgerSpec,
  used?: Set<string>
): Promise<{ ledger: Ledger; pruned: string[] }> {
  const ledger = await load(spec);
  used ??= usedTags(ledger);
  const pruned = Object.keys(ledger.tags).filter((name) => !used.has(name));
  for (const name of pruned) {
    delete ledger.tags[name];
  }
  ledger.tagOrder = ledger.tagOrder.filter((tag) => !pruned.includes(tag));
  if (pruned.length) {
    await save(spec, ledger);
  }
  return { ledger, pruned };
}

export function usedTags(ledger: Ledger): Set<string> {
  return new Set(Object.values(ledger.files).flatMap((entry) => entry.tags));
}

// A new tag takes the first colour no other tag has, and once they are all taken the
// list goes round again; one known from another ledger comes as it is there.
function defineTag(ledger: Ledger, name: string, known?: TagMark): void {
  if (ledger.tags[name]) {
    return;
  }
  if (known) {
    ledger.tags[name] = { ...known };
    ledger.tagOrder.push(name);
    return;
  }
  const used = new Set(Object.values(ledger.tags).map((mark) => mark.color));
  const color =
    TAG_COLORS.find((value) => !used.has(value)) ??
    TAG_COLORS[Object.keys(ledger.tags).length % TAG_COLORS.length];
  ledger.tags[name] = { color, short: abbreviate(name, takenShorts(ledger)) };
  // A new tag goes to the end of the list, where the one making it can see it arrive.
  ledger.tagOrder.push(name);
}

function takenShorts(ledger: Ledger): Set<string> {
  return new Set(
    Object.values(ledger.tags).flatMap((mark) => (mark.short ? [mark.short.toLowerCase()] : []))
  );
}

// A ledger written before tags had letters, or edited by hand, can hold tags with none or
// with letters another tag has too. The first of each kept, by name, keeps them; the rest
// are given new ones, once, and keep those from the next save on.
function shortenTags(ledger: Ledger): void {
  const taken = new Set<string>();
  const names = Object.keys(ledger.tags).sort((a, b) => a.localeCompare(b));
  const needing: string[] = [];
  for (const name of names) {
    const short = ledger.tags[name].short?.toLowerCase();
    if (short && !taken.has(short)) {
      taken.add(short);
    } else {
      needing.push(name);
    }
  }
  for (const name of needing) {
    const short = abbreviate(name, taken);
    taken.add(short.toLowerCase());
    ledger.tags[name] = { ...ledger.tags[name], short };
  }
}

// The first letter of each word, a word ending at a space, a dash, an underscore, a dot or
// a slash: "plan" is "p", "to do" is "td". Letters another tag already has, in either
// case, are lengthened from the words in turn, the first word first: "priority" next to
// "plan" is "pr", "to do" next to "td" is "tod". A name that runs out of letters is
// numbered.
export function abbreviate(name: string, taken: Set<string>): string {
  const words = name.split(/[\s\-_./]+/).filter(Boolean).map((word) => Array.from(word));
  if (!words.length) {
    words.push(Array.from(name));
  }
  const counts = words.map(() => 1);
  const letters = () => words.map((word, i) => word.slice(0, counts[i]).join("")).join("");
  const free = (value: string) => !taken.has(value.toLowerCase());
  for (;;) {
    const value = letters();
    if (free(value)) {
      return value;
    }
    const grow = counts.findIndex((count, i) => count < words[i].length);
    if (grow < 0) {
      break;
    }
    counts[grow] += 1;
  }
  const base = letters();
  for (let n = 2; ; n++) {
    if (free(base + n)) {
      return base + n;
    }
  }
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

// A move from one docs folder to another takes the entries out of the first one's ledger
// and puts them in the second's, under the paths they now have there, with the tags they
// carry. "moves" pairs each file's old path with its new one; "folder", when a folder
// moved, pairs its old path with its new one, for its colour and those below it.
export async function carry(
  from: LedgerSpec,
  to: LedgerSpec,
  moves: [string, string][],
  folder?: [string, string]
): Promise<void> {
  const source = await load(from);
  const target = await load(to);
  let changed = false;
  for (const [old, next] of moves) {
    const entry = source.files[old];
    if (!entry) {
      continue;
    }
    delete source.files[old];
    for (const tag of entry.tags) {
      defineTag(target, tag, source.tags[tag]);
    }
    target.files[next] = { ...entry, ...(await fingerprint(to.root, next)) };
    changed = true;
  }
  if (folder && from.marks) {
    const [old, next] = folder;
    for (const path of Object.keys(source.folders)) {
      if (path === old || path.startsWith(`${old}/`)) {
        target.folders[next + path.slice(old.length)] = source.folders[path];
        delete source.folders[path];
        changed = true;
      }
    }
  }
  if (changed) {
    await save(from, source);
    await save(to, target);
  }
}

// The marks of several docs folders, shown as one: each file and folder by its path from
// the workspace, "prefixes" giving each ledger's folder from there, "" for the workspace.
// A tag defined in more than one is drawn as the first of them has it, and listed in the
// first one's order, then in the next one's, and so on.
export function mergeMarks(ledgers: Ledger[], prefixes: string[]): Ledger {
  if (ledgers.length === 1 && !prefixes[0]) {
    return ledgers[0];
  }
  const out = emptyLedger();
  const join = (prefix: string, path: string) => (prefix ? `${prefix}/${path}` : path);
  ledgers.forEach((ledger, i) => {
    for (const [path, entry] of Object.entries(ledger.files)) {
      out.files[join(prefixes[i], path)] = entry;
    }
    for (const [path, mark] of Object.entries(ledger.folders)) {
      out.folders[join(prefixes[i], path)] = mark;
    }
    for (const [name, mark] of Object.entries(ledger.tags)) {
      out.tags[name] ??= mark;
    }
    out.tagOrder.push(...ledger.tagOrder);
  });
  shortenTags(out);
  orderTags(out);
  return out;
}

// Files can also be moved from outside this panel. An entry whose path is gone is matched
// against the paths that appeared, by content first and by name second, so a rename keeps
// its marks and two files sharing a name cannot be confused for one another. A folder
// has nothing to match by, so one that is gone takes its colour with it.
export async function prune(spec: LedgerSpec): Promise<Ledger> {
  const ledger = await load(spec);
  const { files: present, folders } = await listTree(spec.root, spec.dirs);

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
  const freshHashes = new Map<string, string>(
    await Promise.all(fresh.map(async (path) => [path, (await fingerprint(spec.root, path)).hash] as [string, string]))
  );

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
  root: vscode.Uri,
  dirs?: string[]
): Promise<{ files: Set<string>; folders: Set<string> }> {
  const found = { files: new Set<string>(), folders: new Set<string>() };
  if (!dirs) {
    await walk(root, "", 0, found);
  } else {
    await Promise.all(dirs.map((dir) => walk(vscode.Uri.joinPath(root, ...dir.split("/")), dir, 0, found)));
  }
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
  // The folders below are read at once rather than one after another.
  const below: Promise<void>[] = [];
  for (const [name, type] of entries) {
    if (name === "node_modules" || (name.startsWith(".") && name !== TRASH_DIR)) {
      continue;
    }
    const path = prefix ? `${prefix}/${name}` : name;
    if (type & vscode.FileType.Directory) {
      found.folders.add(path);
      below.push(walk(vscode.Uri.joinPath(uri, name), path, depth + 1, found));
    } else if (type & vscode.FileType.File) {
      found.files.add(path);
    }
  }
  await Promise.all(below);
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
