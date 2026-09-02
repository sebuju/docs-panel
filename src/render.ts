import * as vscode from "vscode";

export type ContentKind = "md" | "img" | "text";

export interface Content {
  path: string;
  kind: ContentKind;
  html?: string;
  uri?: string;
  text?: string;
}

const MARKDOWN = new Set([".md", ".markdown"]);
const IMAGES = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);

export async function renderFile(
  root: vscode.Uri,
  relPath: string,
  webview: vscode.Webview
): Promise<Content> {
  const uri = vscode.Uri.joinPath(root, ...relPath.split("/"));
  const ext = extensionOf(relPath);

  if (IMAGES.has(ext)) {
    return { path: relPath, kind: "img", uri: webview.asWebviewUri(uri).toString() };
  }

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

  return { path: relPath, kind: "text", html: `<pre>${escapeHtml(text)}</pre>`, text };
}

async function renderMarkdown(text: string): Promise<string | undefined> {
  try {
    await vscode.extensions.getExtension("vscode.markdown-language-features")?.activate();
    const html = await vscode.commands.executeCommand<string>("markdown.api.render", text);
    return typeof html === "string" ? html : undefined;
  } catch {
    return undefined;
  }
}

// Anything markdown-language-features and its companion extensions contribute to the
// preview's head - mermaid, katex, and whatever ships next - arrives inline in the
// rendered string. This panel renders document text only, so every asset element is
// dropped wherever it sits. The content elements are then the whole of the output.
function stripAssets(html: string): string {
  return html
    .replace(/<(style|script|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:link|meta|base)\b[^>]*>/gi, "")
    .replace(/^\s+/, "");
}

// The built-in renderer leaves "[x]" as literal text, so the checkbox is added here.
function addTaskBoxes(html: string): string {
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

function extensionOf(path: string): string {
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
