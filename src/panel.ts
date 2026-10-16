import * as vscode from "vscode";
import { buildTree, TreeNode } from "./tree";
import { renderFile, escapeHtml } from "./render";
import { watchRoot } from "./watch";
import {
  cleanTag,
  deleteTag,
  invalidate,
  isColor,
  listFiles,
  load,
  prune,
  readsLedger,
  rekey,
  rekeyFolders,
  renameTag,
  setColor,
  setStatus,
  setTagColor,
  setTags,
  marksLedger,
  Ledger,
  LedgerSpec,
  READ
} from "./ledger";
import { cacheUri, match, refresh, sessionsDir } from "./mentions";
import { openInBrowser } from "./browser";
import { Corpus } from "./corpus";

export const VIEW_TYPE = "docsPanel";
export const TRASH_DIR = ".trash";
const SESSION_DEBOUNCE_MS = 500;

// Which of the side's two lists, if either, is given the height its entries need.
export type AutoSize = "none" | "tree" | "toc";
const AUTO_SIZES: AutoSize[] = ["none", "tree", "toc"];

// Which side of a file's name its tags are drawn on in the tree.
export type TagSide = "left" | "right";
const TAG_SIDES: TagSide[] = ["left", "right"];

export interface PanelState {
  split: number;
  sideSplit: number;
  textScale: number;
  lineHeight: number;
  mono: boolean;
  autoSize: AutoSize;
  autoWidth: boolean;
  tagSide: TagSide;
  hoverStrength: number;
  expanded: string[];
  pinned: string[];
  selected: string | null;
}

const DEFAULT_STATE: PanelState = {
  split: 240,
  sideSplit: 0.5,
  textScale: 1,
  lineHeight: 1,
  mono: false,
  autoSize: "none",
  autoWidth: false,
  tagSide: "right",
  hoverStrength: 40,
  expanded: [],
  pinned: [],
  selected: null
};

const TRASH_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9h6.6l.7-9M6.6 6.5v4M9.4 6.5v4"/></svg>`;

const RESTORE_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"
d="M3 8a5 5 0 1 1 1.6 3.7M3 4.5V8h3.5"/></svg>`;

const TAG_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"
d="M2.5 2.5h5l6 6-5 5-6-6z"/>
<circle cx="5.2" cy="5.2" r="1" fill="currentColor"/></svg>`;

const PEN_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"
d="M11.2 2.6l2.2 2.2-8 8-2.9.7.7-2.9zM10 3.8l2.2 2.2"/></svg>`;

const GLASS_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" stroke-width="1.2"/>
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" d="M10.2 10.2 13.5 13.5"/></svg>`;

const DOCS_SEARCH_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
d="M2 3.5h8M2 6.5h4.5M2 9.5h3M12.3 12.3l1.9 1.9"/>
<circle cx="10.2" cy="10.2" r="2.9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

const SLIDERS_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
d="M2.5 4.5h2M7.5 4.5h6M2.5 11.5h6M11.5 11.5h2"/>
<circle cx="6" cy="4.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
<circle cx="10" cy="11.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

const ADD_TAG_ICON = `<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M5 1.5v7M1.5 5h7"/></svg>`;

const EYE_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"
d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8z"/>
<circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

interface DataFile {
  id: string;
  label: string;
  note: string;
  uri: vscode.Uri;
}

interface Root {
  uri: vscode.Uri;
  workspace: vscode.Uri;
  label: string;
}

export class DocsPanel {
  private static current: DocsPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private watcher: vscode.Disposable | undefined;
  private sessions: vscode.Disposable | undefined;
  private sessionsTimer: NodeJS.Timeout | undefined;
  private root: Root | undefined;
  private state: PanelState;
  private ready = false;
  private readonly corpus = new Corpus();

