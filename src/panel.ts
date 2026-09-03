import * as vscode from "vscode";
import { buildTree, TreeNode } from "./tree";
import { renderFile, escapeHtml } from "./render";
import { watchRoot } from "./watch";
import {
  invalidate,
  prune,
  readsLedger,
  rekey,
  setStatus,
  statusLedger,
  Ledger,
  LedgerSpec,
  Status,
  READ,
  STATUSES
} from "./ledger";

export const VIEW_TYPE = "docsPanel";
export const TRASH_DIR = ".trash";

export interface PanelState {
  split: number;
  sideSplit: number;
  textScale: number;
  lineHeight: number;
  mono: boolean;
  expanded: string[];
  selected: string | null;
}

const DEFAULT_STATE: PanelState = {
  split: 240,
  sideSplit: 0.5,
  textScale: 1,
  lineHeight: 1,
  mono: false,
  expanded: [],
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

const MINUS_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
d="M3.5 8h9"/></svg>`;

const PLUS_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
d="M8 3.5v9M3.5 8h9"/></svg>`;

// One icon per step: the gaps between the rules are the spacing the step gives.
const LINES_ICONS = [
  "M2.5 5.5h11M2.5 8h11M2.5 10.5h11",
  "M2.5 4h11M2.5 8h11M2.5 12h11",
  "M2.5 2.5h11M2.5 8h11M2.5 13.5h11"
].map(
  (path, step) => `<span class="step step-${step}"><svg viewBox="0 0 16 16" width="14" height="14"
aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
d="${path}"/></svg></span>`
).join("");

const COG_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"
d="M6.6 1.9h2.8l.3 1.7 1.3.8 1.6-.7 1.4 2.4-1.3 1.1v1.6l1.3 1.1-1.4 2.4-1.6-.7-1.3.8-.3 1.7H6.6l-.3-1.7-1.3-.8-1.6.7-1.4-2.4 1.3-1.1V7.2L2 6.1l1.4-2.4 1.6.7 1.3-.8z"/>
<circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

const EYE_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"
d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8z"/>
<circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

interface Root {
  uri: vscode.Uri;
  workspace: vscode.Uri;
  label: string;
}

export class DocsPanel {
  private static current: DocsPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private watcher: vscode.Disposable | undefined;
  private root: Root | undefined;
  private state: PanelState;
  private ready = false;

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
      })
    );
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.reroot())
    );

    this.panel.onDidDispose(() => this.dispose());
    this.startWatcher();
  }

  private get base(): vscode.Uri | undefined {
    return this.root?.uri;
  }

  private get ledgers(): LedgerSpec[] {
    return this.root ? [statusLedger(this.root.uri), readsLedger(this.root.workspace, this.root.uri)] : [];
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

  private async onMessage(message: any): Promise<void> {
    switch (message?.type) {
      case "ready":
        this.ready = true;
        this.post({ type: "state", ...this.state });
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
        await this.move(String(message.path), "trash");
        return;
      case "restore":
        await this.move(String(message.path), "restore");
        return;
      case "status":
        await this.status(String(message.path), message.status);
        return;
    }
  }

  private async status(relPath: string, value: unknown): Promise<void> {
    if (!this.root) {
      return;
    }
    const status = STATUSES.includes(value as Status) ? (value as Status) : null;
    this.postStatuses(await setStatus(statusLedger(this.root.uri), relPath, status));
  }

  private postStatuses(ledger: Ledger): void {
    const statuses: Record<string, string> = {};
    for (const [path, entry] of Object.entries(ledger.files)) {
      statuses[path] = entry.status;
    }
    this.post({ type: "statuses", statuses });
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
      validateInput: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return "The name cannot be empty.";
        }
        return /[\\/:*?"<>|]/.test(trimmed) ? "That name has a character a file cannot use." : null;
      }
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
      }
      this.state.selected = toPath;
      this.post({ type: "renamed", from: relPath, to: toPath });
      await this.sendTree();
      await this.sendContent(toPath);
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not rename ${relPath}: ${error}`);
    }
  }

  // The trash is a folder like any other, so a move is only the prefix going on or off.
  private async move(relPath: string, direction: "trash" | "restore"): Promise<void> {
    const prefix = `${TRASH_DIR}/`;
    const inTrash = relPath.startsWith(prefix);
    if (!this.root || inTrash !== (direction === "restore")) {
      return;
    }
    const root = this.root.uri;
    const parts = (inTrash ? relPath.slice(prefix.length) : relPath).split("/");
    const name = parts.pop() ?? relPath;
    const anchor = direction === "trash" ? vscode.Uri.joinPath(root, TRASH_DIR) : root;

    try {
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
      this.state.selected = null;
      this.post({ type: "moved", path: relPath });
      await this.sendTree();
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not ${direction} ${relPath}: ${error}`);
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
    const trash = (await buildTree(vscode.Uri.joinPath(base, TRASH_DIR))).map(prefixNode);
    this.post({ type: "tree", nodes: await buildTree(base), trash });
    if (this.root) {
      this.postStatuses(await prune(statusLedger(this.root.uri)));
      this.postReads(await prune(readsLedger(this.root.workspace, this.root.uri)));
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
      </span>
      <span id="dirty" hidden>&#9679;</span>
      <span id="typeSettings" hidden>
        <button id="textSmaller" class="icon" type="button" title="Smaller text">${MINUS_ICON}</button>
        <button id="textBigger" class="icon" type="button" title="Bigger text">${PLUS_ICON}</button>
        <button id="lineHeight" class="icon" type="button" title="Line spacing">${LINES_ICONS}</button>
        <button id="font" class="icon" type="button" title="Font"><span class="glyph">Aa</span></button>
      </span>
      <button id="typeToggle" class="icon" type="button" title="Text settings" aria-expanded="false">${COG_ICON}</button>
      <select id="status" title="Status">
        <option value="" class="opt-none">no status</option>
        ${STATUSES.map(
          (value) => `<option value="${value}" class="opt-${value.replace(/ /g, "-")}">${value}</option>`
        ).join("")}
      </select>
      <button id="toggle" class="icon" type="button" title="Edit"><span class="pen">${PEN_ICON}</span><span class="eye">${EYE_ICON}</span></button>
      <button id="rename" class="icon" type="button" title="Rename">${TAG_ICON}</button>
      <button id="trash" class="icon" type="button" title="Move to the trash">${TRASH_ICON}</button>
      <button id="restore" class="icon" type="button" title="Put back" hidden>${RESTORE_ICON}</button>
    </div>
    <div id="body"><p class="notice">${escapeHtml("Pick a file on the left.")}</p></div>
  </div>
</div>
<template id="trashGlyph">${TRASH_ICON}</template>
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
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables.length = 0;
  }
}

function prefixNode(node: TreeNode): TreeNode {
  return {
    ...node,
    path: `${TRASH_DIR}/${node.path}`,
    children: node.children?.map(prefixNode)
  };
}

function relativeTo(root: vscode.Uri, uri: vscode.Uri): string {
  const rootPath = root.path.endsWith("/") ? root.path : root.path + "/";
  return uri.path.startsWith(rootPath) ? uri.path.slice(rootPath.length) : uri.path;
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
  return {
    split: Number.isFinite(split) ? split : DEFAULT_STATE.split,
    sideSplit: Number.isFinite(sideSplit) ? sideSplit : DEFAULT_STATE.sideSplit,
    textScale: Number.isFinite(textScale) ? textScale : DEFAULT_STATE.textScale,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : DEFAULT_STATE.lineHeight,
    mono: typeof value?.mono === "boolean" ? value.mono : DEFAULT_STATE.mono,
    expanded: Array.isArray(value?.expanded) ? value.expanded.map(String) : [],
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
