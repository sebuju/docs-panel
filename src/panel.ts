import * as vscode from "vscode";
import { buildTree, TreeNode } from "./tree";
import { renderFile, escapeHtml, forgetRendered } from "./render";
import { watchRoot } from "./watch";
import {
  cleanTag,
  deleteTag,
  invalidate,
  isColor,
  isTagColor,
  listFiles,
  load,
  prune,
  pruneTags,
  readsLedger,
  rebaseReads,
  rekey,
  rekeyFolders,
  renameTag,
  setTagShort,
  shortOwner,
  MAX_SHORT,
  setColor,
  setStatus,
  setTagColor,
  setTagOrder,
  setTagStyle,
  setTags,
  marksLedger,
  mergeMarks,
  carry,
  usedTags,
  styleOf,
  TagStyle,
  MARKS_FILE,
  Ledger,
  LedgerSpec,
  READ
} from "./ledger";
import { cacheUri, match, refresh, sessionsDir } from "./mentions";
import { Link, Links, linksUri, treeStamp } from "./links";
import { openInBrowser } from "./browser";
import { Corpus } from "./corpus";
import { loadSettings, saveSettings, settingsUri } from "./settings";
import { Refs, RefScope, refsUri } from "./refs";
import { reorderRows } from "./tables";

export const VIEW_TYPE = "docsPanel";
export const TRASH_DIR = ".trash";
const SESSION_DEBOUNCE_MS = 500;
// The marks file can be rewritten by anything, a watcher may not hear of it, so one timer
// looks at its time stamp now and then and reads it only once that has moved.
const MARKS_POLL_MS = 1500;
// A drag sends its state on every step; the file is written once it has stopped.
const SETTINGS_DELAY_MS = 300;
// The places kept in files once read, most recent last; past this many the oldest go.
const MAX_SCROLLS = 300;
// A change to any file can change who names the open one; a burst of them is let settle.
const REFS_DELAY_MS = 300;

// Which of the side's two lists, if either, is given the height its entries need.
export type AutoSize = "none" | "tree" | "toc";
const AUTO_SIZES: AutoSize[] = ["none", "tree", "toc"];

// Whether the side's width follows the tree: not at all, exactly, or only ever wider.
export type AutoWidth = "off" | "on" | "grow";
const AUTO_WIDTHS: AutoWidth[] = ["off", "on", "grow"];

// Which side of a file's name its tags are drawn on in the tree.
export type TagSide = "left" | "right";
const TAG_SIDES: TagSide[] = ["left", "right"];

// Where a bucket's heading stands, in its box, on its outline as a fieldset's legend
// does, or above it, and how it is drawn: as the
// tag's pill, as a bar of the tag's colour across the top, or as the name alone.
export type BucketHead = "inside" | "over" | "outside";
const BUCKET_HEADS: BucketHead[] = ["inside", "over", "outside"];
export type BucketHeadStyle = "pill" | "fill" | "plain";
const BUCKET_HEAD_STYLES: BucketHeadStyle[] = ["pill", "fill", "plain"];

// Where a table's text stands in its cell, and the colour its header row is tinted with:
// a grey like the block light, none, or one of the theme's colours.
export type TableAlign = "top" | "center" | "bottom";
const TABLE_ALIGNS: TableAlign[] = ["top", "center", "bottom"];
const TABLE_HEADS = ["none", "grey", "red", "orange", "yellow", "green", "blue", "purple", "cyan", "magenta"];

const REF_SCOPES: RefScope[] = ["off", "docs", "all"];

// How the divider over each docs folder is drawn, when there are several: what it is
// labelled with, where the label stands, and the line drawn beside it.
export type DividerLabel = "name" | "path" | "none";
const DIVIDER_LABELS: DividerLabel[] = ["name", "path", "none"];
export type DividerAlign = "left" | "center" | "right";
const DIVIDER_ALIGNS: DividerAlign[] = ["left", "center", "right"];
export type DividerLine = "solid" | "dashed" | "dotted" | "double" | "none";
const DIVIDER_LINES: DividerLine[] = ["solid", "dashed", "dotted", "double", "none"];
const DIVIDER_COLORS = ["none", "red", "orange", "yellow", "green", "blue", "purple", "cyan", "magenta", "grey"];

// The settings file names every path from the workspace since there can be several docs
// folders; one without this was written when they were from the one docs folder.
const PATHS_FROM_WORKSPACE = "workspace";

// When the headings beside the reading pane's bar come up: never, while the page
// scrolls, or while the pointer is near the bar.
export type MarksMode = "off" | "scroll" | "hover";
const MARKS_MODES: MarksMode[] = ["off", "scroll", "hover"];

// A folder's tag buckets: the tags that have one, how many stand in a row, how many
// columns a bucket spans where that is more than one, and whether the tags are in an order
// of the folder's own or follow the order tags are listed in.
export interface Buckets {
  tags: string[];
  perRow: number;
  spans: Record<string, number>;
  ordered: boolean;
}
const MAX_PER_ROW = 12;
const MAX_AUTO_MIN = 75;
// How strongly a bucket was tinted when its background was only on or off.
const OLD_BUCKET_FILL = 14;

// Everything the reader can set or arrange in the panel is kept here, and so in
// .vscode/docs-panel-settings.json, so it is never lost to a closed tab, a new window or an
// update. A new option is added in four places: this interface, DEFAULT_STATE,
// normalizeState, and currentState and applyState in media/main.js, which also persists it
// when it changes. Only what is passing - an open menu, a typed search, a zoom - stays out.
export interface PanelState {
  split: number;
  sideSplit: number;
  textScale: number;
  treeScale: number;
  lineHeight: number;
  mono: boolean;
  autoSize: AutoSize;
  // The least share of the side, in percent, the list an auto size squeezes is left.
  autoMin: number;
  autoWidth: AutoWidth;
  // The least share of the window, in percent, an auto sized side width leaves the page.
  autoWidthMin: number;
  // Whether the contents list shows under the tree at all.
  showToc: boolean;
  tagSide: TagSide;
  hoverStrength: number;
  // How far the block light reaches past the block, in pixels, above and below it and
  // either side of it.
  blockPadY: number;
  blockPadX: number;
  // How many of the newest mentions a file shows before "Show more"; none turns them off.
  mentionLines: number;
  expanded: string[];
  pinned: string[];
  // The tag buckets of each folder that has some, by its path.
  buckets: Record<string, Buckets>;
  // How a bucket is drawn: ringed in its tag's colour, and tinted with it this strongly,
  // in percent, where none leaves it bare; and whether its heading is written in the tag's
  // colour, and bold.
  bucketOutline: boolean;
  bucketFill: number;
  bucketHeadTint: boolean;
  bucketHeadBold: boolean;
  bucketHead: BucketHead;
  bucketHeadStyle: BucketHeadStyle;
  // The size of a bucket's heading, in percent of the tree's text.
  bucketHeadSize: number;
  // The divider over each docs folder: its label, where that stands, its size in percent
  // of the tree's text, bold and in capitals or not, its colour, the line beside it and
  // how thick that is, in px, and the room left above it, in px.
  dividerLabel: DividerLabel;
  dividerAlign: DividerAlign;
  dividerSize: number;
  dividerBold: boolean;
  dividerCaps: boolean;
  dividerColor: string;
  dividerLine: DividerLine;
  dividerWidth: number;
  dividerGap: number;
  tableAlign: TableAlign;
  tableHead: string;
  // Where the files that name the open one are looked for, if anywhere.
  refsScope: RefScope;
  // When the headings beside the reading pane's bar come up, and which: the rules, split
  // by commas, of levels and words a heading is taken for, as in "h1-3, h4:todo".
  marksMode: MarksMode;
  marksRules: string;
  // How long, in ms, they stay after the page stops scrolling or the pointer leaves, how
  // far, in px, the page must scroll in one go to bring them up, and how near, in px, the
  // pointer must come to the bar.
  marksLinger: number;
  marksReach: number;
  marksNear: number;
  selected: string | null;
  // The files left in edit mode, which open in it again.
  editing: string[];
  // Match case, whole word and regular expression, in the page's find and in the finder.
  searchCase: boolean;
  searchWord: boolean;
  searchRegex: boolean;
  finderCase: boolean;
  finderWord: boolean;
  finderRegex: boolean;
  // How far down each file was read, as a share of the way.
  scrolls: Record<string, number>;
}

