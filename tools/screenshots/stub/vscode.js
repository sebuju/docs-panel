// Just enough of the vscode module, backed by node's fs, to run the tree walk, the corpus
// and the page template outside the editor.
const fs = require("fs");
const p = require("path");
class Uri {
  constructor(path) { this.path = path; this.fsPath = path; this.scheme = "file"; }
  static file(f) { return new Uri(f); }
  static joinPath(u, ...parts) { return new Uri(p.posix.join(u.path, ...parts)); }
  toString() { return "file://" + this.path; }
}
const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 };
const noop = () => ({ dispose() {} });
const workspace = {
  fs: {
    readDirectory: async (u) => fs.readdirSync(u.path, { withFileTypes: true }).map((d) => [d.name, d.isDirectory() ? 2 : 1]),
    stat: async (u) => { const s = fs.statSync(u.path); return { mtime: s.mtimeMs, ctime: s.ctimeMs, size: s.size, type: s.isDirectory() ? 2 : 1 }; },
    readFile: async (u) => new Uint8Array(fs.readFileSync(u.path)),
    writeFile: async (u, b) => fs.writeFileSync(u.path, b),
    rename: async (a, b) => { if (fs.existsSync(b.path)) throw new Error("exists"); fs.renameSync(a.path, b.path); },
    delete: async (u) => fs.rmSync(u.path, { recursive: true }),
    createDirectory: async (u) => fs.mkdirSync(u.path, { recursive: true }),
    copy: async (a, b) => fs.cpSync(a.path, b.path, { recursive: true })
  },
  getConfiguration: () => ({ get: (k, d) => d }),
  workspaceFolders: [],
  onDidChangeConfiguration: noop,
  onDidChangeWorkspaceFolders: noop,
  createFileSystemWatcher: () => ({ onDidCreate: noop, onDidChange: noop, onDidDelete: noop, dispose() {} })
};
class Disposable { constructor(f) { this.f = f; } dispose() { this.f && this.f(); } }
class RelativePattern { constructor(a, b) { this.a = a; this.b = b; } }
module.exports = {
  Uri, FileType, workspace, Disposable, RelativePattern,
  window: { showErrorMessage(m) { console.log("ERROR", m); }, showWarningMessage: async (m, o, b) => b, showInputBox() {} },
  commands: { executeCommand: async () => undefined },
  ViewColumn: { Active: -1 },
  env: {}
};
