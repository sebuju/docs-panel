import * as vscode from "vscode";
import { closeTableGaps, restoreLines } from "./tables";

export type ContentKind = "md" | "html" | "img" | "text";

export interface Content {
  path: string;
  kind: ContentKind;
  html?: string;
  uri?: string;
  text?: string;
  created?: number;
  modified?: number;
}

export const MARKDOWN = new Set([".md", ".markdown"]);
export const IMAGES = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);
export const HTML = new Set([".html", ".htm"]);

// Rendering goes through the Markdown extension, in the same busy process as every other
// extension, and a long file takes a while; the pages shown lately are kept, each as long
// as the file's time and size are what they were, the newest last and the oldest dropped.
const MAX_RENDERED = 40;
const MAX_RENDERED_CHARS = 40_000_000;
const rendered = new Map<string, { stamp: string; content: Content; chars: number }>();
let renderedChars = 0;

function keep(key: string, stamp: string, content: Content): Content {
  const chars = (content.html?.length ?? 0) + (content.text?.length ?? 0);
  forget(key);
  rendered.set(key, { stamp, content, chars });
  renderedChars += chars;
  for (const [old] of rendered) {
    if (rendered.size <= MAX_RENDERED && renderedChars <= MAX_RENDERED_CHARS) {
      break;
    }
    forget(old);
  }
  return content;
}

// A file rewritten by the panel itself can keep its size and, on a coarse clock, its time,
// so what was kept of it is dropped and the next render reads it again.
export function forgetRendered(root: vscode.Uri, relPath: string): void {
  const uri = vscode.Uri.joinPath(root, ...relPath.split("/")).toString();
  for (const key of [...rendered.keys()]) {
    if (key.endsWith("|" + uri)) {
      forget(key);
    }
  }
}

function forget(key: string): void {
  const entry = rendered.get(key);
  if (entry) {
    renderedChars -= entry.chars;
    rendered.delete(key);
  }
}

export async function renderFile(
  root: vscode.Uri,
  relPath: string,
  webview: vscode.Webview
): Promise<Content> {
  const uri = vscode.Uri.joinPath(root, ...relPath.split("/"));
  const ext = extensionOf(relPath);
  const { size, ...stamps } = await stampsOf(uri);

  if (IMAGES.has(ext)) {
    return { path: relPath, kind: "img", uri: webview.asWebviewUri(uri).toString(), ...stamps };
  }

  // The links a page is written with depend on the webview, so the key holds that too.
  const key = webview.cspSource + "|" + uri.toString();
  const stamp = `${stamps.modified}:${size}`;
  const kept = size === undefined ? undefined : rendered.get(key);
  if (kept && kept.stamp === stamp) {
    keep(key, stamp, kept.content);
    return { ...kept.content, ...stamps };
  }
  const content = await readAndRender(root, uri, relPath, ext, webview);
  // A page the Markdown extension failed to render, shown as text, is not kept.
  const fallback = MARKDOWN.has(ext) && content.kind !== "md";
  return size === undefined || content.text === undefined || fallback
    ? { ...content, ...stamps }
    : { ...keep(key, stamp, content), ...stamps };
}

async function readAndRender(
  root: vscode.Uri,
  uri: vscode.Uri,
  relPath: string,
  ext: string,
  webview: vscode.Webview
): Promise<Content> {
  let text: string;
  try {
    text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return {
      path: relPath,
      kind: "text",
      html: `<pre>${escapeHtml("Cannot read " + relPath)}</pre>`
    };
  }

  if (MARKDOWN.has(ext)) {
    const html = await renderMarkdown(text);
    if (html !== undefined) {
      return {
        path: relPath,
        kind: "md",
        html: stripAssets(addTaskBoxes(rewriteLinks(html, root, relPath, webview))),
        text
      };
    }
  }

  if (HTML.has(ext)) {
    return {
      path: relPath,
      kind: "html",
      html: stripAssets(rewriteLinks(bodyOf(text), root, relPath, webview)),
      text
    };
  }

  return { path: relPath, kind: "text", html: `<pre>${escapeHtml(text)}</pre>`, text };
}

async function stampsOf(uri: vscode.Uri): Promise<Pick<Content, "created" | "modified"> & { size?: number }> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return { created: stat.ctime, modified: stat.mtime, size: stat.size };
  } catch {
    return {};
  }
}

// The page is shown inside the panel's own document, so only what a body may hold is kept.
function bodyOf(html: string): string {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  const inner = body ? body[1] : html.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i, "");
  return inner.replace(/<\/?(?:html|body|head)\b[^>]*>/gi, "");
}

export async function renderMarkdown(text: string): Promise<string | undefined> {
  try {
    await vscode.extensions.getExtension("vscode.markdown-language-features")?.activate();
    const closed = closeTableGaps(text);
    const html = await vscode.commands.executeCommand<string>("markdown.api.render", closed.text);
    return typeof html === "string" ? restoreLines(html, closed.lines) : undefined;
  } catch {
    return undefined;
  }
}

// Anything markdown-language-features and its companion extensions contribute to the
// preview's head - mermaid, katex, and whatever ships next - arrives inline in the
// rendered string. This panel renders document text only, so every asset element is
// dropped wherever it sits. The content elements are then the whole of the output.
export function stripAssets(html: string): string {
  return html
    .replace(/<(style|script|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:link|meta|base)\b[^>]*>/gi, "")
    .replace(/^\s+/, "");
}

// The built-in renderer leaves "[x]" as literal text, so the checkbox is added here.
export function addTaskBoxes(html: string): string {
  return html.replace(
    /<li([^>]*)>(\s*(?:<p>)?\s*)\[([ xX])\]\s+/g,
    (_match, attrs: string, lead: string, mark: string) =>
      `<li${attrs}>${lead}<input type="checkbox" disabled${mark === " " ? "" : " checked"}> `
  );
}

// A webview cannot load the renderer's relative src, and cannot follow its relative href;
// both are resolved here so the page never has to know about paths.
function rewriteLinks(
  html: string,
  root: vscode.Uri,
  relPath: string,
  webview: vscode.Webview
): string {
  const dir = relPath.split("/").slice(0, -1);

  const withImages = html.replace(/src="([^"]+)"/g, (match, src: string) => {
    const target = resolveRelative(dir, src);
    return target ? `src="${webview.asWebviewUri(vscode.Uri.joinPath(root, ...target)).toString()}"` : match;
  });

  return withImages.replace(/href="([^"]+)"/g, (match, href: string) => {
    const target = resolveRelative(dir, href);
    return target ? `href="#" data-open="${escapeHtml(target.join("/"))}"` : match;
  });
}

// Returns the path segments relative to the root, or undefined when the value is not
// a relative reference we own.
function resolveRelative(dir: string[], value: string): string[] | undefined {
  if (/^(https?:|data:|mailto:|vscode-|file:|#|\/\/|\/)/i.test(value)) {
    return undefined;
  }
  const clean = value.split(/[?#]/)[0];
  if (!clean) {
    return undefined;
  }
  const resolved: string[] = [];
  for (const part of [...dir, ...clean.split("/")]) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (resolved.length === 0) {
        return undefined;
      }
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.length ? resolved : undefined;
}

export function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
