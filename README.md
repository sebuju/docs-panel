# Docs Panel

Read a project's `docs` folder inside VS Code as one editor tab: a folder tree on the
left, the picked file rendered on the right, both refreshing themselves when files change
on disk.

## Install

Download the `.vsix` from the releases page, or build it yourself:

```sh
npm install
npx @vscode/vsce package
code --install-extension docs-panel-0.1.0.vsix
```

Then run **Docs Panel: Open** from the command palette.

## Use

| Action | How |
|---|---|
| Open a file | Click it in the tree |
| Follow a link | Click a Markdown link to another file |
| Jump to a heading | Click it in the contents list on the right |
| Zoom a picture | Click it; scroll to zoom, drag to pan, `0` to fit, `Escape` to close |
| Edit a file | Pen button in the file bar, then `Ctrl+S` |
| Set a status | The pill in the file bar: planned, in progress, done, stale |
| Trash a file | Bin button in the file bar; the bin above the tree shows the trash |
| Move the divider | Drag it; the position is remembered |

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `docsPanel.folder` | `docs` | Folder, relative to the workspace root, that the panel shows |

The setting has resource scope, so a project can override it in its own
`.vscode/settings.json`.

## Statuses

Statuses are stored in `<docs folder>/.docs-panel.json`, so they travel with the
documents. Each entry carries a content hash: a file moved outside the panel keeps its
status, an ambiguous match is dropped rather than guessed, and a trashed file keeps its
entry until it is deleted for good.

## Limits

- Markdown is rendered by VS Code's built-in renderer. Extensions that add drawing to the
  preview, such as mermaid and katex, do not run here.
- Links to files outside the docs folder are inert.