const DEFAULT_STATE: PanelState = {
  split: 240,
  sideSplit: 0.5,
  textScale: 1,
  treeScale: 1,
  lineHeight: 1,
  mono: false,
  autoSize: "none",
  autoMin: 25,
  autoWidth: "off",
  autoWidthMin: 50,
  showToc: true,
  tagSide: "right",
  hoverStrength: 40,
  blockPadY: 4,
  blockPadX: 4,
  mentionLines: 5,
  expanded: [],
  pinned: [],
  buckets: {},
  bucketOutline: true,
  bucketFill: 0,
  bucketHeadTint: false,
  bucketHeadBold: false,
  bucketHead: "inside",
  bucketHeadStyle: "pill",
  bucketHeadSize: 100,
  dividerLabel: "name",
  dividerAlign: "left",
  dividerSize: 85,
  dividerBold: true,
  dividerCaps: true,
  dividerColor: "none",
  dividerLine: "solid",
  dividerWidth: 1,
  dividerGap: 8,
  tableAlign: "center",
  tableHead: "grey",
  refsScope: "docs",
  marksMode: "scroll",
  marksRules: "h1-3",
  marksLinger: 1200,
  marksReach: 0,
  marksNear: 40,
  selected: null,
  editing: [],
  searchCase: false,
  searchWord: false,
  searchRegex: false,
  finderCase: false,
  finderWord: false,
  finderRegex: false,
  scrolls: {}
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

interface DataFile {
  id: string;
  label: string;
  note: string;
  uri: vscode.Uri;
}

// One of the folders the panel shows, each under a divider of its own when there are more
// than one. None lies inside another, so a path from the workspace is in one of them at most.
interface Root {
  uri: vscode.Uri;
  // Its path from the workspace, "" when it is the workspace itself.
  rel: string;
  label: string;
}

export class DocsPanel {
  private static current: DocsPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private watchers: vscode.Disposable[] = [];
  private sessions: vscode.Disposable | undefined;
  private sessionsTimer: NodeJS.Timeout | undefined;
  private workspace: vscode.Uri | undefined;
  private roots: Root[] = [];
  private state: PanelState;
  private ready = false;
  private readonly corpus = new Corpus();
  private readonly links: Links;
  // The files of the docs as the tree last showed them, which names in a page link to.
  private docFiles = new Set<string>();
  private docTimes = new Map<string, number>();
  private docStamp = "";
  private readonly refs: Refs;
  private refsTimer: NodeJS.Timeout | undefined;
  private marksPoll: NodeJS.Timeout | undefined;
  private marksStamp = "";
  private marksSent = "";
  // The settings file is read before the page is told its state, and written a moment
  // after each change, one write after another.
  private readonly settingsLoaded: Promise<void>;
  private settingsTimer: NodeJS.Timeout | undefined;
  private settingsWrite: Promise<void> = Promise.resolve();
  private settingsFailed = false;

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
    DocsPanel.current = new DocsPanel(panel, context);
  }

  static restore(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): void {
    DocsPanel.current?.panel.dispose();
    DocsPanel.current = new DocsPanel(panel, context);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
  ) {
    this.state = normalizeState(undefined);
    this.links = new Links(this.build);
    this.refs = new Refs(this.build, () => this.refsSoon());
    ({ workspace: this.workspace, roots: this.roots } = resolveRoots());
    this.settingsLoaded = this.loadSettings();

    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots()
    };
    this.panel.webview.html = this.html();

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage((message) =>
        this.onMessage(message).catch((error) => this.report(`could not answer "${message?.type}"`, error))
      )
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
    this.marksPoll = setInterval(() => void this.checkMarks(), MARKS_POLL_MS);
  }

  // A stat each time round; the file is only read when its stamp has moved, and the page
  // only hears of it when what it holds is not what was sent last.
  private async checkMarks(): Promise<void> {
    if (!this.ready || !this.roots.length) {
      return;
    }
    const stamps = [];
    for (const root of this.roots) {
      try {
        const stat = await vscode.workspace.fs.stat(marksLedger(root.uri).store);
        stamps.push(`${stat.mtime}:${stat.size}`);
      } catch {
        stamps.push("none");
      }
    }
    const stamp = stamps.join("|");
    if (stamp === this.marksStamp) {
      return;
    }
    this.marksStamp = stamp;
    this.postMarks(await this.loadMarks());
  }

  // Every path the page and the panel's state name is from the workspace, so each docs
  // folder's files keep their own paths whatever other folders are shown beside them.
  private get base(): vscode.Uri | undefined {
    return this.workspace;
  }

  // The docs folder a path from the workspace is in, if any.
  private rootOf(path: string): Root | undefined {
    return this.roots.find((root) => !root.rel || path === root.rel || path.startsWith(`${root.rel}/`));
  }

  // A path from the workspace as a path from its docs folder, which is how that folder's
  // marks ledger keys it.
  private inner(root: Root, path: string): string {
    return !root.rel ? path : path === root.rel ? "" : path.slice(root.rel.length + 1);
  }

  private uriOf(path: string): vscode.Uri {
    return path ? vscode.Uri.joinPath(this.workspace!, ...path.split("/")) : this.workspace!;
  }

  private get reads(): LedgerSpec | undefined {
    return this.workspace ? readsLedger(this.workspace, this.roots.map((root) => root.rel)) : undefined;
  }

  // The marks ledger a path's entry lives in, with the path as that ledger keys it.
  private marksOf(path: string): { spec: LedgerSpec; key: string } | undefined {
    const root = this.rootOf(path);
    return root ? { spec: marksLedger(root.uri), key: this.inner(root, path) } : undefined;
  }

  // Every docs folder's marks, as the page is shown them: one ledger, keyed from the workspace.
  private async loadMarks(): Promise<Ledger> {
    const ledgers = await Promise.all(this.roots.map((root) => load(marksLedger(root.uri))));
    return mergeMarks(ledgers, this.roots.map((root) => root.rel));
  }

  // A change to a tag itself, not to a file, is made in every docs folder's ledger, so the
  // tag stays one tag wherever it is used.
  private async everyMarks(edit: (spec: LedgerSpec) => Promise<unknown>): Promise<void> {
    for (const root of this.roots) {
      await edit(marksLedger(root.uri));
    }
    this.postMarks(await this.loadMarks());
  }

  // A file or folder moved, renamed or trashed from the panel takes its marks and its read
  // mark along: "files" pairs the old and new path, from the workspace, of every file that
  // moved, and "folder" those of the folder that did, if one did.
  private async rekeyAll(files: [string, string][], folder?: [string, string]): Promise<void> {
    const reads = this.reads;
    if (reads) {
      for (const [from, to] of files) {
        await rekey(reads, from, to);
      }
    }
    const [from, to] = folder ?? files[0] ?? [];
    const source = from !== undefined ? this.rootOf(from) : undefined;
    const target = to !== undefined ? this.rootOf(to) : undefined;
    if (!source || !target) {
      return;
    }
    const inSource = (path: string) => this.inner(source, path);
    const inTarget = (path: string) => this.inner(target, path);
    if (source === target) {
      const spec = marksLedger(source.uri);
      for (const [a, b] of files) {
        await rekey(spec, inSource(a), inTarget(b));
      }
      if (folder) {
        await rekeyFolders(spec, inSource(folder[0]), inTarget(folder[1]));
      }
      return;
    }
    await carry(
      marksLedger(source.uri),
      marksLedger(target.uri),
      files.map(([a, b]) => [inSource(a), inTarget(b)]),
      folder ? [inSource(folder[0]), inTarget(folder[1])] : undefined
    );
  }

  private isRoot(path: string): boolean {
    return this.roots.some((root) => root.rel === path);
  }

  // A folder picked to show beside the others is written to the setting, and the panel
  // reads it back from there like any other change to it. One that is a folder already
  // shown, lies inside one, or holds one is refused: its files would be shown twice.
  private async addRoot(): Promise<void> {
    const workspace = this.workspace;
    if (!workspace) {
      return;
    }
    const picked = (
      await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: workspace,
        openLabel: "Add root folder",
        title: "Add a root folder to Docs Panel"
      })
    )?.[0];
    if (!picked) {
      return;
    }
    const rel = relativeTo(workspace, picked);
    if (picked.scheme !== workspace.scheme || rel.startsWith("/")) {
      void vscode.window.showErrorMessage(`Docs Panel: ${picked.fsPath} is not inside the workspace.`);
      return;
    }
    const named = (path: string) => path || "the workspace root";
    const clash = this.roots.find((root) => overlaps(root.rel, rel));
    if (clash) {
      const why =
        clash.rel === rel
          ? `${named(rel)} is already a root folder.`
          : !clash.rel || rel.startsWith(`${clash.rel}/`)
            ? `${named(rel)} is inside ${named(clash.rel)}, which is already a root folder.`
            : `${named(rel)} holds ${clash.rel}, which is already a root folder.`;
      void vscode.window.showErrorMessage(`Docs Panel: ${why}`);
      return;
    }
    await this.writeRoots([...this.roots.map((root) => root.rel), rel]);
  }

  // The last root folder cannot go: the panel would have nothing to show.
  private async removeRoot(path: string): Promise<void> {
    if (this.roots.length < 2 || !this.isRoot(path)) {
      return;
    }
    await this.writeRoots(this.roots.filter((root) => root.rel !== path).map((root) => root.rel));
  }

  // One folder is written as the plain string the setting always held, so it still means
  // the same to an older version of the panel.
  private async writeRoots(rels: string[]): Promise<void> {
    const values = rels.map((rel) => rel || ".");
    try {
      await vscode.workspace
        .getConfiguration("docsPanel", this.workspace)
        .update("folder", values.length === 1 ? values[0] : values, vscode.ConfigurationTarget.WorkspaceFolder);
    } catch (error) {
      this.report("could not change the root folders", error);
    }
  }

  private resourceRoots(): vscode.Uri[] {
    return [vscode.Uri.joinPath(this.context.extensionUri, "media"), ...this.roots.map((root) => root.uri)];
  }

  private reroot(): void {
    ({ workspace: this.workspace, roots: this.roots } = resolveRoots());
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots()
    };
    this.startWatcher();
    this.startSessionWatcher();
    this.sendTree().catch((error) => this.report("could not read the docs folder", error));
    if (this.state.selected) {
      this.sendContent(this.state.selected).catch((error) => this.report("could not open the file", error));
    }
  }

  private startWatcher(): void {
    this.watchers.forEach((watcher) => watcher.dispose());
    this.watchers = this.roots.map((root) => watchRoot(root.uri, {
      onTreeChange: () => this.sendTree().catch((error) => this.report("could not read the docs folder", error)),
      onFileChange: (inner) => {
        const path = root.rel ? `${root.rel}/${inner}` : inner;
        if (inner === MARKS_FILE) {
          void this.checkMarks();
        } else if (path === this.state.selected) {
          void this.markRead(path);
          this.sendContent(path).catch((error) => this.report("could not open the file", error));
        } else {
          void this.unread(path);
          this.refsSoon();
        }
      }
    }));
  }

  // A live session appends to its log constantly, so the writes are let settle before the
  // scan: the pass itself is cheap, but it is worth nothing until a line is complete.
  private startSessionWatcher(): void {
    this.sessions?.dispose();
    this.sessions = undefined;
    if (!this.workspace) {
      return;
    }
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(sessionsDir(this.workspace)), "*.jsonl")
    );
    const schedule = () => {
      if (!this.state.mentionLines) {
        return;
      }
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
      .getConfiguration("docsPanel", this.workspace)
      .get<Record<string, unknown>>("copyPrefix", {});
    const prefixes: Record<string, string> = {};
    for (const [type, value] of Object.entries(setting ?? {})) {
      if (typeof value === "string") {
        prefixes[type.replace(/^\./, "").toLowerCase()] = value;
      }
    }
    this.post({ type: "prefixes", prefixes });
  }

  // The file is the only place the settings are kept: without one the panel starts from
  // its defaults.
  //
  // Files written before there could be several docs folders name every file from the one
  // there was. They are found by what they lack, the settings a "paths" of "workspace" and
  // the read marks a version of 2, and their paths are put behind that folder's, which is
  // the first one now, once; they are written back so on the next save.
  private async loadSettings(): Promise<void> {
    if (!this.workspace) {
      return;
    }
    const prefix = this.roots[0]?.rel ?? "";
    await rebaseReads(this.reads!, prefix);
    const saved = await loadSettings(this.workspace);
    if (saved) {
      this.state = normalizeState(saved);
      if ((saved as { paths?: unknown }).paths !== PATHS_FROM_WORKSPACE) {
        this.state = rebaseState(this.state, prefix);
        this.saveSettingsSoon();
      }
    }
  }

  private saveSettingsSoon(): void {
    clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => this.saveSettingsNow(), SETTINGS_DELAY_MS);
  }

  // Each write takes the state as it is when its turn comes, so the last one is the newest.
  private saveSettingsNow(): void {
    clearTimeout(this.settingsTimer);
    this.settingsTimer = undefined;
    const workspace = this.workspace;
    if (!workspace) {
      return;
    }
    this.settingsWrite = this.settingsWrite
      .then(() => saveSettings(workspace, { ...this.state, paths: PATHS_FROM_WORKSPACE }))
      .then(
        () => {
          this.settingsFailed = false;
        },
        (error) => {
          if (!this.settingsFailed) {
            this.settingsFailed = true;
            void vscode.window.showErrorMessage(
              `Docs Panel could not save its settings to ${settingsUri(workspace).fsPath}: ${error}`
            );
          }
        }
      );
  }

  // The version the caches are stamped with, so an update never reads what an older one wrote.
  private get build(): string {
    return String(this.context.extension.packageJSON.version ?? "");
  }

  private async sendMentions(): Promise<void> {
    if (!this.ready || !this.workspace) {
      return;
    }
    if (!this.state.mentionLines) {
      this.post({ type: "mentions", mentions: {} });
      return;
    }
    const hits = await refresh(this.workspace, this.build);
    this.post({ type: "mentions", mentions: match(hits, await this.allFiles()) });
  }

  // Every file of every docs folder, trashed ones too, by its path from the workspace.
  private async allFiles(): Promise<Set<string>> {
    const out = new Set<string>();
    for (const root of this.roots) {
      for (const path of await listFiles(root.uri)) {
        out.add(root.rel ? `${root.rel}/${path}` : path);
      }
    }
    return out;
  }

  private async onMessage(message: any): Promise<void> {
    switch (message?.type) {
      case "ready":
        await this.settingsLoaded;
        this.ready = true;
        // A page loaded again has none of the marks, whatever was sent to the last one.
        this.marksSent = "";
        this.post({ type: "state", ...this.state });
        this.post({ type: "version", version: this.build });
        this.sendPrefixes();
        await this.sendTree(async () => {
          if (this.state.selected) {
            await this.sendContent(this.state.selected);
          }
        });
        return;
      case "open": {
        // The page is shown first: a read mark that cannot be written must not keep it shut.
        const path = String(message.path);
        this.state.selected = path;
        await this.sendContent(path);
        await this.markRead(path);
        return;
      }
      case "persist": {
        await this.settingsLoaded;
        const mentioned = this.state.mentionLines > 0;
        const scope = this.state.refsScope;
        this.state = normalizeState(message);
        this.saveSettingsSoon();
        if (scope !== this.state.refsScope && this.state.selected) {
          void this.sendRefs(this.state.selected);
        }
        if (mentioned !== this.state.mentionLines > 0) {
          await this.sendMentions();
        }
        return;
      }
      case "save":
        await this.save(String(message.path), String(message.text));
        return;
      case "reorderRows":
        await this.reorderRows(String(message.path), String(message.text ?? ""), message.rows, message.order);
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
        await this.relocate(
          String(message.from),
          String(message.to),
          !!message.dir,
          cleanTag(message.tag),
          message.untag === true
        );
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
      case "tagShort":
        await this.tagShort(String(message.name));
        return;
      case "tagStyle":
        await this.everyMarks((spec) => setTagStyle(spec, String(message.name), message.style));
        return;
      case "tagOrder":
        await this.everyMarks((spec) => setTagOrder(spec, message.names));
        return;
      case "addRoot":
        await this.addRoot();
        return;
      case "removeRoot":
        await this.removeRoot(String(message.path ?? ""));
        return;
      case "openWorkspace":
        await this.openWorkspaceFile(String(message.path));
        return;
      case "deleteTag":
        await this.deleteTag(String(message.name));
        return;
      case "pruneTags":
        await this.pruneTags();
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
      case "error":
        this.report("page error", `${message.message} (${message.where})`);
        return;
    }
  }

  // A failure behind the page would otherwise leave it waiting with no word of why.
  private report(what: string, error: unknown): void {
    console.error(`Docs Panel ${what}:`, error);
    void vscode.window.showErrorMessage(
      `Docs Panel ${what}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  private async tags(relPath: string, value: unknown): Promise<void> {
    const at = this.marksOf(relPath);
    if (!at || !Array.isArray(value)) {
      return;
    }
    await setTags(at.spec, at.key, value, (await this.loadMarks()).tags);
    this.postMarks(await this.loadMarks());
  }

  private async color(relPath: string, value: unknown, dir: boolean): Promise<void> {
    const at = this.marksOf(relPath);
    // A docs folder itself has no colour: it is a divider, not a row.
    if (!at || !at.key) {
      return;
    }
    const color = isColor(value) ? value : null;
    await setColor(at.spec, at.key, color, dir);
    this.postMarks(await this.loadMarks());
  }

  private async tagColor(name: string, value: unknown): Promise<void> {
    if (!isTagColor(value)) {
      return;
    }
    await this.everyMarks((spec) => setTagColor(spec, name, value));
  }

  private async renameTag(name: string): Promise<void> {
    if (!this.roots.length) {
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
    // The buckets name their tags, so they follow the tag to its new name.
    const to = cleanTag(next);
    for (const buckets of Object.values(this.state.buckets)) {
      buckets.tags = [...new Set(buckets.tags.map((tag) => (tag === name ? to : tag)))];
      if (name in buckets.spans) {
        buckets.spans[to] = buckets.spans[name];
        delete buckets.spans[name];
      }
    }
    this.post({ type: "tagRenamed", from: name, to });
    await this.everyMarks((spec) => renameTag(spec, name, next));
  }

  // The letters a tag shows where its name does not fit; two tags never share them.
  private async tagShort(name: string): Promise<void> {
    const ledger = await this.loadMarks();
    if (!ledger.tags[name]) {
      return;
    }
    const next = await vscode.window.showInputBox({
      title: `Letters for the tag ${name}`,
      prompt: "Shown in place of the name where it does not fit.",
      value: ledger.tags[name].short ?? "",
      validateInput: (value) => {
        const short = value.replace(/\s+/g, "");
        if (!short) {
          return "The letters cannot be empty.";
        }
        if (short.length > MAX_SHORT) {
          return `At most ${MAX_SHORT} letters.`;
        }
        const owner = shortOwner(ledger, name, short);
        return owner ? `The tag ${owner} has these letters.` : null;
      }
    });
    if (next === undefined) {
      return;
    }
    await this.everyMarks((spec) => setTagShort(spec, name, next));
  }

  private async deleteTag(name: string): Promise<void> {
    const used = Object.values((await this.loadMarks()).files).filter((entry) =>
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
    await this.everyMarks((spec) => deleteTag(spec, name));
  }

  // A tag goes when no file in any docs folder has it.
  private async pruneTags(): Promise<void> {
    const before = await this.loadMarks();
    const used = usedTags(before);
    await this.everyMarks((spec) => pruneTags(spec, used));
    this.post({ type: "prunedTags", names: Object.keys(before.tags).filter((name) => !used.has(name)) });
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
    const tagShorts: Record<string, string> = {};
    const tagStyles: Record<string, TagStyle> = {};
    for (const [name, mark] of Object.entries(ledger.tags)) {
      tagColors[name] = mark.color;
      if (mark.short) {
        tagShorts[name] = mark.short;
      }
      const style = styleOf(mark);
      if (Object.keys(style).length) {
        tagStyles[name] = style;
      }
    }
    const message = { type: "marks", tags, colors, tagColors, tagShorts, tagStyles, tagOrder: ledger.tagOrder };
    // The timer reads the file back after every write the panel makes itself, and that
    // would only send the page what it already has.
    const sent = JSON.stringify(message);
    if (sent !== this.marksSent) {
      this.marksSent = sent;
      this.post(message);
    }
  }

  // A name in a page that is a file of the workspace but not of the docs opens beside.
  private async openWorkspaceFile(relPath: string): Promise<void> {
    const workspace = this.workspace;
    if (!workspace || relPath.split("/").includes("..")) {
      return;
    }
    try {
      await vscode.window.showTextDocument(vscode.Uri.joinPath(workspace, ...relPath.split("/")), {
        preview: true
      });
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not open ${relPath}: ${error}`);
    }
  }

  private postReads(ledger: Ledger): void {
    this.post({ type: "reads", reads: Object.keys(ledger.files) });
  }

  private async markRead(relPath: string): Promise<void> {
    const reads = this.reads;
    if (!reads || !this.rootOf(relPath)) {
      return;
    }
    this.postReads(await setStatus(reads, relPath, READ));
  }

  // A file edited behind the panel's back is no longer the one that was read. The open
  // file is exempt: it is on screen, so the change is being watched as it happens.
  private async unread(relPath: string): Promise<void> {
    const reads = this.reads;
    if (!reads) {
      return;
    }
    const ledger = await invalidate(reads, relPath);
    if (ledger) {
      this.postReads(ledger);
    }
  }

  private async save(relPath: string, text: string): Promise<void> {
    const base = this.base;
    if (!base || !this.rootOf(relPath)) {
      return;
    }
    const uri = vscode.Uri.joinPath(base, ...relPath.split("/"));
    try {
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
      forgetRendered(base, relPath);
      this.post({ type: "saved", path: relPath });
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not save ${relPath}: ${error}`);
    }
  }

  // A table sorted or a row dragged in the page moves the rows in the file, and nothing
  // else: the file is read as it is now and must be the text the page was drawn from, and
  // reorderRows checks the lines named are one table's rows and that only they moved. The
  // page is drawn again from the file whether it was written or refused, so what is shown
  // is always what the file holds.
  private async reorderRows(relPath: string, shown: string, rows: unknown, order: unknown): Promise<void> {
    const base = this.base;
    if (!base || !this.rootOf(relPath)) {
      return;
    }
    const uri = vscode.Uri.joinPath(base, ...relPath.split("/"));
    try {
      const next = reorderRows(await vscode.workspace.fs.readFile(uri), shown, rows, order);
      if (next) {
        await vscode.workspace.fs.writeFile(uri, next);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Docs Panel did not reorder the table in ${relPath}: ${error instanceof Error ? error.message : error}`
      );
    }
    forgetRendered(base, relPath);
    if (this.state.selected === relPath) {
      await this.sendContent(relPath);
    }
  }

  // The file keeps its folder: only the name is asked for, so a rename cannot move a file.
  private async rename(relPath: string): Promise<void> {
    const base = this.base;
    if (!base || !this.rootOf(relPath) || this.isRoot(relPath)) {
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
      const inner = [...(await listFiles(to))];
      await this.rekeyAll(
        [[relPath, toPath], ...inner.map((path): [string, string] => [`${relPath}/${path}`, `${toPath}/${path}`])],
        [relPath, toPath]
      );
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

  // The trash is a folder like any other, so a move is only a .trash going in or out of
  // the path. An entry goes to the .trash of the folder holding it, and comes back to that
  // folder with the .trash taken out, so a file never leaves its folder this way. "from" is
  // the folder whose .trash it goes to: for a folder trashed file by file, the one holding
  // that folder.
  private shifted(relPath: string, direction: "trash" | "restore", from = parentOf(relPath)): string {
    if (direction === "trash") {
      return [from, TRASH_DIR, from ? relPath.slice(from.length + 1) : relPath].filter(Boolean).join("/");
    }
    const root = this.rootOf(relPath)!;
    const back = untrash(this.inner(root, relPath));
    return root.rel ? `${root.rel}/${back}` : back;
  }

  private async shift(relPath: string, direction: "trash" | "restore", from?: string): Promise<void> {
    const parts = this.shifted(relPath, direction, from).split("/");
    const name = parts.pop() ?? relPath;
    const target = await makeDirectory(this.workspace!, parts);
    const to = await freeName(target, name);
    await vscode.workspace.fs.rename(this.uriOf(relPath), to, { overwrite: false });
    await this.rekeyAll([[relPath, relativeTo(this.workspace!, to)]]);
  }

  // A folder cannot be trashed whole: every file in it is moved on its own so each keeps
  // its ledger entry, and only the emptied shell is deleted.
  private async move(
    relPath: string,
    direction: "trash" | "restore",
    dir: boolean
  ): Promise<void> {
    const root = this.rootOf(relPath);
    if (!root || this.isRoot(relPath) || isTrashed(this.inner(root, relPath)) !== (direction === "restore")) {
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
    if (!dir) {
      await this.shift(relPath, direction);
      return;
    }
    const uri = this.uriOf(relPath);
    const from = parentOf(relPath);
    for (const inner of await listFiles(uri)) {
      await this.shift(`${relPath}/${inner}`, direction, from);
    }
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    // The files land at the same path on the other side of the trash, and the
    // folders they make there answer to the colours the originals had.
    await this.rekeyAll([], [relPath, this.shifted(relPath, direction)]);
  }

  // "at" names a bin: the folder its files were trashed from, and a docs folder for the
  // whole of its trash. A folder's bin is its part of the trash and, when it has one, its
  // own .trash too.
  private async binEntries(at: string): Promise<{ bin: string; entries: [string, boolean][] }[]> {
    const root = this.rootOf(at);
    if (!root) {
      return [];
    }
    const inner = this.inner(root, at);
    const bins = (inner ? [`${TRASH_DIR}/${inner}`, `${inner}/${TRASH_DIR}`] : [TRASH_DIR]).map((bin) =>
      root.rel ? `${root.rel}/${bin}` : bin
    );
    const out = [];
    for (const bin of bins) {
      try {
        const listed = await vscode.workspace.fs.readDirectory(this.uriOf(bin));
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
    if (!this.workspace) {
      return;
    }
    for (const { bin, entries } of await this.binEntries(at)) {
      try {
        for (const [name, dir] of entries) {
          await this.transfer(`${bin}/${name}`, "restore", dir);
        }
        if (!this.isRoot(at)) {
          await vscode.workspace.fs.delete(this.uriOf(bin), {
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
    if (!this.workspace) {
      return;
    }
    const bins = (await this.binEntries(at)).filter(({ entries }) => entries.length);
    if (!bins.length) {
      return;
    }
    const whole = this.isRoot(at);
    const answer = await vscode.window.showWarningMessage(
      !whole
        ? `Delete everything trashed from ${at} for good?`
        : this.roots.length > 1
          ? `Delete everything in the trash of ${at || "the workspace root"} for good?`
          : "Delete everything in the trash for good?",
      { modal: true, detail: "This cannot be undone." },
      "Delete all"
    );
    if (answer !== "Delete all") {
      return;
    }
    for (const { bin, entries } of bins) {
      try {
        const target = !whole ? [bin] : entries.map(([name]) => `${bin}/${name}`);
        for (const path of target) {
          await vscode.workspace.fs.delete(this.uriOf(path), {
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
    if (!this.rootOf(relPath) || this.isRoot(relPath)) {
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
      await vscode.workspace.fs.delete(this.uriOf(relPath), {
        recursive: true,
        useTrash: false
      });
      this.dropSelection(relPath);
      await this.sendTree();
    } catch (error) {
      void vscode.window.showErrorMessage(`Docs Panel could not delete ${relPath}: ${error}`);
    }
  }

  // "at" is the folder the new entry lands in, from the workspace; a docs folder itself
  // when it is one of those.
  private async create(kind: "file" | "folder", at: string): Promise<void> {
    if (!this.workspace || !this.rootOf(at)) {
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
    const uri = vscode.Uri.joinPath(this.uriOf(at), name);
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
    if (!base || !this.rootOf(relPath) || this.isRoot(relPath)) {
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

  // A drag drops one entry into one folder, from one docs folder into another too. The
  // ledger keys of a folder's files are read before the move, because afterwards the old
  // paths are gone. A file dropped in one of the folder's tag buckets takes the bucket's
  // tag as it lands, or, in its untagged bucket, loses all its tags.
  private async relocate(from: string, to: string, dir: boolean, tag = "", untag = false): Promise<void> {
    const root = this.workspace;
    const parent = from.split("/").slice(0, -1).join("/");
    if (
      !root ||
      !this.rootOf(from) ||
      this.isRoot(from) ||
      !this.rootOf(to) ||
      to === parent ||
      to === from ||
      to.startsWith(`${from}/`)
    ) {
      return;
    }
    const fromUri = this.uriOf(from);
    const name = from.split("/").pop() ?? from;
    try {
      const inner = dir ? [...(await listFiles(fromUri))] : [];
      const folder = to ? await makeDirectory(root, to.split("/")) : root;
      const target = await freeName(folder, name);
      await vscode.workspace.fs.rename(fromUri, target, { overwrite: false });

      const toPath = relativeTo(root, target);
      if (dir) {
        await this.rekeyAll(
          inner.map((rel): [string, string] => [`${from}/${rel}`, `${toPath}/${rel}`]),
          [from, toPath]
        );
      } else {
        await this.rekeyAll([[from, toPath]]);
      }
      const at = this.marksOf(toPath);
      if (at && untag && !dir) {
        await setTags(at.spec, at.key, []);
      } else if (at && tag && !dir) {
        const own = (await load(at.spec)).files[at.key]?.tags ?? [];
        if (!own.includes(tag)) {
          await setTags(at.spec, at.key, [...own, tag], (await this.loadMarks()).tags);
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
    if (!this.workspace || !this.rootOf(relPath)) {
      return;
    }
    await vscode.commands.executeCommand("revealFileInOS", this.uriOf(relPath));
  }

  private async browse(relPath: string): Promise<void> {
    const base = this.base;
    if (!base || !this.rootOf(relPath)) {
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
    const nodes = [];
    for (const root of this.roots) {
      nodes.push(...(await buildTree(root.uri)).map((node) => prefixNode(node, root.rel)));
    }
    this.post({ type: "corpus", entries: await this.corpus.collect(base, nodes) });
  }

  // Each docs folder has its own tags and colours; the rest are the workspace's.
  private dataFiles(): DataFile[] {
    const workspace = this.workspace;
    if (!workspace) {
      return [];
    }
    return [
      ...this.roots.map((root) => ({
        id: `ledger:${root.rel}`,
        label: "Tags and colours",
        note: this.roots.length > 1 ? `every tag and colour in ${root.rel || "the workspace root"} is lost` : "every tag and colour is lost",
        uri: marksLedger(root.uri).store
      })),
      {
        id: "reads",
        label: "Read marks",
        note: "every file goes back to unread",
        uri: this.reads!.store
      },
      {
        id: "settings",
        label: "Settings",
        note: "every setting and bucket goes back to its default",
        uri: settingsUri(workspace)
      },
      {
        id: "mentions",
        label: "Mention cache",
        note: "rebuilt from the session logs on the next scan",
        uri: cacheUri(workspace)
      },
      {
        id: "links",
        label: "Link cache",
        note: "the files each page names are looked up again as the pages are opened",
        uri: linksUri(workspace)
      },
      {
        id: "refs",
        label: "Reference cache",
        note: "every file is read again for the files it names when the next page is opened",
        uri: refsUri(workspace)
      }
    ];
  }

  private async sendDataFiles(): Promise<void> {
    const workspace = this.workspace;
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
    if (!this.workspace) {
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
          .map((file) => `${relativeTo(this.workspace!, file.uri)}: ${file.note}.`)
          .join("\n")
      },
      "Purge"
    );
    if (answer !== "Purge") {
      return;
    }
    if (files.some((file) => file.id === "settings")) {
      clearTimeout(this.settingsTimer);
      this.settingsTimer = undefined;
      await this.settingsWrite;
      this.state = { ...normalizeState(undefined), selected: this.state.selected };
    }
    for (const file of files) {
      try {
        await vscode.workspace.fs.delete(file.uri, { useTrash: false });
      } catch (error) {
        void vscode.window.showErrorMessage(`Docs Panel could not purge ${file.uri.fsPath}: ${error}`);
      }
    }
    this.links.forget();
    this.refs.forget();
    if (files.some((file) => file.id === "settings")) {
      this.post({ type: "state", ...this.state });
    }
    this.postMarks(await this.loadMarks());
    this.postReads(await load(this.reads!));
    await this.sendMentions();
    await this.sendDataFiles();
  }

  // A pin names a path, and a renamed or moved file no longer answers to the one it was
  // pinned under, so the pins follow it the way the ledgers do; so do the open folders and
  // the buckets. The page is told first: whatever it sends back after this, a rename or a
  // move it hears of next among them, must carry the new paths, not the ones it had.
  private repin(from: string, to: string): void {
    const move = (path: string) =>
      path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
    this.state.pinned = this.state.pinned.map(move);
    this.state.expanded = this.state.expanded.map(move);
    const buckets: Record<string, Buckets> = {};
    for (const [path, value] of Object.entries(this.state.buckets)) {
      buckets[move(path)] = value;
    }
    this.state.buckets = buckets;
    this.saveSettingsSoon();
    this.post({ type: "repath", from, to });
  }

  // The reading pane cannot show a file that has just been moved out from under it.
  private dropSelection(relPath: string): void {
    const selected = this.state.selected;
    if (selected && (selected === relPath || selected.startsWith(`${relPath}/`))) {
      this.state.selected = null;
      this.post({ type: "moved", path: selected });
    }
  }

  // The tree goes first, with the tags, colours and read marks as their files hold them.
  // Then whatever is waiting on the tree, the open file when the page has just loaded;
  // and only then the slow part, which matches the marks against every file, reading
  // some of them, and scans the session logs for mentions.
  private async sendTree(then?: () => Promise<void>): Promise<void> {
    if (!this.ready) {
      return;
    }
    const workspace = this.workspace;
    if (!workspace) {
      this.post({ type: "tree", roots: [], notice: "Open a folder to use Docs Panel." });
      return;
    }
    // A docs folder that is not there is shown as missing, and its marks are left alone:
    // matched against no files, every one of them would be dropped.
    const present = new Set<Root>();
    const roots = await Promise.all(
      this.roots.map(async (root) => {
        const shown = {
          path: root.rel,
          name: (root.rel || workspace.path).split("/").pop() ?? "",
          label: root.label
        };
        try {
          await vscode.workspace.fs.stat(root.uri);
        } catch {
          return { ...shown, nodes: [], trash: [], notice: `No folder at ${root.label}` };
        }
        present.add(root);
        // The walk skips dotted names, so the trash is built on its own and its paths are
        // prefixed here: one list, one set of keys, whichever side of the trash a file is on.
        const [trashed, nodes] = await Promise.all([
          buildTree(vscode.Uri.joinPath(root.uri, TRASH_DIR), false),
          buildTree(root.uri)
        ]);
        return {
          ...shown,
          nodes: nodes.map((node) => prefixNode(node, root.rel)),
          trash: trashed.map((node) => prefixNode(node, root.rel ? `${root.rel}/${TRASH_DIR}` : TRASH_DIR))
        };
      })
    );
    this.docTimes = timesOf(roots.flatMap((root) => root.nodes));
    this.docFiles = new Set(this.docTimes.keys());
    this.docStamp = treeStamp(this.docFiles);
    this.post({ type: "tree", roots, pinned: this.state.pinned });
    const reads = this.reads!;
    const [marks, read] = await Promise.all([this.loadMarks(), load(reads)]);
    this.postMarks(marks);
    this.postReads(read);
    await this.dropMissingSelection();
    if (then) {
      await then();
    }
    for (const root of present) {
      await prune(marksLedger(root.uri));
    }
    this.postMarks(await this.loadMarks());
    if (present.size === this.roots.length) {
      this.postReads(await prune(reads));
    }
    await this.sendMentions();
    this.refsSoon();
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
      if (!this.rootOf(selected)) {
        throw new Error("outside the docs");
      }
      await vscode.workspace.fs.stat(this.uriOf(selected));
    } catch {
      this.state.selected = null;
      this.post({ type: "moved", path: selected });
    }
  }

  private async sendContent(relPath: string): Promise<void> {
    const base = this.base;
    if (!this.ready || !base || !this.rootOf(relPath)) {
      return;
    }
    const content = await renderFile(base, relPath, this.panel.webview);
    const workspace = content.kind === "md" && typeof content.text === "string" ? this.workspace : undefined;
    if (!workspace) {
      this.post({ type: "content", ...content, links: {} });
      void this.sendRefs(relPath);
      return;
    }
    // The page is shown with the links it had last time, and put right when they have been
    // worked out for the file and the docs as they are now, which can mean a lookup for
    // every name in it.
    const early = (await this.links.kept(workspace, relPath)) ?? {};
    this.post({ type: "content", ...content, links: early });
    this.links
      .of(workspace, relPath, content.text!, content.modified ?? 0, this.docFiles, this.docStamp)
      .then((links) => {
        if (!sameLinks(links, early)) {
          this.post({ type: "links", path: relPath, modified: content.modified, links });
        }
      })
      .catch((error) => this.report("could not find the files the page names", error));
    void this.sendRefs(relPath);
  }

  private refsSoon(): void {
    clearTimeout(this.refsTimer);
    this.refsTimer = setTimeout(() => {
      this.refsTimer = undefined;
      if (this.state.selected) {
        void this.sendRefs(this.state.selected);
      }
    }, REFS_DELAY_MS);
  }

  // The files that name the open one, which the page lists above it. The first time it is
  // asked this reads every file in the scope, so it never holds up the page itself.
  private async sendRefs(relPath: string): Promise<void> {
    const workspace = this.workspace;
    if (!this.ready || !workspace) {
      return;
    }
    try {
      // The docs are known by their paths from the workspace, so they are looked for from it.
      const refs = await this.refs.of(
        workspace,
        "",
        relPath,
        this.state.refsScope,
        this.docTimes,
        this.docStamp
      );
      this.post({ type: "refs", path: relPath, refs });
    } catch (error) {
      this.report("could not find the files that name the page", error);
    }
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
      <button id="toggle" class="icon" type="button" title="Edit">${PEN_ICON}</button>
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
        <input id="finderText" type="text" placeholder="Search all docs: names, folders and text, or tag:, file:, folder:, several split by commas" spellcheck="false">
        <span id="finderCount"></span>
        <button id="finderCase" class="icon" type="button" title="Match case"><span class="glyph">Aa</span></button>
        <button id="finderWord" class="icon" type="button" title="Whole word"><span class="glyph">ab</span></button>
        <button id="finderRegex" class="icon" type="button" title="Regular expression"><span class="glyph">.*</span></button>
        <button id="finderClose" class="icon" type="button" title="Close (Escape)"><span class="glyph">&#10005;</span></button>
      </div>
      <div id="finderHint">&#8593;&#8595; pick &middot; Ctrl+&#8593;&#8595; next file &middot; Enter open &middot; Escape back &middot; tag:, file:, folder: narrow the search, tag:a,b takes either</div>
      <div id="finderResults"></div>
    </div>
  </div>
</div>
<div id="menu" hidden></div>
<div id="tagPicker" hidden>
  <div id="tagPickerTitle"></div>
  <button id="tagPickerOptions" class="icon" type="button" title="Options">${SLIDERS_ICON}</button>
  <input id="tagInput" type="text" placeholder="Find or add a tag" spellcheck="false">
  <div id="tagList"></div>
  <div id="tagPickerFoot" hidden></div>
</div>
<div id="optionsLayer" hidden>
  <div id="optionsDialog" role="dialog" aria-label="Docs Panel options" tabindex="-1">
    <div id="optionsHead"></div>
    <div id="optionsBody"></div>
  </div>
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
    if (this.settingsTimer) {
      this.saveSettingsNow();
    }
    if (this.marksPoll) {
      clearInterval(this.marksPoll);
    }
    this.watchers.forEach((watcher) => watcher.dispose());
    this.sessions?.dispose();
    this.refs.dispose();
    clearTimeout(this.refsTimer);
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

function parentOf(relPath: string): string {
  const at = relPath.lastIndexOf("/");
  return at < 0 ? "" : relPath.slice(0, at);
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

// Every file of the tree, with the time it was last modified.
function timesOf(nodes: TreeNode[], out = new Map<string, number>()): Map<string, number> {
  for (const node of nodes) {
    if (node.dir) {
      timesOf(node.children ?? [], out);
    } else {
      out.set(node.path, node.mtime ?? 0);
    }
  }
  return out;
}

function sameLinks(a: Record<string, Link>, b: Record<string, Link>): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => b[key] && b[key].path === a[key].path && !!b[key].workspace === !!a[key].workspace)
  );
}

// A node from a walk of one folder, named by its path from a folder above it.
function prefixNode(node: TreeNode, prefix: string): TreeNode {
  if (!prefix) {
    return node;
  }
  const inner = (child: TreeNode) => prefixNode(child, prefix);
  return {
    ...node,
    path: `${prefix}/${node.path}`,
    children: node.children?.map(inner),
    ...(node.trash ? { trash: node.trash.map(inner) } : {})
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

// The setting names one folder, as it always has, or a list of them, each from the
// workspace root. A folder outside the workspace is passed over, and so is one that is a
// folder listed before it, lies inside one or holds one, so no file is shown twice.
function resolveRoots(): { workspace: vscode.Uri | undefined; roots: Root[] } {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return { workspace: undefined, roots: [] };
  }
  const setting = vscode.workspace.getConfiguration("docsPanel", folder.uri).get<unknown>("folder");
  const listed = (Array.isArray(setting) ? setting : [setting ?? "docs"]).filter(
    (value): value is string => typeof value === "string"
  );
  const roots: Root[] = [];
  for (const value of listed.length ? listed : ["docs"]) {
    const parts = value.split(/[\\/]/).filter((part) => part.length > 0 && part !== ".");
    if (parts.includes("..")) {
      continue;
    }
    const rel = parts.join("/");
    if (roots.some((root) => overlaps(root.rel, rel))) {
      continue;
    }
    const uri = parts.length ? vscode.Uri.joinPath(folder.uri, ...parts) : folder.uri;
    roots.push({ uri, rel, label: uri.fsPath });
  }
  return { workspace: folder.uri, roots };
}

// Whether one folder, by its path from the workspace, is the other or holds it.
function overlaps(a: string, b: string): boolean {
  return a === b || !a || !b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

// The state as written when every path in it was from the one docs folder there was,
// each path put behind that folder's path from the workspace.
function rebaseState(state: PanelState, prefix: string): PanelState {
  if (!prefix) {
    return state;
  }
  const move = (path: string) => (path ? `${prefix}/${path}` : prefix);
  const keyed = <T>(record: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [path, value] of Object.entries(record)) {
      out[move(path)] = value;
    }
    return out;
  };
  return {
    ...state,
    expanded: state.expanded.map(move),
    pinned: state.pinned.map(move),
    editing: state.editing.map(move),
    selected: state.selected === null ? null : move(state.selected),
    buckets: keyed(state.buckets),
    scrolls: keyed(state.scrolls)
  };
}

// A number, or a number written as text in a file edited by hand. Anything else, null
// included, which is what JSON makes of a number that was not one, is no number at all.
function numberOf(value: unknown): number {
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number(value)
    : NaN;
}

function normalizeState(value: any): PanelState {
  const split = numberOf(value?.split);
  const sideSplit = numberOf(value?.sideSplit);
  const textScale = numberOf(value?.textScale);
  const treeScale = numberOf(value?.treeScale);
  const lineHeight = numberOf(value?.lineHeight);
  const marksLinger = numberOf(value?.marksLinger);
  const marksReach = numberOf(value?.marksReach);
  const marksNear = numberOf(value?.marksNear);
  // Before there were rules, the levels were picked one by one, and none of them was off.
  const barLevels: number[] | null = Array.isArray(value?.barLevels)
    ? [1, 2, 3, 4, 5, 6].filter((level) => value.barLevels.includes(level))
    : null;
  const hoverStrength = numberOf(value?.hoverStrength);
  // One padding, before it was split in two, stands for both.
  const blockPad = numberOf(value?.blockPad);
  const blockPadY = numberOf(value?.blockPadY ?? blockPad);
  const blockPadX = numberOf(value?.blockPadX ?? blockPad);
  const autoMin = numberOf(value?.autoMin);
  const autoWidthMin = numberOf(value?.autoWidthMin);
  // A background only on or off, before it had a strength, is on at the tint it had.
  const bucketFill = typeof value?.bucketFill === "boolean"
    ? (value.bucketFill ? OLD_BUCKET_FILL : 0)
    : numberOf(value?.bucketFill);
  const mentionLines = numberOf(value?.mentionLines);
  const bucketHeadSize = numberOf(value?.bucketHeadSize);
  const dividerSize = numberOf(value?.dividerSize);
  const dividerWidth = numberOf(value?.dividerWidth);
  const dividerGap = numberOf(value?.dividerGap);
  const scrolls: Record<string, number> = {};
  for (const [path, ratio] of Object.entries(value?.scrolls ?? {}).slice(-MAX_SCROLLS)) {
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      scrolls[path] = Math.min(Math.max(ratio, 0), 1);
    }
  }
  return {
    split: Number.isFinite(split) ? split : DEFAULT_STATE.split,
    sideSplit: Number.isFinite(sideSplit) ? Math.min(Math.max(sideSplit, 0), 1) : DEFAULT_STATE.sideSplit,
    textScale: Number.isFinite(textScale) ? textScale : DEFAULT_STATE.textScale,
    treeScale: Number.isFinite(treeScale) ? treeScale : DEFAULT_STATE.treeScale,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : DEFAULT_STATE.lineHeight,
    mono: typeof value?.mono === "boolean" ? value.mono : DEFAULT_STATE.mono,
    // Before there were two lists to size, one switch sized the contents.
    autoSize: AUTO_SIZES.includes(value?.autoSize)
      ? value.autoSize
      : value?.tocAuto === true
        ? "toc"
        : DEFAULT_STATE.autoSize,
    autoMin: Number.isFinite(autoMin) ? Math.min(Math.max(Math.round(autoMin), 0), MAX_AUTO_MIN) : DEFAULT_STATE.autoMin,
    // Before it could only grow, the width was sized or not.
    autoWidth: AUTO_WIDTHS.includes(value?.autoWidth)
      ? value.autoWidth
      : value?.autoWidth === true
        ? "on"
        : DEFAULT_STATE.autoWidth,
    autoWidthMin: Number.isFinite(autoWidthMin)
      ? Math.min(Math.max(Math.round(autoWidthMin), 0), MAX_AUTO_MIN)
      : DEFAULT_STATE.autoWidthMin,
    showToc: typeof value?.showToc === "boolean" ? value.showToc : DEFAULT_STATE.showToc,
    tagSide: TAG_SIDES.includes(value?.tagSide) ? value.tagSide : DEFAULT_STATE.tagSide,
    hoverStrength: Number.isFinite(hoverStrength)
      ? Math.min(Math.max(hoverStrength, 0), 100)
      : DEFAULT_STATE.hoverStrength,
    blockPadY: Number.isFinite(blockPadY) ? Math.min(Math.max(Math.round(blockPadY), 0), 16) : DEFAULT_STATE.blockPadY,
    blockPadX: Number.isFinite(blockPadX) ? Math.min(Math.max(Math.round(blockPadX), 0), 16) : DEFAULT_STATE.blockPadX,
    mentionLines: Number.isFinite(mentionLines)
      ? Math.min(Math.max(Math.round(mentionLines), 0), 100)
      : DEFAULT_STATE.mentionLines,
    searchCase: typeof value?.searchCase === "boolean" ? value.searchCase : DEFAULT_STATE.searchCase,
    searchWord: typeof value?.searchWord === "boolean" ? value.searchWord : DEFAULT_STATE.searchWord,
    searchRegex: typeof value?.searchRegex === "boolean" ? value.searchRegex : DEFAULT_STATE.searchRegex,
    finderCase: typeof value?.finderCase === "boolean" ? value.finderCase : DEFAULT_STATE.finderCase,
    finderWord: typeof value?.finderWord === "boolean" ? value.finderWord : DEFAULT_STATE.finderWord,
    finderRegex: typeof value?.finderRegex === "boolean" ? value.finderRegex : DEFAULT_STATE.finderRegex,
    expanded: Array.isArray(value?.expanded) ? value.expanded.map(String) : [],
    pinned: Array.isArray(value?.pinned) ? value.pinned.map(String) : [],
    buckets: normalizeBuckets(value?.buckets),
    bucketOutline: typeof value?.bucketOutline === "boolean" ? value.bucketOutline : DEFAULT_STATE.bucketOutline,
    bucketFill: Number.isFinite(bucketFill) ? Math.min(Math.max(Math.round(bucketFill), 0), 100) : DEFAULT_STATE.bucketFill,
    bucketHeadTint: typeof value?.bucketHeadTint === "boolean" ? value.bucketHeadTint : DEFAULT_STATE.bucketHeadTint,
    bucketHeadBold: typeof value?.bucketHeadBold === "boolean" ? value.bucketHeadBold : DEFAULT_STATE.bucketHeadBold,
    bucketHead: BUCKET_HEADS.includes(value?.bucketHead) ? value.bucketHead : DEFAULT_STATE.bucketHead,
    bucketHeadStyle: BUCKET_HEAD_STYLES.includes(value?.bucketHeadStyle)
      ? value.bucketHeadStyle
      : DEFAULT_STATE.bucketHeadStyle,
    bucketHeadSize: Number.isFinite(bucketHeadSize)
      ? Math.min(Math.max(Math.round(bucketHeadSize), 50), 250)
      : DEFAULT_STATE.bucketHeadSize,
    dividerLabel: DIVIDER_LABELS.includes(value?.dividerLabel) ? value.dividerLabel : DEFAULT_STATE.dividerLabel,
    dividerAlign: DIVIDER_ALIGNS.includes(value?.dividerAlign) ? value.dividerAlign : DEFAULT_STATE.dividerAlign,
    dividerSize: Number.isFinite(dividerSize)
      ? Math.min(Math.max(Math.round(dividerSize), 50), 250)
      : DEFAULT_STATE.dividerSize,
    dividerBold: typeof value?.dividerBold === "boolean" ? value.dividerBold : DEFAULT_STATE.dividerBold,
    dividerCaps: typeof value?.dividerCaps === "boolean" ? value.dividerCaps : DEFAULT_STATE.dividerCaps,
    dividerColor: DIVIDER_COLORS.includes(value?.dividerColor) ? value.dividerColor : DEFAULT_STATE.dividerColor,
    dividerLine: DIVIDER_LINES.includes(value?.dividerLine) ? value.dividerLine : DEFAULT_STATE.dividerLine,
    dividerWidth: Number.isFinite(dividerWidth)
      ? Math.min(Math.max(Math.round(dividerWidth), 1), 4)
      : DEFAULT_STATE.dividerWidth,
    dividerGap: Number.isFinite(dividerGap)
      ? Math.min(Math.max(Math.round(dividerGap), 0), 32)
      : DEFAULT_STATE.dividerGap,
    tableAlign: TABLE_ALIGNS.includes(value?.tableAlign) ? value.tableAlign : DEFAULT_STATE.tableAlign,
    tableHead: TABLE_HEADS.includes(value?.tableHead) ? value.tableHead : DEFAULT_STATE.tableHead,
    refsScope: REF_SCOPES.includes(value?.refsScope) ? value.refsScope : DEFAULT_STATE.refsScope,
    marksMode: MARKS_MODES.includes(value?.marksMode)
      ? value.marksMode
      : barLevels && !barLevels.length
        ? "off"
        : DEFAULT_STATE.marksMode,
    marksRules: typeof value?.marksRules === "string"
      ? value.marksRules
      : barLevels && barLevels.length
        ? levelRules(barLevels)
        : DEFAULT_STATE.marksRules,
    marksLinger: Number.isFinite(marksLinger)
      ? Math.min(Math.max(Math.round(marksLinger), 100), 10000)
      : DEFAULT_STATE.marksLinger,
    marksReach: Number.isFinite(marksReach)
      ? Math.min(Math.max(Math.round(marksReach), 0), 1000)
      : DEFAULT_STATE.marksReach,
    marksNear: Number.isFinite(marksNear)
      ? Math.min(Math.max(Math.round(marksNear), 10), 400)
      : DEFAULT_STATE.marksNear,
    selected: typeof value?.selected === "string" ? value.selected : null,
    editing: Array.isArray(value?.editing) ? value.editing.map(String) : [],
    scrolls
  };
}

// Levels picked one by one written as a rule, each run of them as a range: 1, 2, 3 and 5
// are "h1-3h5".
function levelRules(levels: number[]): string {
  let out = "";
  for (let i = 0; i < levels.length; i++) {
    let end = i;
    while (end + 1 < levels.length && levels[end + 1] === levels[end] + 1) {
      end++;
    }
    out += "h" + levels[i] + (end > i ? "-" + levels[end] : "");
    i = end;
  }
  return out;
}

// A folder keeps its buckets only while it has a tag with one. Buckets laid down, one
// under another, before there was only a count to a row, are laid one to a row.
function normalizeBuckets(value: unknown): Record<string, Buckets> {
  const out: Record<string, Buckets> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return out;
  }
  for (const [path, raw] of Object.entries(value as Record<string, any>)) {
    const tags = Array.isArray(raw?.tags) ? [...new Set(raw.tags.map(String))] as string[] : [];
    if (!tags.length) {
      continue;
    }
    const perRow = raw?.flow === "column" ? 1 : numberOf(raw?.perRow);
    const spans: Record<string, number> = {};
    for (const [tag, span] of Object.entries(raw?.spans ?? {})) {
      const count = Math.round(Number(span));
      if (tags.includes(tag) && Number.isFinite(count) && count > 1) {
        spans[tag] = Math.min(count, MAX_PER_ROW);
      }
    }
    out[path] = {
      tags,
      perRow: Number.isFinite(perRow) ? Math.min(Math.max(Math.round(perRow), 1), MAX_PER_ROW) : 2,
      spans,
      ordered: raw?.ordered === true
    };
  }
  return out;
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
