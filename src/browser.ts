import * as vscode from "vscode";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import {
  addTaskBoxes,
  escapeHtml,
  extensionOf,
  HTML,
  IMAGES,
  MARKDOWN,
  renderMarkdown,
  stripAssets
} from "./render";

const PAGE_DIR = "docs-panel";

// Plain and readable in either scheme the browser is in; the panel's own look belongs to
// the panel, and the browser is where a file is read without it.
const PAGE_STYLE = `
:root { color-scheme: light dark; }
body { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px;
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
pre { padding: 10px 12px; overflow: auto; border-radius: 4px; line-height: 1.45;
  background: rgba(128, 128, 128, 0.09); border: 1px solid rgba(128, 128, 128, 0.25); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
:not(pre) > code { padding: 0.1em 0.35em; border-radius: 3px; background: rgba(128, 128, 128, 0.14); }
table { border-collapse: collapse; }
table + table { margin-top: 1em; }
th, td { padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.35); }
blockquote { margin: 1em 0; padding: 0.4em 1em; border-left: 3px solid rgba(128, 128, 128, 0.5); }
h1, h2 { padding-bottom: 0.2em; border-bottom: 1px solid rgba(128, 128, 128, 0.25); }
body > pre { white-space: pre-wrap; }
`;

// A browser is whatever the system opens a web page with, so every file goes out as one:
// a page as it is, anything else as a page written for it beside the system's temp files.
export async function openInBrowser(root: vscode.Uri, relPath: string): Promise<void> {
  const uri = vscode.Uri.joinPath(root, ...relPath.split("/"));
  if (uri.scheme !== "file" || vscode.env.remoteName) {
    throw new Error("only files on this machine can be opened in a browser");
  }
  const ext = extensionOf(relPath);
  const target = HTML.has(ext) ? uri : await writePage(uri, relPath, ext);
  if (!(await vscode.env.openExternal(target))) {
    throw new Error("the system did not open it");
  }
}

async function writePage(uri: vscode.Uri, relPath: string, ext: string): Promise<vscode.Uri> {
  const name = relPath.split("/").pop() ?? relPath;
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<base href="${escapeHtml(vscode.Uri.joinPath(uri, "..").toString())}/">
<title>${escapeHtml(name)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${await bodyOf(uri, ext)}
</body>
</html>
`;
  // The page is named after the file's whole path, so two files sharing a name never
  // overwrite one another's page.
  const dir = path.join(tmpdir(), PAGE_DIR);
  const file = path.join(dir, relPath.replace(/[\\/:*?"<>|]/g, "_") + ".html");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, page, "utf8");
  return vscode.Uri.file(file);
}

// Relative links and pictures are left as they were written: the page's base is the
// file's own folder, so the browser resolves them against the real files.
async function bodyOf(uri: vscode.Uri, ext: string): Promise<string> {
  if (IMAGES.has(ext)) {
    return `<img src="${escapeHtml(uri.toString())}" alt="">`;
  }
  const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  const html = MARKDOWN.has(ext) ? await renderMarkdown(text) : undefined;
  return html === undefined ? `<pre>${escapeHtml(text)}</pre>` : stripAssets(addTaskBoxes(html));
}
