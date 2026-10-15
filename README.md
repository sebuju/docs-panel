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
| Tag a file | `+` in the file bar, or **Tags…** in the tree's menu; type to find or add a tag |
| Colour a file or folder | **Colour…** in the tree's menu |
| Pin a file or folder | **Pin to top** in the tree's menu |
| Open in a browser | **Open in browser** in a file's menu in the tree |
| Find in the page | `Ctrl+F` |
| Search all docs | `Ctrl+F` twice with `Ctrl` held, or the search button above the tree |
| Options | The sliders button above the tree |
| Trash a file | Bin button in the file bar; the trash shows at the foot of the tree, and each folder lists what was trashed from it |
| Move the divider | Drag it; the position is remembered |

## Search all docs

The search looks at the names of files and folders and at the text of every file, and
lists what it finds by file, one line per row. A file or folder whose name matches is
listed even when nothing inside it does.

| Key | Does |
|---|---|
| `Up` / `Down` | Pick the previous or next row |
| `Ctrl+Up` / `Ctrl+Down` | Jump to the previous or next file |
| `Enter` | Open the file at that line, or show the folder in the tree |
| `Escape` | Close the search and go back to the file that was open |

## Options

The options hold the reading settings, the tags (colour, rename, delete), and the data
files the panel writes, each with its size and a button to purge it.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `docsPanel.folder` | `docs` | Folder, relative to the workspace root, that the panel shows |

The setting has resource scope, so a project can override it in its own
`.vscode/settings.json`.

## Tags and colours

Tags and colours are stored in `<docs folder>/.docs-panel.json`, so they travel with the
documents. The colours are the theme's own, so they follow the theme in use. Each entry
carries a content hash: a file moved outside the panel keeps its tags and colour, an
ambiguous match is dropped rather than guessed, and a trashed file keeps its entry until
it is deleted for good.

## Releasing

Raise the version in `package.json` (`npm version <x.y.z> --no-git-tag-version`), write
the notes to `.github/releases/v<x.y.z>.md`, and merge to `master`. The release workflow
builds the `.vsix`, tags the commit, and publishes the release with the notes; without a
notes file GitHub writes them from the commits.

## Limits

- Markdown is rendered by VS Code's built-in renderer. Extensions that add drawing to the
  preview, such as mermaid and katex, do not run here.
- Links to files outside the docs folder are inert.
- **Open in browser** works for files on the local machine only, not in a remote window.
