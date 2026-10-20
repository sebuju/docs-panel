// Builds the panel's page outside the editor, from a checkout's own template, script and
// stylesheet, with a stand-in for the extension host that answers the page's messages
// from the fixture in this folder.
//
//   node build.js <checkout> <out.html> [theme] [font] [stateJSON]
const fs = require("fs");
const path = require("path");
const themes = require("./themes");

const HERE = __dirname;
const esbuild = require(path.join(HERE, "../../node_modules/esbuild"));

const FONT = "system-ui, 'Ubuntu', 'Droid Sans', sans-serif";

async function build(repo, out, themeName = "dark-modern", font = FONT, state = {}) {
  repo = path.resolve(repo);
  const bundle = path.join(HERE, "out", ".build", repo.replace(/[^\w]+/g, "_") + ".js");
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  const entry = ["panel", "tree", "corpus"]
    .map((name) => `export * from ${JSON.stringify(path.join(repo, "src", name))};`)
    .join("\n");
  await esbuild.build({
    stdin: { contents: entry, resolveDir: HERE, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundle,
    logLevel: "error",
    alias: { vscode: path.join(HERE, "stub/vscode.js") }
  });
  delete require.cache[bundle];
  const { DocsPanel, buildTree, Corpus } = require(bundle);
  const { Uri } = require("./stub/vscode.js");

  const fake = {
    panel: { webview: { cspSource: "", asWebviewUri: (u) => "file://" + u.path } },
    context: { extensionUri: Uri.file(repo) }
  };
  let html = DocsPanel.prototype.html.call(fake);
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");

  const docs = Uri.file(path.join(HERE, "fixture/docs"));
  const prefix = (n) => ({ ...n, path: ".trash/" + n.path, children: n.children && n.children.map(prefix) });
  const tree = await buildTree(docs, true);
  const trash = (await buildTree(Uri.joinPath(docs, ".trash"), false)).map(prefix);
  const corpus = await new Corpus().collect(docs, tree);
  const fixture = JSON.parse(fs.readFileSync(path.join(HERE, "fixture/marks.json"), "utf8"));
  const fullState = Object.assign(
    {
      split: 300, sideSplit: 0.62, textScale: 1, lineHeight: 1, mono: false, autoSize: "none",
      autoWidth: "off", tagSide: "right", hoverStrength: 40,
      expanded: ["plans", "notes"], pinned: [], selected: "plans/roadmap.md"
    },
    state
  );
  const theme = themes[themeName];
  const vars = Object.assign({}, theme.vars, { "font-family": font });
  const style = Object.entries(vars).map(([k, v]) => `--vscode-${k}: ${v};`).join(" ");
  const host = {
    tree: { type: "tree", nodes: tree, trash, pinned: fullState.pinned, root: "docs", name: "docs" },
    marks: { type: "marks", ...fixture.marks },
    contents: fixture.contents,
    corpus: { type: "corpus", entries: corpus },
    dataFiles: { type: "dataFiles", files: fixture.dataFiles },
    state: { type: "state", ...fullState },
    version: { type: "version", version: JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version }
  };
  // What the page sends is kept in window.__sent, so a scene can check it. The few
  // messages that change the marks are answered the way the host would answer them.
  const mock = `<script>
window.__host = ${JSON.stringify(host)};
window.__sent = [];
window.acquireVsCodeApi = () => ({
  getState: () => null, setState: () => {},
  postMessage: (m) => {
    window.__sent.push(m);
    const h = window.__host, post = (x) => window.postMessage(x, "*");
    const content = (p) => Object.assign({ type: "content", path: p, kind: "md", text: "", created: 1760000000000, modified: 1760500000000 }, h.contents[p] || { html: "<h1>" + p + "</h1><p>Some text.</p>" });
    if (m.type === "ready") { post(h.state); post(h.version); post(h.tree); post(h.marks); post({ type: "reads", reads: ["README.md"] }); if (h.state.selected) post(content(h.state.selected)); }
    else if (m.type === "open") post(content(m.path));
    else if (m.type === "corpus") post(h.corpus);
    else if (m.type === "dataFiles") post(h.dataFiles);
    else if (m.type === "pruneTags") {
      const used = new Set([].concat(...Object.values(h.marks.tags)));
      for (const name of Object.keys(h.marks.tagColors)) if (!used.has(name)) delete h.marks.tagColors[name];
      post(h.marks);
    }
  }
});
</script>`;
  html = html
    .replace('<html lang="en">', `<html lang="en" style="${style}">`)
    .replace("<body>", `<body class="${theme.kind}" data-vscode-theme-kind="${theme.kind}">`)
    .replace(/<script nonce/, mock + "\n<script nonce")
    // A stand-in for the focus ring the editor's own webview styles give focused boxes.
    .replace("<head>", "<head>\n<style>:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }</style>");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

module.exports = { build, FONT };

if (require.main === module) {
  const [repo, out, theme, font, state] = process.argv.slice(2);
  build(repo, out, theme, font || FONT, state ? JSON.parse(state) : {}).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