  static open(context: vscode.ExtensionContext): void {
    if (DocsPanel.current) {
      DocsPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      "Docs",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DocsPanel.current = new DocsPanel(panel, context, DEFAULT_STATE);
  }

  static restore(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    state: unknown
  ): void {
    DocsPanel.current?.panel.dispose();
    DocsPanel.current = new DocsPanel(panel, context, normalizeState(state));
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    state: PanelState
  ) {
    this.state = state;
    this.root = resolveRoot();

    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots()
    };
    this.panel.webview.html = this.html();

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage((message) => this.onMessage(message))
    );
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("docsPanel.folder")) {
          this.reroot();
        }
        if (event.affectsConfiguration("docsPanel.copyPrefix")) {
          this.sendPrefixes();
        }
      })
    );
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.reroot())
    );

    this.panel.onDidDispose(() => this.dispose());
    this.startWatcher();
    this.startSessionWatcher();
  }

  private get base(): vscode.Uri | undefined {
    return this.root?.uri;
  }

  private get ledgers(): LedgerSpec[] {
    return this.root ? [marksLedger(this.root.uri), readsLedger(this.root.workspace, this.root.uri)] : [];
  }

  private resourceRoots(): vscode.Uri[] {
    const roots = [vscode.Uri.joinPath(this.context.extensionUri, "media")];
    if (this.root) {
      roots.push(this.root.uri);
    }
    return roots;
  }

  private reroot(): void {
    this.root = resolveRoot();
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots()
    };
    this.startWatcher();
    this.startSessionWatcher();
    void this.sendTree();
    if (this.state.selected) {
      void this.sendContent(this.state.selected);
    }
  }

  private startWatcher(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
    const base = this.base;
    if (!base) {
      return;
    }
    this.watcher = watchRoot(base, {
      onTreeChange: () => void this.sendTree(),
      onFileChange: (path) => {
        if (path === this.state.selected) {
          void this.markRead(path);
          void this.sendContent(path);
        } else {
          void this.unread(path);
        }
      }
    });
  }

  // A live session appends to its log constantly, so the writes are let settle before the
  // scan: the pass itself is cheap, but it is worth nothing until a line is complete.
  private startSessionWatcher(): void {
    this.sessions?.dispose();
    this.sessions = undefined;
    if (!this.root) {
      return;
    }
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(sessionsDir(this.root.workspace)), "*.jsonl")
    );
    const schedule = () => {
      if (this.sessionsTimer) {
        clearTimeout(this.sessionsTimer);
      }
      this.sessionsTimer = setTimeout(() => void this.sendMentions(), SESSION_DEBOUNCE_MS);
    };
    watcher.onDidCreate(schedule);
    watcher.onDidChange(schedule);
    watcher.onDidDelete(schedule);
    this.sessions = watcher;
  }

  // Extensions are lower-cased on the way out so the setting can be written either way.
  private sendPrefixes(): void {
    const setting = vscode.workspace
      .getConfiguration("docsPanel", this.root?.workspace)
      .get<Record<string, unknown>>("copyPrefix", {});
    const prefixes: Record<string, string> = {};
    for (const [type, value] of Object.entries(setting ?? {})) {
      if (typeof value === "string") {
        prefixes[type.replace(/^\./, "").toLowerCase()] = value;
      }
    }
    this.post({ type: "prefixes", prefixes });
  }

  private async sendMentions(): Promise<void> {
    if (!this.ready || !this.root) {
      return;
    }
    const hits = await refresh(this.root.workspace);
    this.post({ type: "mentions", mentions: match(hits, await listFiles(this.root.uri)) });
  }

  private async onMessage(message: any): Promise<void> {
    switch (message?.type) {
      case "ready":
        this.ready = true;
        this.post({ type: "state", ...this.state });
        this.post({ type: "version", version: String(this.context.extension.packageJSON.version ?? "") });
        this.sendPrefixes();
        await this.sendTree();
        if (this.state.selected) {
          await this.sendContent(this.state.selected);
        }
        return;
      case "open":
        this.state.selected = String(message.path);
        await this.markRead(this.state.selected);
        await this.sendContent(this.state.selected);
        return;
      case "persist":
        this.state = normalizeState(message);
        return;
      case "save":
        await this.save(String(message.path), String(message.text));
        return;
      case "rename":
        await this.rename(String(message.path));
        return;
      case "trash":
        await this.move(String(message.path), "trash", !!message.dir);
        return;
      case "restore":
        await this.move(String(message.path), "restore", !!message.dir);
        return;
      case "delete":
        await this.remove(String(message.path), !!message.dir);
        return;
      case "restoreAll":
        await this.restoreAll(String(message.at ?? ""));
        return;
      case "emptyTrash":
        await this.emptyTrash(String(message.at ?? ""));
        return;
      case "create":
        await this.create(message.kind === "folder" ? "folder" : "file", String(message.at ?? ""));
        return;
      case "clone":
        await this.clone(String(message.path), !!message.dir);
        return;
      case "relocate":
        await this.relocate(String(message.from), String(message.to), !!message.dir);
        return;
      case "reveal":
        await this.reveal(String(message.path));
        return;
      case "tags":
        await this.tags(String(message.path), message.tags);
        return;
      case "color":
        await this.color(String(message.path), message.color, !!message.dir);
        return;
      case "tagColor":
        await this.tagColor(String(message.name), message.color);
        return;
      case "renameTag":
        await this.renameTag(String(message.name));
        return;
      case "deleteTag":
        await this.deleteTag(String(message.name));
        return;
      case "browser":
        await this.browse(String(message.path));
        return;
      case "corpus":
        await this.sendCorpus();
        return;
      case "dataFiles":
        await this.sendDataFiles();
        return;
      case "purge":
        await this.purge(Array.isArray(message.ids) ? message.ids.map(String) : []);
        return;
      case "settings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "docsPanel");
        return;
    }
  }

  private async tags(relPath: string, value: unknown): Promise<void> {
    if (!this.root || !Array.isArray(value)) {
      return;
    }
    this.postMarks(await setTags(marksLedger(this.root.uri), relPath, value));
  }

  private async color(relPath: string, value: unknown, dir: boolean): Promise<void> {
    if (!this.root) {
      return;
    }
    const color = isColor(value) ? value : null;
    this.postMarks(await setColor(marksLedger(this.root.uri), relPath, color, dir));
  }

  private async tagColor(name: string, value: unknown): Promise<void> {
    if (!this.root || !isColor(value)) {
      return;
    }
    this.postMarks(await setTagColor(marksLedger(this.root.uri), name, value));
  }

  private async renameTag(name: string): Promise<void> {
    if (!this.root) {
      return;
    }
    const next = await vscode.window.showInputBox({
      title: `Rename the tag ${name}`,
      value: name,
      validateInput: (value) => (cleanTag(value) ? null : "The name cannot be empty.")
    });
    if (next === undefined || cleanTag(next) === name) {
      return;
    }
    this.postMarks(await renameTag(marksLedger(this.root.uri), name, next));
  }

  private async deleteTag(name: string): Promise<void> {
    if (!this.root) {
      return;
    }
    const spec = marksLedger(this.root.uri);
    const used = Object.values((await load(spec)).files).filter((entry) =>
      entry.tags.includes(name)
    ).length;
    if (used) {
      const answer = await vscode.window.showWarningMessage(
        `Delete the tag ${name}?`,
        { modal: true, detail: `It comes off ${used} ${used === 1 ? "file" : "files"}.` },
        "Delete"
      );
      if (answer !== "Delete") {
        return;
      }
    }
    this.postMarks(await deleteTag(spec, name));
  }

  // One message carries everything the marks ledger holds, since the tree draws it all
  // at once: a file's tags and colour, a folder's colour, and each tag's colour.
  private postMarks(ledger: Ledger): void {
    const tags: Record<string, string[]> = {};
    const colors: Record<string, string> = {};
    for (const [path, entry] of Object.entries(ledger.files)) {
      if (entry.tags.length) {
        tags[path] = entry.tags;
      }
      if (entry.color) {
        colors[path] = entry.color;
      }
    }
    for (const [path, mark] of Object.entries(ledger.folders)) {
      colors[path] = mark.color;
    }
    const tagColors: Record<string, string> = {};
    for (const [name, mark] of Object.entries(ledger.tags)) {
      tagColors[name] = mark.color;
    }
    this.post({ type: "marks", tags, colors, tagColors });
  }

  private postReads(ledger: Ledger): void {
    this.post({ type: "reads", reads: Object.keys(ledger.files) });
  }

  private async markRead(relPath: string): Promise<void> {
    if (!this.root) {
      return;
    }
    this.postReads(
      await setStatus(readsLedger(this.root.workspace, this.root.uri), relPath, READ)
    );
  }

  // A file edited behind the panel's back is no longer the one that was read. The open
  // file is exempt: it is on screen, so the change is being watched as it happens.
  private async unread(relPath: string): Promise<void> {
    if (!this.root) {
      return;
    }
    const ledger = await invalidate(readsLedger(this.root.workspace, this.root.uri), relPath);
    if (ledger) {
      this.postReads(ledger);
    }
  }

  private async save(relPath: string, text: string): Promise<void> {
    const base = this.base;
    if (!base) {
      return;
    }
    const uri = vscode.Uri.joinPath(base, ...relPath.split("/"));
    try {
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
      this.post({ type: "saved", path: relPath });
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not save ${relPath}: ${error}`);
    }
  }

  // The file keeps its folder: only the name is asked for, so a rename cannot move a file.
  private async rename(relPath: string): Promise<void> {
    const base = this.base;
    if (!base || !this.root) {
      return;
    }
    const parts = relPath.split("/");
    const name = parts.pop() ?? relPath;
    const dot = name.lastIndexOf(".");

    const next = await vscode.window.showInputBox({
      title: "Rename",
      value: name,
      valueSelection: dot > 0 ? [0, dot] : undefined,
      validateInput: checkName
    });
    const target = next?.trim();
    if (!target || target === name) {
      return;
    }

    const folder = parts.length ? vscode.Uri.joinPath(base, ...parts) : base;
    const to = vscode.Uri.joinPath(folder, target);
    const toPath = [...parts, target].join("/");
    try {
      await vscode.workspace.fs.stat(to);
      void vscode.window.showErrorMessage(`Docs Panel: ${toPath} already exists.`);
      return;
    } catch {
      // Nothing there, so the name is free.
    }

    try {
      await vscode.workspace.fs.rename(
        vscode.Uri.joinPath(base, ...relPath.split("/")),
        to,
        { overwrite: false }
      );
      for (const spec of this.ledgers) {
        await rekey(spec, relPath, toPath);
        for (const inner of await listFiles(to)) {
          await rekey(spec, `${relPath}/${inner}`, `${toPath}/${inner}`);
        }
        await rekeyFolders(spec, relPath, toPath);
      }
      this.repin(relPath, toPath);
      // Renaming a folder from the tree leaves the reading pane alone unless the open
      // file was inside it, in which case its path is gone and the pane is cleared.
      const reopen = this.state.selected === relPath;
      if (reopen) {
        this.state.selected = toPath;
        this.post({ type: "renamed", from: relPath, to: toPath });
      } else {
        this.dropSelection(relPath);
      }
      await this.sendTree();
      if (reopen) {
        await this.sendContent(toPath);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not rename ${relPath}: ${error}`);
    }
  }

  // The trash is a folder like any other, so a move is only the prefix going on or off.
  // A file comes back from a folder's own .trash the same way, to the folder holding it.
  private async shift(relPath: string, direction: "trash" | "restore"): Promise<void> {
    const root = this.root!.uri;
    const parts = (direction === "restore" ? untrash(relPath) : relPath).split("/");
    const name = parts.pop() ?? relPath;
    const anchor = direction === "trash" ? vscode.Uri.joinPath(root, TRASH_DIR) : root;

    const target = await makeDirectory(anchor, parts);
    const to = await freeName(target, name);
    await vscode.workspace.fs.rename(
      vscode.Uri.joinPath(root, ...relPath.split("/")),
      to,
      { overwrite: false }
    );
    for (const spec of this.ledgers) {
      await rekey(spec, relPath, relativeTo(root, to));
    }
  }

  // A folder cannot be trashed whole: every file in it is moved on its own so each keeps
  // its ledger entry, and only the emptied shell is deleted.
  private async move(
    relPath: string,
    direction: "trash" | "restore",
    dir: boolean
  ): Promise<void> {
    const root = this.root?.uri;
    if (!root || isTrashed(relPath) !== (direction === "restore")) {
      return;
    }
    try {
      await this.transfer(relPath, direction, dir);
      this.dropSelection(relPath);
      await this.sendTree();
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not ${direction} ${relPath}: ${error}`);
    }
  }

  private async transfer(
    relPath: string,
    direction: "trash" | "restore",
    dir: boolean
  ): Promise<void> {
    const root = this.root!.uri;
    if (!dir) {
      await this.shift(relPath, direction);
      return;
    }
    const uri = vscode.Uri.joinPath(root, ...relPath.split("/"));
    for (const inner of await listFiles(uri)) {
      await this.shift(`${relPath}/${inner}`, direction);
    }
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    // The files land at the same path on the other side of the trash, and the
    // folders they make there answer to the colours the originals had.
    const to = direction === "trash" ? `${TRASH_DIR}/${relPath}` : untrash(relPath);
    for (const spec of this.ledgers) {
      await rekeyFolders(spec, relPath, to);
    }
  }

  // "at" names a bin: the folder its files were trashed from, and "" for the whole trash.
  // A folder's bin is its part of the trash and, when it has one, its own .trash too.
  private async binEntries(at: string): Promise<{ bin: string; entries: [string, boolean][] }[]> {
    const bins = at ? [`${TRASH_DIR}/${at}`, `${at}/${TRASH_DIR}`] : [TRASH_DIR];
    const out = [];
    for (const bin of bins) {
      try {
        const listed = await vscode.workspace.fs.readDirectory(
          vscode.Uri.joinPath(this.root!.uri, ...bin.split("/"))
        );
        out.push({
          bin,
          entries: listed.map(([name, type]): [string, boolean] => [
            name,
            (type & vscode.FileType.Directory) !== 0
          ])
        });
      } catch {
        // No such bin.
      }
    }
    return out;
  }

  // Everything in a bin goes back where it came from, and a folder's bin, emptied, goes
  // with it; the trash itself stays for the next file.
  private async restoreAll(at: string): Promise<void> {
    if (!this.root) {
      return;
    }
    for (const { bin, entries } of await this.binEntries(at)) {
      try {
        for (const [name, dir] of entries) {
          await this.transfer(`${bin}/${name}`, "restore", dir);
        }
        if (at) {
          await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.root.uri, ...bin.split("/")), {
            recursive: true,
            useTrash: false
          });
        }
      } catch (error) {
        void vscode.window.showErrorMessage(`Docs Panel could not restore ${bin}: ${error}`);
      }
      this.dropSelection(bin);
    }
    await this.sendTree();
  }

  private async emptyTrash(at: string): Promise<void> {
    if (!this.root) {
      return;
    }
    const bins = (await this.binEntries(at)).filter(({ entries }) => entries.length);
    if (!bins.length) {
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      at ? `Delete everything trashed from ${at} for good?` : "Delete everything in the trash for good?",
      { modal: true, detail: "This cannot be undone." },
      "Delete all"
    );
    if (answer !== "Delete all") {
      return;
    }
    for (const { bin, entries } of bins) {
      try {
        const target = at ? [bin] : entries.map(([name]) => `${bin}/${name}`);
        for (const path of target) {
          await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.root.uri, ...path.split("/")), {
            recursive: true,
            useTrash: false
          });
        }
      } catch (error) {
        void vscode.window.showErrorMessage(`Docs Panel could not empty ${bin}: ${error}`);
      }
      this.dropSelection(bin);
    }
    await this.sendTree();
  }

  private async remove(relPath: string, dir: boolean): Promise<void> {
    const root = this.root?.uri;
    if (!root) {
      return;
    }
    const name = relPath.split("/").pop() ?? relPath;
    const answer = await vscode.window.showWarningMessage(
      `Delete ${name} for good?`,
      { modal: true, detail: dir ? "The folder and everything in it goes." : "This cannot be undone." },
      "Delete"
    );
    if (answer !== "Delete") {
      return;
    }
    try {
      await vscode.workspace.fs.delete(vscode.Uri.joinPath(root, ...relPath.split("/")), {
        recursive: true,
        useTrash: false
      });
      this.dropSelection(relPath);
      await this.sendTree();
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not delete ${relPath}: ${error}`);
    }
  }

  // "at" is the folder the new entry lands in, relative to the docs root; "" is the root.
  private async create(kind: "file" | "folder", at: string): Promise<void> {
    const base = this.base;
    if (!base) {
      return;
    }
    const value = kind === "file" ? "untitled.md" : "";
    const name = (
      await vscode.window.showInputBox({
        title: at ? `New ${kind} in ${at}` : `New ${kind}`,
        value,
        valueSelection: kind === "file" ? [0, "untitled".length] : undefined,
        validateInput: checkName
      })
    )?.trim();
    if (!name) {
      return;
    }
    const folder = at ? vscode.Uri.joinPath(base, ...at.split("/")) : base;
    const uri = vscode.Uri.joinPath(folder, name);
    const path = at ? `${at}/${name}` : name;
    try {
      await vscode.workspace.fs.stat(uri);
      void vscode.window.showErrorMessage(`Docs Panel: ${path} already exists.`);
      return;
    } catch {
      // Nothing there, so the name is free.
    }
    try {
      if (kind === "folder") {
        await vscode.workspace.fs.createDirectory(uri);
        await this.sendTree();
        return;
      }
      await vscode.workspace.fs.writeFile(uri, new Uint8Array());
      this.state.selected = path;
      await this.sendTree();
      this.post({ type: "select", path });
      await this.markRead(path);
      await this.sendContent(path);
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not create ${path}: ${error}`);
    }
  }

  // The copy keeps the folder it came from and takes the next free name beside it.
  private async clone(relPath: string, dir: boolean): Promise<void> {
    const base = this.base;
    if (!base) {
      return;
    }
    const parts = relPath.split("/");
    const name = parts.pop() ?? relPath;
    const folder = parts.length ? vscode.Uri.joinPath(base, ...parts) : base;
    try {
      const to = await freeName(folder, name);
      await vscode.workspace.fs.copy(
        vscode.Uri.joinPath(base, ...relPath.split("/")),
        to,
        { overwrite: false }
      );
      const path = relativeTo(base, to);
      if (!dir) {
        this.state.selected = path;
      }
      await this.sendTree();
      if (!dir) {
        this.post({ type: "select", path });
        await this.markRead(path);
        await this.sendContent(path);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not clone ${relPath}: ${error}`);
    }
  }

  // A drag drops one entry into one folder; "" is the root. The ledger keys of a folder's
  // files are read before the move, because afterwards the old paths are gone.
  private async relocate(from: string, to: string, dir: boolean): Promise<void> {
    const root = this.root?.uri;
    const parent = from.split("/").slice(0, -1).join("/");
    if (!root || to === parent || to === from || to.startsWith(`${from}/`)) {
      return;
    }
    const fromUri = vscode.Uri.joinPath(root, ...from.split("/"));
    const name = from.split("/").pop() ?? from;
    try {
      const inner = dir ? [...(await listFiles(fromUri))] : [];
      const folder = to ? await makeDirectory(root, to.split("/")) : root;
      const target = await freeName(folder, name);
      await vscode.workspace.fs.rename(fromUri, target, { overwrite: false });

      const toPath = relativeTo(root, target);
      for (const spec of this.ledgers) {
        if (dir) {
          for (const rel of inner) {
            await rekey(spec, `${from}/${rel}`, `${toPath}/${rel}`);
          }
          await rekeyFolders(spec, from, toPath);
        } else {
          await rekey(spec, from, toPath);
        }
      }
      this.repin(from, toPath);
      this.dropSelection(from);
      await this.sendTree();
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not move ${from}: ${error}`);
    }
  }

  private async reveal(relPath: string): Promise<void> {
    const base = this.base;
    if (!base) {
      return;
    }
    await vscode.commands.executeCommand(
      "revealFileInOS",
      vscode.Uri.joinPath(base, ...relPath.split("/"))
    );
  }

  private async browse(relPath: string): Promise<void> {
    const base = this.base;
    if (!base) {
      return;
    }
    try {
      await openInBrowser(base, relPath);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Docs Panel could not open ${relPath} in a browser: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // The search across the docs runs in the page, so it is handed the whole of them at
  // once and every keystroke after that costs no round trip.
  private async sendCorpus(): Promise<void> {
    const base = this.base;
    if (!this.ready || !base) {
      return;
    }
    this.post({ type: "corpus", entries: await this.corpus.collect(base, await buildTree(base)) });
  }

  private dataFiles(): DataFile[] {
    if (!this.root) {
      return [];
    }
    return [
      {
        id: "ledger",
        label: "Tags and colours",
        note: "every tag and colour is lost",
        uri: marksLedger(this.root.uri).store
      },
      {
        id: "reads",
        label: "Read marks",
        note: "every file goes back to unread",
        uri: readsLedger(this.root.workspace, this.root.uri).store
      },
      {
        id: "mentions",
        label: "Mention cache",
        note: "rebuilt from the session logs on the next scan",
        uri: cacheUri(this.root.workspace)
      }
    ];
  }

  private async sendDataFiles(): Promise<void> {
    const workspace = this.root?.workspace;
    if (!workspace) {
      return;
    }
    const files = [];
    for (const file of this.dataFiles()) {
      files.push({
        id: file.id,
        label: file.label,
        note: file.note,
        path: relativeTo(workspace, file.uri),
        size: await sizeOf(file.uri)
      });
    }
    this.post({ type: "dataFiles", files });
  }

  // Each file is deleted outright and whatever it held is sent again, now empty, so the
  // page drops what it was showing from it.
  private async purge(ids: string[]): Promise<void> {
    if (!this.root) {
      return;
    }
    const files: (DataFile & { size: number })[] = [];
    for (const file of this.dataFiles()) {
      const size = await sizeOf(file.uri);
      if (ids.includes(file.id) && size >= 0) {
        files.push({ ...file, size });
      }
    }
    if (!files.length) {
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      files.length === 1 ? `Purge ${files[0].label.toLowerCase()}?` : `Purge ${files.length} data files?`,
      {
        modal: true,
        detail: files
          .map((file) => `${relativeTo(this.root!.workspace, file.uri)}: ${file.note}.`)
          .join("\n")
      },
      "Purge"
    );
    if (answer !== "Purge") {
      return;
    }
    for (const file of files) {
      try {
        await vscode.workspace.fs.delete(file.uri, { useTrash: false });
      } catch (error) {
        void vscode.window.showErrorMessage(`Docs Panel could not purge ${file.uri.fsPath}: ${error}`);
      }
    }
    this.postMarks(await load(marksLedger(this.root.uri)));
    this.postReads(await load(readsLedger(this.root.workspace, this.root.uri)));
    await this.sendMentions();
    await this.sendDataFiles();
  }

  // A pin names a path, and a renamed or moved file no longer answers to the one it was
  // pinned under, so the pins follow it the way the ledgers do.
  private repin(from: string, to: string): void {
    this.state.pinned = this.state.pinned.map((path) =>
      path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path
    );
  }

  // The reading pane cannot show a file that has just been moved out from under it.
  private dropSelection(relPath: string): void {
    const selected = this.state.selected;
    if (selected && (selected === relPath || selected.startsWith(`${relPath}/`))) {
      this.state.selected = null;
      this.post({ type: "moved", path: selected });
    }
  }

  private async sendTree(): Promise<void> {
    if (!this.ready) {
      return;
    }
    const base = this.base;
    if (!base) {
      this.post({ type: "tree", nodes: [], notice: "Open a folder to use Docs Panel." });
      return;
    }
    let exists = true;
    try {
      await vscode.workspace.fs.stat(base);
    } catch {
      exists = false;
    }
    if (!exists) {
      this.post({ type: "tree", nodes: [], trash: [], notice: `No folder at ${this.root?.label}` });
      return;
    }
    // The walk skips dotted names, so the trash is built on its own and its paths are
    // prefixed here: one list, one set of keys, whichever side of the trash a file is on.
    const trash = (await buildTree(vscode.Uri.joinPath(base, TRASH_DIR), false)).map(prefixNode);
    this.post({
      type: "tree",
      nodes: await buildTree(base),
      trash,
      pinned: this.state.pinned,
      root: this.root ? relativeTo(this.root.workspace, base) : "",
      name: base.path.split("/").pop() ?? ""
    });
    if (this.root) {
      this.postMarks(await prune(marksLedger(this.root.uri)));
      this.postReads(await prune(readsLedger(this.root.workspace, this.root.uri)));
      await this.sendMentions();
    }
    await this.dropMissingSelection();
  }

  // A file can go from under the panel: deleted, or moved by another tool. The reading
  // pane cannot show it any more, so the whole of the pane - header included - is cleared.
  private async dropMissingSelection(): Promise<void> {
    const base = this.base;
    const selected = this.state.selected;
    if (!base || !selected) {
      return;
    }
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(base, ...selected.split("/")));
    } catch {
      this.state.selected = null;
      this.post({ type: "moved", path: selected });
    }
  }

  private async sendContent(relPath: string): Promise<void> {
    const base = this.base;
    if (!this.ready || !base) {
      return;
    }
    this.post({
      type: "content",
      ...(await renderFile(base, relPath, this.panel.webview))
    });
  }

  private post(message: unknown): void {
    void this.panel.webview.postMessage(message);
  }

  private html(): string {
    const webview = this.panel.webview;
    const nonce = makeNonce();
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    // Without a changing query the webview serves the media files from its cache,
    // so an edited stylesheet can look like a rule that never applied.
    const bust = `?v=${Date.now()}`;
    const script = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "main.js")) + bust;
    const style = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "main.css")) + bust;
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${style}">
<title>Docs</title>
</head>
<body>
<div id="layout">
  <div id="side">
    <div id="sideBody" class="no-toc">
      <div id="tree" tabindex="0"></div>
      <div id="treeTools">
        <button id="findAll" class="icon" type="button" title="Search all docs (Ctrl+F F)">${DOCS_SEARCH_ICON}</button>
        <button id="openOptions" class="icon" type="button" title="Docs Panel options">${SLIDERS_ICON}</button>
      </div>
      <div id="sideSplitter"></div>
      <div id="toc" hidden></div>
    </div>
  </div>
  <div id="splitter"></div>
  <div id="pane">
    <div id="header" hidden>
      <button id="title" type="button" title="Copy the path"></button>
      <span id="stamps">
        <span id="created"></span>
        <span id="modified"></span>
        <span id="ago"></span>
      </span>
      <button id="find" class="icon" type="button" title="Find (Ctrl+F)">${GLASS_ICON}</button>
      <button id="toggle" class="icon" type="button" title="Edit"><span class="pen">${PEN_ICON}</span><span class="eye">${EYE_ICON}</span></button>
      <button id="rename" class="icon" type="button" title="Rename">${TAG_ICON}</button>
      <button id="trash" class="icon" type="button" title="Move to the trash">${TRASH_ICON}</button>
      <button id="restore" class="icon" type="button" title="Restore" hidden>${RESTORE_ICON}</button>
      <span id="tags"></span>
      <button id="addTag" type="button" title="Tags">${ADD_TAG_ICON}</button>
    </div>
    <div id="search" hidden>
      <input id="searchText" type="text" placeholder="Find" spellcheck="false">
      <span id="searchCount"></span>
      <button id="searchCase" class="icon" type="button" title="Match case"><span class="glyph">Aa</span></button>
      <button id="searchWord" class="icon" type="button" title="Whole word"><span class="glyph">ab</span></button>
      <button id="searchRegex" class="icon" type="button" title="Regular expression"><span class="glyph">.*</span></button>
      <button id="searchPrev" class="icon" type="button" title="Previous (PageUp)"><span class="glyph">&#8593;</span></button>
      <button id="searchNext" class="icon" type="button" title="Next (PageDown)"><span class="glyph">&#8595;</span></button>
      <button id="searchClose" class="icon" type="button" title="Close (Escape)"><span class="glyph">&#10005;</span></button>
    </div>
    <div id="body" tabindex="-1"><p class="notice">${escapeHtml("Pick a file on the left.")}</p></div>
    <div id="finder" hidden>
      <div id="finderBar">
        <input id="finderText" type="text" placeholder="Search all docs: names, folders and text, or tag:, file:, folder:" spellcheck="false">
        <span id="finderCount"></span>
        <button id="finderCase" class="icon" type="button" title="Match case"><span class="glyph">Aa</span></button>
        <button id="finderWord" class="icon" type="button" title="Whole word"><span class="glyph">ab</span></button>
        <button id="finderRegex" class="icon" type="button" title="Regular expression"><span class="glyph">.*</span></button>
        <button id="finderClose" class="icon" type="button" title="Close (Escape)"><span class="glyph">&#10005;</span></button>
      </div>
      <div id="finderHint">&#8593;&#8595; pick &middot; Ctrl+&#8593;&#8595; next file &middot; Enter open &middot; Escape back &middot; tag:, file:, folder: narrow the search</div>
      <div id="finderResults"></div>
    </div>
  </div>
</div>
<div id="menu" hidden></div>
<div id="tagPicker" hidden>
  <div id="tagPickerTitle"></div>
  <input id="tagInput" type="text" placeholder="Find or add a tag" spellcheck="false">
  <div id="tagList"></div>
</div>
<div id="optionsLayer" hidden>
  <div id="optionsDialog" role="dialog" aria-label="Docs Panel options" tabindex="-1"></div>
</div>
<div id="toasts"></div>
<div id="lightbox" hidden>
  <img id="lightboxImage" alt="">
  <div id="lightboxHint"></div>
</div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    DocsPanel.current = undefined;
    this.watcher?.dispose();
    this.sessions?.dispose();
    if (this.sessionsTimer) {
      clearTimeout(this.sessionsTimer);
    }
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables.length = 0;
  }
}

// A path is in a trash when a folder on the way to it is one: the panel's own at the docs
// root, or a folder's own .trash.
function isTrashed(relPath: string): boolean {
  return relPath.split("/").slice(0, -1).includes(TRASH_DIR);
}

// Where a trashed path goes back to: the same path with the trash taken out of it.
function untrash(relPath: string): string {
  const parts = relPath.split("/");
  const at = parts.indexOf(TRASH_DIR);
  if (at >= 0) {
    parts.splice(at, 1);
  }
  return parts.join("/");
}

function prefixNode(node: TreeNode): TreeNode {
  return {
    ...node,
    path: `${TRASH_DIR}/${node.path}`,
    children: node.children?.map(prefixNode)
  };
}

async function sizeOf(uri: vscode.Uri): Promise<number> {
  try {
    return (await vscode.workspace.fs.stat(uri)).size;
  } catch {
    return -1;
  }
}

function relativeTo(root: vscode.Uri, uri: vscode.Uri): string {
  if (uri.path === root.path) {
    return "";
  }
  const rootPath = root.path.endsWith("/") ? root.path : root.path + "/";
  return uri.path.startsWith(rootPath) ? uri.path.slice(rootPath.length) : uri.path;
}

function checkName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "The name cannot be empty.";
  }
  return /[\\/:*?"<>|]/.test(trimmed) ? "That name has a character a file cannot use." : null;
}

// A file can outlive the folder it came from, so the chain is rebuilt one level at a
// time: createDirectory is only defined when the parent already exists.
async function makeDirectory(anchor: vscode.Uri, parts: string[]): Promise<vscode.Uri> {
  let uri = anchor;
  await vscode.workspace.fs.createDirectory(uri);
  for (const part of parts) {
    uri = vscode.Uri.joinPath(uri, part);
    await vscode.workspace.fs.createDirectory(uri);
  }
  return uri;
}

async function freeName(folder: vscode.Uri, name: string): Promise<vscode.Uri> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  for (let i = 0; i < 1000; i++) {
    const candidate = vscode.Uri.joinPath(folder, i === 0 ? name : `${stem}-${i}${ext}`);
    try {
      await vscode.workspace.fs.stat(candidate);
    } catch {
      return candidate;
    }
  }
  return vscode.Uri.joinPath(folder, `${stem}-${Date.now()}${ext}`);
}

function resolveRoot(): Root | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  const setting =
    vscode.workspace.getConfiguration("docsPanel", folder.uri).get<string>("folder") ?? "docs";
  const parts = setting.split(/[\\/]/).filter((part) => part.length > 0);
  const uri = parts.length ? vscode.Uri.joinPath(folder.uri, ...parts) : folder.uri;
  return { uri, workspace: folder.uri, label: uri.fsPath };
}

function normalizeState(value: any): PanelState {
  const split = Number(value?.split);
  const sideSplit = Number(value?.sideSplit);
  const textScale = Number(value?.textScale);
  const lineHeight = Number(value?.lineHeight);
  const hoverStrength = Number(value?.hoverStrength);
  return {
    split: Number.isFinite(split) ? split : DEFAULT_STATE.split,
    sideSplit: Number.isFinite(sideSplit) ? sideSplit : DEFAULT_STATE.sideSplit,
    textScale: Number.isFinite(textScale) ? textScale : DEFAULT_STATE.textScale,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : DEFAULT_STATE.lineHeight,
    mono: typeof value?.mono === "boolean" ? value.mono : DEFAULT_STATE.mono,
    // Before there were two lists to size, one switch sized the contents.
    autoSize: AUTO_SIZES.includes(value?.autoSize)
      ? value.autoSize
      : value?.tocAuto === true
        ? "toc"
        : DEFAULT_STATE.autoSize,
    autoWidth: typeof value?.autoWidth === "boolean" ? value.autoWidth : DEFAULT_STATE.autoWidth,
    tagSide: TAG_SIDES.includes(value?.tagSide) ? value.tagSide : DEFAULT_STATE.tagSide,
    hoverStrength: Number.isFinite(hoverStrength)
      ? Math.min(Math.max(hoverStrength, 0), 100)
      : DEFAULT_STATE.hoverStrength,
    expanded: Array.isArray(value?.expanded) ? value.expanded.map(String) : [],
    pinned: Array.isArray(value?.pinned) ? value.pinned.map(String) : [],
    selected: typeof value?.selected === "string" ? value.selected : null
  };
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
