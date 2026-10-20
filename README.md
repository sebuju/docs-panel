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
| Follow a link | Click a Markdown link to another file, or a file named in the text: a file of the docs opens in the panel, any other file of the workspace in an editor |
| Go back or forward | The mouse's back and forward buttons walk the files opened, as in a browser |
| Jump to a heading | Click it in the contents list on the right |
| Zoom a picture | Click it; scroll to zoom, drag to pan, `0` to fit, `Escape` to close |
| Edit a file | Pen button in the file bar, lit while editing, then `Ctrl+S`; a file left in edit mode opens in it again |
| Tag a file | `+` in the file bar, `Ctrl`+click it in the tree, or **Tags…** in the tree's menu; type to find or add a tag |
| Search by a tag | Click the tag in the tree; with the search up it takes the place of the tag searched for, and with `Shift` held it is added to them |
| Colour a file or folder | **Colour…** in the tree's menu |
| Pin a file or folder | **Pin to top** in the tree's menu; a pinned file's pin takes the place of its dot |
| Sort a folder's files into tag buckets | **Tag buckets…** in a folder's menu; see below |
| Open in a browser | **Open in browser** in a file's menu in the tree |
| Find in the page | `Ctrl+F`, which starts from the selected text if there is any; `Up` / `Down` or `Enter` / `Shift+Enter` step through the hits |
| Find a word | Right click it in the page: **Find “word”**, or **Find “word” in all docs** |
| Step through a Markdown file | `Up` / `Down` light the next or previous block and scroll it into view |
| Search all docs | `Ctrl+F` twice with `Ctrl` held, or the search button in the tree's top right corner (shown while the pointer is in that corner) |
| Options | The sliders button in the tree's top right corner |
| Trash a file | Bin button in the file bar; the trash shows at the foot of the tree, and each folder lists what was trashed from it, along with anything in a `.trash` folder of its own |
| Empty the trash | Right click a trash folder: **Restore all** or **Delete all** |
| Move the divider | Drag it; the position is remembered |
| Come back to a file | Each file opens where it was left, as a share of the way down, so an edited file opens near the same place |
| Size a list to fit | Right click the divider between the files and the toc: auto size the files, the toc, or neither |
| Hide the toc | Right click the divider between the files and the toc: **Show toc**; it comes back from the options |
| Size the side to fit | Right click the divider between the side and the page: auto size the side's width to the files, auto size it only growing, or neither. While it is auto sized the divider is not dragged; only growing, a click on it fits the side to the files again |

## Keys in the tree

With the tree focused (click it, or `Tab` to it):

| Key | Does |
|---|---|
| `Up` / `Down` | Move to the previous or next row; a file you stop on opens |
| `Right` | On a closed folder, open it; on an open one, go to its first entry; on a Markdown file, go into the page at its first block; on any other file, go into the page so `Up` / `Down` scroll it |
| `Left` | On an open folder, close it; otherwise go up to the folder holding the row |
| `Space`, `Shift+F10` or the menu key | Open the row's menu: `Up` / `Down` pick, `Enter` runs, `Escape` closes; the focus comes back to the tree either way |

In a file being read (not edited), `Left` goes back to the tree at the row you left. In
a Markdown file, `Right` from there comes back to the block you were on.

## Search all docs

The search looks at the names of files and folders and at the text of every file, and
lists what it finds by file, one line per row. A file or folder whose name matches is
listed even when nothing inside it does.

Start the search with a scope to look only in some files:

| Search | Looks in |
|---|---|
| `tag:plan storage` | Files with a tag whose name holds `plan`, grouped by tag |
| `file:road storage` | Files whose name holds `road` |
| `folder:plans storage` | Files in a folder whose name holds `plans`, grouped by folder |

Several names are split by commas, with or without spaces around them, and a file is let
in by any of them: `tag:plan, draft storage` searches the files tagged with either for
`storage`, and `file:road,ideas` lists the files whose name holds either. An empty name
among others, as in `tag:plan,,draft` or a comma at the end, is left out.

With nothing after the names, the search lists every file the scope lets in. A name with
a space or a comma in it is quoted: `tag:"to do"`.

| Key | Does |
|---|---|
| `Up` / `Down` | Pick the previous or next row |
| `Ctrl+Up` / `Ctrl+Down` | Jump to the previous or next file |
| `Enter` | Open the file at that line, or show the folder in the tree |
| `Escape` | Close the search and go back to the file that was open |

