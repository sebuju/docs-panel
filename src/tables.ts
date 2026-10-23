// Markdown tables as written in the source: the gaps a reader leaves between their rows,
// and the rows' order, which the page can change by sorting or dragging. Nothing here
// touches vscode, so it can be run and checked on its own.

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ROW = /^ {0,3}\|/;
const DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const BLANK = /^\s*$/;
// The renderer reads a lone carriage return as a line break too, so lines are counted the
// way it counts them.
const BREAK = /\r\n|\r|\n/;

export interface ClosedText {
  text: string;
  // The line of the source each line of the text came from.
  lines: number[];
}

// A blank line ends a table, so a row written after one would be shown as a paragraph of
// pipes. Inside a table such a line is dropped instead, unless the row after it is the
// head of a table of its own, which then stays a table of its own.
export function closeTableGaps(text: string): ClosedText {
  const lines = text.split(BREAK);
  const out: string[] = [];
  const from: number[] = [];
  const push = (i: number) => {
    out.push(lines[i]);
    from.push(i);
  };
  let fence = "";
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = FENCE.exec(line);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && BLANK.test(line.slice(open[0].length))) {
        fence = "";
      }
      push(i);
      continue;
    }
    if (open) {
      fence = open[1];
      inTable = false;
      push(i);
      continue;
    }
    if (inTable && BLANK.test(line)) {
      let next = i;
      while (next < lines.length && BLANK.test(lines[next])) {
        next++;
      }
      if (next < lines.length && ROW.test(lines[next]) && !isDelimiter(lines[next + 1])) {
        i = next - 1;
        continue;
      }
    }
    if (!inTable && line.includes("|") && isDelimiter(lines[i + 1])) {
      inTable = true;
    } else if (!line.includes("|")) {
      inTable = false;
    }
    push(i);
  }
  return { text: out.join("\n"), lines: from };
}

function isDelimiter(line: string | undefined): boolean {
  return line !== undefined && line.includes("|") && DELIMITER.test(line);
}

// The renderer marks each block with the line it starts on, counted in the text it was
// given; with gaps dropped from that text, the marks are turned back into the source's
// own lines, so the page can name a row by where it is written.
export function restoreLines(html: string, lines: number[]): string {
  if (lines.every((line, i) => line === i)) {
    return html;
  }
  return html.replace(/(<[a-zA-Z][^<>]*?\sdata-line=")(\d+)"/g, (match, head: string, line: string) => {
    const source = lines[Number(line)];
    return source === undefined ? match : `${head}${source}"`;
  });
}

// A table's delimiter row may stand in a quote or under a list item, behind its markers.
function isDelimiterRow(line: string): boolean {
  const bare = line.replace(/^(?:\s*>)*\s*/, "");
  return bare.includes("|") && DELIMITER.test(bare);
}

// The body rows of one table are put in a new order, and nothing else in the file moves
// or changes. "rows" are the lines the rows are written on, top to bottom, and "order"
// the same lines in the order they are to stand in. The file must be exactly the text the
// page was drawn from, and the lines must be the body of one table: the first straight
// under the delimiter row, each holding a pipe, with nothing but blank lines between
// them. The result is checked once more before it is handed back: the same lines, the
// same line breaks, only the rows moved among their own places. Anything else is thrown
// as the reason it was refused; nothing to move gives undefined.
export function reorderRows(bytes: Uint8Array, shown: string, rows: unknown, order: unknown): Uint8Array | undefined {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error("the file is not UTF-8 text");
  }
  if (!sameBytes(new TextEncoder().encode(text), bytes)) {
    throw new Error("the file would not be written back byte for byte");
  }
  if (text.replace(/^﻿/, "") !== shown) {
    throw new Error("the file has changed since the page was drawn");
  }
  const at = lineList(rows);
  const to = lineList(order);
  if (!at || !to || at.length < 2 || to.length !== at.length) {
    throw new Error("the rows asked for are not a table's");
  }
  for (let i = 1; i < at.length; i++) {
    if (at[i] <= at[i - 1]) {
      throw new Error("the rows asked for are not in the order they are written");
    }
  }
  const sortedTo = [...to].sort((a, b) => a - b);
  if (sortedTo.some((line, i) => line !== at[i])) {
    throw new Error("the new order does not hold the same rows");
  }

  const parts = text.split(/(\r\n|\r|\n)/);
  const lines = parts.filter((_, i) => i % 2 === 0);
  const own = new Set(at);
  const first = at[0];
  const last = at[at.length - 1];
  if (last >= lines.length || first < 2 || !isDelimiterRow(lines[first - 1])) {
    throw new Error("the rows are not straight under a table's delimiter row");
  }
  for (let line = first; line <= last; line++) {
    if (own.has(line) ? !lines[line].includes("|") || BLANK.test(lines[line]) : !BLANK.test(lines[line])) {
      throw new Error(`line ${line + 1} is not a row of the table`);
    }
  }

  const moved = lines.slice();
  at.forEach((line, i) => {
    moved[line] = lines[to[i]];
  });
  if (moved.every((line, i) => line === lines[i])) {
    return undefined;
  }
  const next = parts.map((part, i) => (i % 2 === 0 ? moved[i / 2] : part)).join("");

  // The text written is read back as the source was, and must differ from it only there.
  const check = next.split(/(\r\n|\r|\n)/);
  const ok =
    check.length === parts.length &&
    check.every((part, i) => (i % 2 === 1 || !own.has(i / 2) ? part === parts[i] : true)) &&
    sameLines(at.map((line) => check[line * 2]), at.map((line) => lines[line]));
  if (!ok) {
    throw new Error("the reordered text did not check out");
  }
  return new TextEncoder().encode(next);
}

function lineList(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every((line) => Number.isInteger(line) && line >= 0)) {
    return undefined;
  }
  return new Set(value).size === value.length ? (value as number[]) : undefined;
}

function sameLines(a: string[], b: string[]): boolean {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((line, i) => line === y[i]);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((byte, i) => byte === b[i]);
}
