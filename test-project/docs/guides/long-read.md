# Long Read

A deliberately long file. It exists so the reading pane, the scrollbar and the table of
contents can be judged with a real amount of text instead of three lines.

## 1. Why length matters

A short file hides problems. A long file shows them at once: whether the line length is
comfortable, whether headings breathe, whether the table of contents stays usable once it
holds more entries than the window is tall.

Read a paragraph of it. If the eye has to travel too far to find the start of the next
line, the measure is too wide. If the text feels cramped against the divider, the padding
is too small. Both are worth knowing before a real document is written.

### 1.1 Scrolling

The reading pane owns the scrollbar, not the page. The tree on the left scrolls on its
own. Neither should move the other. Scroll this file to the bottom and check that the
tree stayed exactly where it was.

### 1.2 The table of contents

Every heading in this file appears in the list on the right. Deeper headings sit further
in and fade slightly, so the shape of the document is readable at a glance without any
labels. Click one and the reading pane jumps to it.

There are six levels below. That is the worst case, and it is here on purpose.

## 2. Formatting

### 2.1 Emphasis

Text can be *slanted*, **heavy**, or ***both at once***. It can be ~~struck through~~.
Inline `code` should sit on a tinted background and use the editor font, not the
interface font.

### 2.2 Lists

An ordered list:

1. First step.
2. Second step, which is long enough to wrap onto a second line so the hanging indent can
   be checked against the number in front of it.
3. Third step.
   1. A nested step.
   2. Another nested step.

An unordered list:

- A point.
- A longer point, again long enough to wrap, so the bullet alignment is visible when the
  text runs past the end of the line and continues underneath.
  - A nested point.
    - A point nested twice.
- A final point.

A task list:

- [x] Written
- [x] Rendered
- [ ] Reviewed

### 2.3 Quotes

> A quoted paragraph. It should be set apart from the body text by a bar down the left
> side and a change in colour.
>
> > A quote inside a quote, which is rarer but should still be legible.

### 2.4 Code

A fenced block with a language:

```ts
export interface TreeNode {
  path: string;
  name: string;
  dir: boolean;
  children?: TreeNode[];
}

export function count(nodes: TreeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += node.dir ? count(node.children ?? []) : 1;
  }
  return total;
}
```

A block with a very long line, to prove the block scrolls sideways instead of forcing the
whole page to:

```sh
node --experimental-vm-modules ./scripts/build.js --target=node20 --outfile=dist/extension.js --sourcemap --minify --external:vscode --log-level=info
```

A block with no language:

```
plain text inside a fence
    indented second line
```

### 2.5 Tables

| Part | File | Runs in | Notes |
|---|---|---|---|
| Activation | `src/extension.ts` | Host | Registers the command and the serializer. |
| Panel | `src/panel.ts` | Host | Owns the webview, the message loop and the shell. |
| Walk | `src/tree.ts` | Host | Depth capped at twelve, dot folders skipped. |
| Render | `src/render.ts` | Host | Markdown, images, plain text, link rewriting. |
| Watch | `src/watch.ts` | Host | One debounce timer at 120 ms. |
| Page | `media/main.js` | Webview | Tree, splitter, editor, zoom, contents. |

### 2.6 Pictures

A picture in the middle of the text. Click it and it should fill the window without being
squashed:

![Wide banner](../img/wide.png)

And a small one, which should stay small until it is clicked:

![Green square](../img/green.png)

## 3. Filler

The rest of this file is plain prose. Its only job is to be long.

Reading software is judged on the boring parts. Headings and pictures get the attention,
but most of the time spent in a document is spent on paragraphs like this one, moving
steadily down the page. If the line height is wrong here, no amount of polish elsewhere
will fix the feeling.

A good measure is somewhere near seventy characters. Wider than that and the return
sweep starts to miss, which is felt as tiredness rather than noticed as a fault. The
reading pane has no maximum width yet, so on a wide window this text will run further
than is comfortable. That is a real observation, not a defect to fix today.

Vertical rhythm matters as much. The gap above a heading should be clearly larger than
the gap below it, so a heading binds to the text it introduces rather than floating
between two blocks. Check that here by scrolling slowly.

Colour is the third part. Body text should not be pure white on pure black; both the
editor theme and this panel take their colours from the same variables, so the page will
follow whatever theme is active. Switch the theme with the panel open and the text, the
borders and the icons should all change together.

### 3.1 A deeper section

Nesting exists so a document can be skimmed by shape alone. A reader who knows nothing
about the content can still tell, from the table of contents, that this section belongs
inside the previous one.

#### 3.1.1 Fourth level

Four levels deep is where most documents stop. It is already hard to keep in mind, and
the indent in the contents list is doing most of the work of explaining where you are.

##### 3.1.1.1 Fifth level

Five levels is a warning sign. If a document needs this, it probably wants to be two
documents. It is included here only so the styling has been seen at least once.

###### 3.1.1.1.1 Sixth level

The last level. Nothing below this exists in Markdown.

## 4. Links

Back to [the index](../index.md), across to [getting started](getting-started.md), and
down to [the deep dive](advanced/deep-dive.md). An [outside link](https://example.com)
should do nothing when clicked.

## 5. The end

If you reached this line by scrolling, the pane works. If you reached it by clicking the
last entry in the table of contents, that works too.