## Options

The options hold the reading settings (text size, line spacing, font, whether the
contents list shows, which list's height is auto sized and the least share of the side
the other list keeps, whether the side's width is auto sized and whether only to grow,
how strongly the Markdown block under the pointer is lit, where off turns the light off,
how far the light reaches past the block above and below it and either side of it, and
how many of a file's mentions show before **Show more**, where off turns the mentions
off), the tree's (its own text size, which side of a name the tags are drawn on, and
whether tag buckets are outlined and tinted in their tag's colour, and whether a
bucket's heading stands inside its box or over it, drawn as the tag's pill, as a bar of
its colour across the top, or as the plain name), the tags, and the data
files the panel writes, each with its size and a button to purge it.

Each tag is a row: its letters, which open a menu for its colour and its letters; its
name, which renames it when clicked; its style, any of bold, italic, underline, white
text and square corners, and one or two characters to put the name between (`[]` draws
`[plan]`); and **Delete**. Drag a row to move the tag: every list of tags, in the tree,
the file bar, the tag picker and the search, follows this order. **Prune**, under the
tags, removes the tags no file has, and shows only while there are some; with the pointer
on it the tags it would remove are marked.

## Tag buckets

**Tag buckets…** in a folder's menu picks the tags that have a bucket in that folder. The
buckets stand at the head of the folder, in the order of the tags, each headed by its tag
and ringed in its colour. A file directly in the folder goes in the bucket of the first of
its tags, in that order, that has one; it shows there without its tags, which the file bar
still shows, and pinned files come first. The folder's other files follow the buckets as
usual.

| Drag a file | Does |
|---|---|
| From one bucket to another | Takes off the first bucket's tag and puts on the second's |
| From a bucket to the folder's other files | Takes off the bucket's tag |
| From the folder's other files to a bucket | Puts on the bucket's tag |
| From another folder to a bucket | Moves the file into the folder and puts on the bucket's tag |

Under the tags the picker sets the layout: **Across**, so many buckets to a row, each as
wide as the others and as tall as the tallest in its row, or **Down**, one under another.
The buckets and their layout are kept for each folder, and follow it when it is renamed
or moved.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `docsPanel.folder` | `docs` | Folder, relative to the workspace root, that the panel shows |

The setting has resource scope, so a project can override it in its own
`.vscode/settings.json`.

## Tags and colours

Tags and colours are stored in `<docs folder>/.docs-panel.json`, so they travel with the
documents. The panel looks at the file's time stamp every second and a half and reads it
again when it has moved, so a change made outside the panel shows in the tree. The colours of files and folders are the theme's own, so they follow the theme
in use; a tag's colours are the panel's own, the same in every theme, and each is light
enough for the black text on a pill to read at 7:1 or better.

Where a row has no room for its tags beside the file's name, its pills show the tags'
letters instead, each pill as wide as its letters. Every tag gets letters of its own when
it is made: the first letter of each word, lengthened while another tag already has them
(`plan` is `p`, then `priority` is `pr`). The options show them at the head of each tag's row;
click them and **Change letters…** to choose others, which no other tag may have.

Each entry
carries a content hash: a file moved outside the panel keeps its tags and colour, an
ambiguous match is dropped rather than guessed, and a trashed file keeps its entry until
it is deleted for good.

## Releasing

Raise the version in `package.json` (`npm version <x.y.z> --no-git-tag-version`), write
the notes to `.github/releases/v<x.y.z>.md`, and merge to `master`. The release workflow
builds the `.vsix`, tags the commit, and publishes the release with the notes; without a
notes file GitHub writes them from the commits.

## Screenshots

`tools/screenshots` renders the panel in Chromium without VS Code and takes a set of
screenshots of it, or of a committed version and the working tree side by side; see its
README.

## Limits

- Markdown is rendered by VS Code's built-in renderer. Extensions that add drawing to the
  preview, such as mermaid and katex, do not run here.
- Markdown links to files outside the docs folder are inert; a file of the workspace named
  in the text, such as `src/panel.ts`, is a link. What each page's names lead to is kept in
  `.vscode/docs-panel-links.json` and looked up again once the page or the list of docs
  changes.
- **Open in browser** works for files on the local machine only, not in a remote window.
