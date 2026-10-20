(function () {
  const vscode = acquireVsCodeApi();

  const layout = document.getElementById("layout");
  const sideEl = document.getElementById("side");
  const paneEl = document.getElementById("pane");
  const treeEl = document.getElementById("tree");
  const sideBodyEl = document.getElementById("sideBody");
  const sideSplitter = document.getElementById("sideSplitter");
  const splitter = document.getElementById("splitter");
  const renameEl = document.getElementById("rename");
  const trashEl = document.getElementById("trash");
  const restoreEl = document.getElementById("restore");
  const headerEl = document.getElementById("header");
  const titleEl = document.getElementById("title");
  const createdEl = document.getElementById("created");
  const modifiedEl = document.getElementById("modified");
  const agoEl = document.getElementById("ago");
  const toastsEl = document.getElementById("toasts");
  const toggleEl = document.getElementById("toggle");
  const bodyEl = document.getElementById("body");
  const tocEl = document.getElementById("toc");
  const lightboxEl = document.getElementById("lightbox");
  const lightboxImageEl = document.getElementById("lightboxImage");
  const lightboxHintEl = document.getElementById("lightboxHint");
  const menuEl = document.getElementById("menu");
  const findEl = document.getElementById("find");
  const searchEl = document.getElementById("search");
  const searchTextEl = document.getElementById("searchText");
  const searchCountEl = document.getElementById("searchCount");
  const searchCaseEl = document.getElementById("searchCase");
  const searchWordEl = document.getElementById("searchWord");
  const searchRegexEl = document.getElementById("searchRegex");
  const searchPrevEl = document.getElementById("searchPrev");
  const searchNextEl = document.getElementById("searchNext");
  const searchCloseEl = document.getElementById("searchClose");
  const findAllEl = document.getElementById("findAll");
  const openOptionsEl = document.getElementById("openOptions");
  const headerTagsEl = document.getElementById("tags");
  const addTagEl = document.getElementById("addTag");
  const tagPickerEl = document.getElementById("tagPicker");
  const tagPickerTitleEl = document.getElementById("tagPickerTitle");
  const tagInputEl = document.getElementById("tagInput");
  const tagListEl = document.getElementById("tagList");
  const optionsLayerEl = document.getElementById("optionsLayer");
  const optionsDialogEl = document.getElementById("optionsDialog");
  const optionsHeadEl = document.getElementById("optionsHead");
  const optionsBodyEl = document.getElementById("optionsBody");
  const finderEl = document.getElementById("finder");
  const finderTextEl = document.getElementById("finderText");
  const finderCountEl = document.getElementById("finderCount");
  const finderCaseEl = document.getElementById("finderCase");
  const finderWordEl = document.getElementById("finderWord");
  const finderRegexEl = document.getElementById("finderRegex");
  const finderCloseEl = document.getElementById("finderClose");
  const finderResultsEl = document.getElementById("finderResults");
  const treeToolsEl = document.getElementById("treeTools");

  const PIN_ICON =
    '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">' +
    '<path fill="currentColor" d="M6.2 2H9.8L9.1 3.1 9.6 6 11.2 7.6V8.7H8.5L8 13.8 7.5 8.7H4.8V7.6L6.4 6 6.9 3.1Z"/>' +
    "</svg>";

  // Drawn on the pixel grid, one unit to a pixel, so every stroke covers whole pixels. The
  // ink is 9px each way, the height of the capitals of a 13px label, in the middle of an
  // 11px box; the stylesheet lines its middle up with theirs.
  const CAN_ICON =
    '<svg viewBox="0 0 11 11" width="11" height="11" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1" ' +
    'd="M4.5 3V1.5h2V3M1 3.5h9M2.5 3.5v6h6v-6M4.5 5v3M6.5 5v3"/></svg>';

  // The options' minus and plus, one unit to a pixel: each bar is a single row or column
  // of whole pixels, the middle one of a 9px box that sits in the middle of its button.
  const MINUS_ICON =
    '<svg viewBox="0 0 9 9" width="9" height="9" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1" d="M1 4.5h7"/></svg>';

  const PLUS_ICON =
    '<svg viewBox="0 0 9 9" width="9" height="9" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1" d="M1 4.5h7M4.5 1v7"/></svg>';

  const FOLDER_ICON =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" ' +
    'd="M1.8 3.5h4.4l1.4 1.6h6.6v7.4H1.8z"/></svg>';

  const FILE_ICON =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" ' +
    'd="M3.5 1.8h6l3 3v9.4h-9zM9.5 1.8v3h3"/></svg>';

  // The names the extension accepts; each stands for a colour the theme itself defines,
  // and the stylesheet says which.
  const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "cyan", "magenta", "grey"];

  // A tag's colours are the panel's own, the same in every theme and all light enough for
  // the black text on a pill; listed round the colour wheel, then the browns and greys.
  const TAG_COLORS = [
    "red", "coral", "orange", "peach", "amber", "yellow", "olive", "lime", "green", "mint", "teal",
    "cyan", "sky", "blue", "lavender", "purple", "magenta", "pink", "brown", "sand", "grey", "silver"
  ];

  const MIN_SPLIT = 120;
  const MIN_ROW = 60;
  const MIN_TEXT = 0.7;
  const MAX_TEXT = 2.5;
  const TEXT_STEP = 0.1;
  const MIN_TREE = 0.7;
  const MAX_TREE = 2;
  const LINE_HEIGHTS = ["normal", "1.6", "2"];
  const LINE_LABELS = ["tight", "normal", "loose"];
  const ACTIVE_SHARE = 0.1;
  const TRASH_PREFIX = ".trash/";

  let nodes = [];
  let expanded = new Set();
  let selected = null;
  // The row the keys are on in the tree: a file, a folder or a bin. On a file it is the
  // file that is open; it is kept apart from that because a folder can hold it too.
  let cursor = null;
  let cursorIndex = 0;
  let split = 240;
  let sideSplit = 0.5;
  let textScale = 1;
  let treeScale = 1;
  let lineHeight = 1;
  let mono = false;
  let sections = [];
  let article = null;
  let activeFrame = 0;
  let activeSection = null;

  let current = null;
  let mode = "preview";
  // The bins that are open, by the folder they belong to; "" is the root's, which holds
  // the whole of the trash.
  const trashOpen = new Set();
  let trashNodes = [];
  let zoom = 1;
  let fitScale = 1;
  let panX = 0;
  let panY = 0;
  const drafts = new Map();
  let tags = {};
  let colors = {};
  let tagColors = {};
  // Each tag's letters, given it by the extension when it was made and kept apart from
  // every other tag's.
  let tagShorts = {};
  // How each tag's pill is drawn beyond its colour, and the order tags are listed in.
  let tagStyles = {};
  let tagOrder = [];
  let reads = new Set();
  let mentions = {};
  let logOpen = false;
  let pinned = new Set();
  let prefixes = {};
  let notice = "";
  let flashModified = false;
  let rootPrefix = "";
  const bars = [];
  let dragging = null;
  // "tree" or "toc" gives that list the height its entries need; "none" leaves the
  // divider where it was put.
  let autoSize = "none";
  const AUTO_SIZES = ["none", "tree", "toc"];
  const AUTO_LABELS = ["off", "files", "toc"];
  // The side's width follows the widest row of the tree, so no name is cut short; past
  // half the window the page would be squeezed, so it stops there.
  let autoWidth = false;
  const FIT_WIDTH_SHARE = 0.5;
  // Which side of a file's name its tags are drawn on in the tree.
  let tagSide = "right";
  const TAG_SIDES = ["left", "right"];
  let hoverStrength = 40;
  const HOVER_STEP = 10;
  // How far the block light reaches past the block's own edges.
  let blockPad = 4;
  const MAX_BLOCK_PAD = 16;
  // How many of a file's newest mentions show before the rest wait behind a button; none
  // turns the mentions off.
  let mentionLines = 5;
  const MAX_MENTION_LINES = 100;
  // The files left in edit mode, which open in it again.
  let editing = new Set();
  // How far down each file was read, as a share of the way, oldest first.
  let scrolls = {};
  const MAX_SCROLLS = 300;

  // The capitals' drawn height per font, and the tree font the tree's line was last fitted
  // to; both are needed by the first layout, which runs before the code that fills them.
  const capHeights = new Map();
  let treeLineKey = "";
  // The files opened, in order, for the mouse's back and forward buttons.
  const visits = [];
  let visitAt = -1;
  let walking = false;
  const MAX_VISITS = 200;

  const saved = vscode.getState();
  if (saved) {
    applyState(saved);
  }
  if (selected) {
    visit(selected);
  }
  setSplit(split);
  setSideSplit(sideSplit);
  setTextScale(textScale);
  setTreeScale(treeScale);
  setLineHeight(lineHeight);
  setMono(mono);
  setHoverStrength(hoverStrength);
  setBlockPad(blockPad);
  setTagSide(tagSide);

  function applyState(state) {
    if (typeof state.split === "number") {
      split = state.split;
    }
    if (typeof state.sideSplit === "number") {
      sideSplit = state.sideSplit;
    }
    if (typeof state.textScale === "number") {
      textScale = state.textScale;
    }
    if (typeof state.treeScale === "number") {
      treeScale = state.treeScale;
    }
    if (typeof state.lineHeight === "number") {
      lineHeight = state.lineHeight;
    }
    if (typeof state.mono === "boolean") {
      mono = state.mono;
    }
    if (AUTO_SIZES.includes(state.autoSize)) {
      autoSize = state.autoSize;
    } else if (state.tocAuto === true) {
      autoSize = "toc";
    }
    if (typeof state.autoWidth === "boolean") {
      autoWidth = state.autoWidth;
    }
    if (TAG_SIDES.includes(state.tagSide)) {
      tagSide = state.tagSide;
    }
    if (typeof state.hoverStrength === "number") {
      hoverStrength = state.hoverStrength;
    }
    if (typeof state.blockPad === "number") {
      blockPad = state.blockPad;
    }
    if (typeof state.mentionLines === "number") {
      mentionLines = state.mentionLines;
    }
    if (Array.isArray(state.editing)) {
      editing = new Set(state.editing);
    }
    if (state.scrolls && typeof state.scrolls === "object") {
      scrolls = Object.assign({}, state.scrolls);
    }
    if (Array.isArray(state.expanded)) {
      expanded = new Set(state.expanded);
    }
    if (Array.isArray(state.pinned)) {
      pinned = new Set(state.pinned);
    }
    selected = typeof state.selected === "string" ? state.selected : null;
  }

  function currentState() {
    return {
      split: split,
      sideSplit: sideSplit,
      textScale: textScale,
      treeScale: treeScale,
      lineHeight: lineHeight,
      mono: mono,
      autoSize: autoSize,
      autoWidth: autoWidth,
      tagSide: tagSide,
      hoverStrength: hoverStrength,
      blockPad: blockPad,
      mentionLines: mentionLines,
      expanded: [...expanded],
      pinned: [...pinned],
      selected: selected,
      editing: [...editing],
      scrolls: scrolls
    };
  }

  function persist() {
    const state = currentState();
    vscode.setState(state);
    vscode.postMessage({ type: "persist", ...state });
  }

  function setSplit(value) {
    const max = Math.max(MIN_SPLIT, window.innerWidth - MIN_SPLIT - 4);
    split = Math.min(Math.max(value, MIN_SPLIT), max);
    layout.style.setProperty("--split", split + "px");
    fitTags();
  }

  function setSideSplit(value) {
    const height = sideBodyEl.clientHeight || 1;
    const min = Math.min(0.4, MIN_ROW / height);
    sideSplit = Math.min(Math.max(value, min), 1 - min);
    sideBodyEl.style.setProperty("--tree-row", "calc(" + sideSplit * 100 + "% - 2px)");
    refreshBars();
  }

  const FIT_MAX_SHARE = 0.75;

  // Auto size gives one list, the files or the contents, exactly the height its entries
  // need, so it never scrolls; past three quarters of the side the other one would be
  // squeezed out, so it stops there.
  function fitSide() {
    const pane = autoSize === "tree" ? treeEl : autoSize === "toc" ? tocEl : null;
    const list = pane && pane.querySelector(":scope > ul");
    if (!list || tocEl.hidden) {
      setSideSplit(sideSplit);
      return;
    }
    // The pane's own scrollHeight is never less than the pane, so it can only ever grow.
    // The list inside it is not a scroller, and its height is the height actually wanted.
    const style = getComputedStyle(pane);
    const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const wanted = Math.min(FIT_MAX_SHARE, (list.getBoundingClientRect().height + pad + 3) / (sideBodyEl.clientHeight || 1));
    setSideSplit(autoSize === "tree" ? wanted : 1 - wanted);
  }

  function setAutoSize(value) {
    autoSize = AUTO_SIZES.includes(value) ? value : "none";
    fitSide();
    persist();
  }

  // Each row is measured as wide as it would be with nothing cut: its name and its tags
  // at their own width, and the indent of the folders it is in.
  function fitWidth() {
    if (!autoWidth) {
      return;
    }
    const rows = treeEl.querySelectorAll(".row");
    if (!rows.length) {
      return;
    }
    shortenPills(treeEl.querySelectorAll(".tag"), false);
    treeEl.classList.add("measuring");
    let right = 0;
    for (const row of rows) {
      right = Math.max(right, row.getBoundingClientRect().right);
    }
    treeEl.classList.remove("measuring");
    const box = treeEl.getBoundingClientRect();
    const wanted = right - box.left + parseFloat(getComputedStyle(treeEl).paddingRight);
    setSplit(Math.min(Math.ceil(wanted), Math.floor(window.innerWidth * FIT_WIDTH_SHARE)));
    // The contents wrap to the width they are given, so their height is found again.
    if (autoSize === "toc") {
      fitSide();
    }
  }

  function setAutoWidth(value) {
    autoWidth = !!value;
    fitWidth();
    persist();
  }

  // One scale for every file, so the reading size is a property of the panel.
  function setTextScale(value) {
    textScale = Math.min(Math.max(Math.round(value * 100) / 100, MIN_TEXT), MAX_TEXT);
    layout.style.setProperty("--text-scale", textScale);
  }

  // The tree's own size, apart from the page's. The rows and pills are given whole pixels,
  // so text, twisty and dot keep sharing one centre line at any size.
  function setTreeScale(value) {
    treeScale = Math.min(Math.max(Math.round(value * 100) / 100, MIN_TREE), MAX_TREE);
    treeEl.style.setProperty("--tree-scale", treeScale);
    treeEl.style.setProperty("--tree-row", Math.round(18 * treeScale) + "px");
    treeEl.style.setProperty("--tree-pill", Math.round(14 * treeScale) + "px");
    fitTags();
  }

  function stepTreeScale(delta) {
    setTreeScale(treeScale + delta);
    fitWidth();
    if (autoSize === "tree") {
      fitSide();
    }
    persist();
    drawOptions();
  }

  function setLineHeight(value) {
    lineHeight = Math.min(Math.max(Math.round(value) || 0, 0), LINE_HEIGHTS.length - 1);
    layout.style.setProperty("--line-height", LINE_HEIGHTS[lineHeight]);
  }

  // How strongly the block under the pointer, or the one the arrow keys are on, is lit;
  // nought switches the light off.
  function setHoverStrength(value) {
    hoverStrength = Math.min(Math.max(Math.round(value) || 0, 0), 100);
    layout.style.setProperty("--block-light", String(hoverStrength / 100));
  }

  function setBlockPad(value) {
    blockPad = Math.min(Math.max(Math.round(value) || 0, 0), MAX_BLOCK_PAD);
    layout.style.setProperty("--block-pad", blockPad + "px");
  }

  function setMono(value) {
    mono = !!value;
    layout.style.setProperty(
      "--body-font",
      mono ? "var(--vscode-editor-font-family)" : "var(--vscode-font-family)"
    );
  }

  function setTagSide(value) {
    tagSide = TAG_SIDES.includes(value) ? value : "right";
    treeEl.classList.toggle("tags-left", tagSide === "left");
    fitWidth();
    fitTags();
  }

  // The host rewrites the root's colours and the body's classes when the theme or the
  // font changes; the side's width follows the font.
  function followTheme() {
    capHeights.clear();
    treeLineKey = "";
    fitWidth();
    fitTags();
  }

  new MutationObserver(followTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"]
  });
  new MutationObserver(followTheme).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  const TOAST_MS = 2400;

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastsEl.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    }, TOAST_MS);
  }

  // A webview may be denied the async clipboard, so the old selection copy stands in.
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => copyBySelection(text));
      return;
    }
    copyBySelection(text);
  }

  function copyBySelection(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  // One format for every date the panel shows: dd/mm/yyyy hh:mm, 24 hour.
  function formatStamp(ms) {
    if (!ms) {
      return "";
    }
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, "0");
    return (
      pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear() +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes())
    );
  }

  const AGO_UNITS = [["y", 31536000000], ["w", 604800000], ["d", 86400000], ["h", 3600000], ["m", 60000]];
  const AGO_MS = 30000;

  // Two units at most, counted from the largest one that fits, and never seconds: below a
  // minute the number would change while it is being read.
  function formatAgo(ms) {
    if (!ms) {
      return "";
    }
    let rest = Math.max(0, Date.now() - ms);
    const first = AGO_UNITS.findIndex((unit) => rest >= unit[1]);
    if (first < 0) {
      return "<1m";
    }
    const parts = [];
    for (let i = first; i < AGO_UNITS.length && i < first + 2; i++) {
      const value = Math.floor(rest / AGO_UNITS[i][1]);
      rest -= value * AGO_UNITS[i][1];
      if (value) {
        parts.push(value + AGO_UNITS[i][0]);
      }
    }
    return parts.join(" ");
  }

  function drawTree(text) {
    if (text !== undefined) {
      notice = text;
    }
    // Emptying the tree collapses it, and the browser pulls the scroll back to the top
    // with it; the place is put back once the rows are in again.
    const top = treeEl.scrollTop;
    treeEl.textContent = "";
    const list = buildList(nodes, notice);
    list.appendChild(trashItem(""));
    treeEl.appendChild(list);
    treeEl.scrollTop = top;
    markCursor(document.activeElement === treeEl ? cursorRow() : null);
    fitWidth();
    fitTags();
    if (autoSize === "tree") {
      fitSide();
    }
  }

  // The trash keeps the folders its files came from, so every folder has a bin of its
  // own: the root's holds the whole trash, a folder's the part that left that folder.
  function trashItem(at) {
    const items = at ? trashFor(at) : trashNodes;
    const li = document.createElement("li");
    li.appendChild(trashRow(at));
    if (trashOpen.has(at)) {
      li.appendChild(buildList(items, items.length ? "" : "The trash is empty."));
    }
    return li;
  }

  // A folder kept by another tool can have a .trash of its own, and that is in its bin too.
  function trashFor(at) {
    const node = findNode(trashNodes, TRASH_PREFIX + at);
    const own = findNode(nodes, at);
    return ((node && node.children) || []).concat((own && own.trash) || []);
  }

  function findNode(items, path) {
    for (const node of items) {
      if (node.path === path) {
        return node;
      }
      if (node.dir && node.children && path.startsWith(node.path + "/")) {
        return findNode(node.children, path);
      }
    }
    return null;
  }

  // The trash is a folder in the list, below the docs it came from and opening in place.
  function trashRow(at) {
    const row = document.createElement("div");
    row.className = "row bin";
    row.dataset.path = at ? TRASH_PREFIX + at : ".trash";
    row.dataset.dir = "1";
    row.dataset.open = trashOpen.has(at) ? "1" : "";

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = trashOpen.has(at) ? "▾" : "▸";
    row.appendChild(twisty);

    const can = document.createElement("span");
    can.className = "can";
    can.innerHTML = CAN_ICON;
    row.appendChild(can);

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "Trash";
    row.appendChild(label);

    row.addEventListener("click", () => {
      if (!trashOpen.delete(at)) {
        trashOpen.add(at);
      }
      drawTree();
    });

    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const empty = !(at ? trashFor(at) : trashNodes).length;
      openMenu(event.clientX, event.clientY, [
        { label: "Restore all", disabled: empty, run: () => emptyBin("restoreAll", at) },
        { label: "Delete all", danger: true, disabled: empty, run: () => emptyBin("emptyTrash", at) }
      ]);
    });
    return row;
  }

  // Whatever leaves the bin takes its unsaved drafts along, as a single file would.
  function emptyBin(type, at) {
    const bins = at ? [TRASH_PREFIX + at + "/", at + "/" + TRASH_PREFIX] : [TRASH_PREFIX];
    for (const path of [...drafts.keys()]) {
      if (bins.some((bin) => path.startsWith(bin))) {
        drafts.delete(path);
      }
    }
    vscode.postMessage({ type: type, at: at });
  }

  function buildList(items, text) {
    const ul = document.createElement("ul");
    if (text) {
      const li = document.createElement("li");
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = text;
      li.appendChild(p);
      ul.appendChild(li);
      return ul;
    }
    for (const node of sortPinned(items)) {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.path = node.path;
      row.dataset.dir = node.dir ? "1" : "";
      row.dataset.open = node.dir && expanded.has(node.path) ? "1" : "";
      row.draggable = true;

      // A file has no twisty, so the dot takes that slot and costs the row no width.
      if (node.dir) {
        const twisty = document.createElement("span");
        twisty.className = "twisty";
        twisty.textContent = expanded.has(node.path) ? "▾" : "▸";
        row.appendChild(twisty);
      } else {
        const dot = document.createElement("span");
        const noted = (mentions[node.path] || []).length;
        const seen = reads.has(node.path);
        dot.className = seen ? "dot read" : noted ? "dot noted" : "dot";
        dot.title = seen ? "Read" : noted ? "Talked about " + noted + " times" : "Not read yet";
        row.appendChild(dot);
      }

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = node.name;
      row.appendChild(label);

      if (colors[node.path]) {
        row.classList.add("colored", "c-" + colors[node.path]);
      }

      if (pinned.has(node.path)) {
        const pin = document.createElement("span");
        pin.className = "pin";
        pin.title = "Pinned";
        pin.innerHTML = PIN_ICON;
        row.appendChild(pin);
      }

      if (!node.dir && node.path === selected) {
        row.classList.add("selected");
      }
      if (!node.dir && drafts.has(node.path)) {
        row.classList.add("unsaved");
      }
      if (!node.dir && (tags[node.path] || []).length) {
        const box = document.createElement("span");
        box.className = "tags";
        for (const tag of byOrder(tags[node.path])) {
          const pill = tagPill(tag);
          pill.addEventListener("click", (event) => {
            event.stopPropagation();
            searchTag(tag, event.shiftKey);
          });
          box.appendChild(pill);
        }
        row.appendChild(box);
      }

      // With Ctrl held a file's tags come up where it was clicked, and the file stays shut.
      row.addEventListener("click", (event) => {
        if (!node.dir && (event.ctrlKey || event.metaKey) && !inTrash(node.path)) {
          openTagPicker(node.path, event.clientX, event.clientY);
          return;
        }
        if (node.dir) {
          if (expanded.has(node.path)) {
            expanded.delete(node.path);
          } else {
            expanded.add(node.path);
          }
          drawTree();
          persist();
        } else {
          openFile(node.path);
        }
      });

      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY, nodeMenu(node, event.clientX, event.clientY));
      });

      row.addEventListener("dragstart", (event) => {
        dragging = { path: node.path, dir: !!node.dir };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.path);
        row.classList.add("dragged");
      });

      row.addEventListener("dragend", () => {
        dragging = null;
        row.classList.remove("dragged");
        highlightDrop(null);
      });

      li.appendChild(row);
      if (node.dir && expanded.has(node.path)) {
        const children = node.children || [];
        const binned = inTrash(node.path) ? [] : trashFor(node.path);
        if (children.length || binned.length) {
          const inner = buildList(children);
          if (binned.length) {
            inner.appendChild(trashItem(node.path));
          }
          li.appendChild(inner);
        }
      }
      ul.appendChild(li);
    }
    return ul;
  }

  // A pin puts its entry above everything else the folder holds; several of them are read
  // as one short list of their own, so they are named in order, folders first.
  function sortPinned(items) {
    const up = items.filter((node) => pinned.has(node.path));
    if (!up.length) {
      return items;
    }
    up.sort((a, b) =>
      !!a.dir !== !!b.dir
        ? (a.dir ? -1 : 1)
        : a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return [...up, ...items.filter((node) => !pinned.has(node.path))];
  }

  function byName(names) {
    return names.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  // Tags are listed wherever they are listed in the order the options give them; one the
  // order does not know yet, just typed in, goes after the rest.
  function byOrder(names) {
    const rank = (name) => {
      const at = tagOrder.indexOf(name);
      return at < 0 ? tagOrder.length : at;
    };
    return byName(names).sort((a, b) => rank(a) - rank(b));
  }

  const STYLE_FLAGS = ["bold", "italic", "underline", "white", "square"];

  // A tag is drawn as a pill in the colour it was given, and in the style, if any. It
  // carries its initials too, for when there is no room for its name; a wrap goes round
  // either.
  function tagPill(name) {
    const style = tagStyles[name] || {};
    const pill = document.createElement("span");
    pill.className = "tag t-" + tagColor(name);
    for (const flag of STYLE_FLAGS) {
      pill.classList.toggle("tag-" + flag, !!style[flag]);
    }
    const wrap = Array.from(style.wrap || "");
    const open = wrap[0] || "";
    const close = wrap[1] || open;
    pill.appendChild(make("span", "tag-text", open + name + close));
    pill.title = name;
    pill.dataset.name = open + name + close;
    pill.dataset.short = open + shortOf(name) + close;
    return pill;
  }

  function shortOf(name) {
    return tagShorts[name] || initials(name);
  }

  // A tag just typed in has no letters from the extension until it answers, and shows its
  // initials until then: the first letter of each word.
  function initials(name) {
    const letters = name
      .split(/[\s\-_./]+/)
      .map((word) => Array.from(word)[0] || "")
      .join("");
    return letters || Array.from(name)[0] || name;
  }

  // How many pixels tall the capitals of a font are where they are drawn, which is what
  // hinting makes of the font's own figure and can come out a pixel either side of it. A
  // capital drawn on a canvas comes out the same as in the page.

  function drawnCap(font) {
    if (!capHeights.has(font)) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const paint = canvas.getContext("2d", { willReadFrequently: true });
      paint.fillStyle = "#fff";
      paint.fillRect(0, 0, 64, 64);
      paint.fillStyle = "#000";
      paint.font = font;
      paint.fillText("H", 8, 48);
      const data = paint.getImageData(0, 0, 64, 64).data;
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (data[(y * 64 + x) * 4] < 128) {
            top = top < 0 ? y : top;
            bottom = y + 1;
            break;
          }
        }
      }
      capHeights.set(font, top < 0 ? 0 : bottom - top);
    }
    return capHeights.get(font);
  }

  // Every pill in a box shares a font, so one of them gives the height for all of them:
  // the one nearest the height asked for that is odd where the capitals are an odd number
  // of pixels tall and even where they are even, put on a whole pixel in the box.
  function fitPillHeights(box) {
    const pill = box.querySelector(".tag");
    if (!pill) {
      return;
    }
    const style = getComputedStyle(pill);
    const cap = drawnCap(style.fontStyle + " " + style.fontWeight + " " + style.fontSize + " " + style.fontFamily);
    const asked = parseFloat(style.getPropertyValue("--pill"));
    const room = parseFloat(style.getPropertyValue("--room"));
    if (!cap || !asked || !room) {
      return;
    }
    const height = cap + 2 * Math.floor((asked - cap) / 2);
    box.style.setProperty("--tag-height", height + "px");
    box.style.setProperty("--tag-top", Math.floor((room - height) / 2) + "px");
  }

  // In the tree the row, its pills and its name share one centre line, on whole pixels. A
  // pill is the height nearest the one asked for that centres its own capitals; the row is
  // made a pixel taller where it must be for the pill to have as many pixels above it as
  // below; and the name, whose capitals sit wherever the font's ascent puts them, is moved
  // by whole pixels to put their middle on the row's. A row made for the purpose is
  // measured, so a tree with no tags yet is laid out as one with them.

  function fitTreeLine() {
    const font = getComputedStyle(treeEl);
    const key = treeScale + "|" + font.fontSize + "|" + font.fontFamily;
    if (key === treeLineKey) {
      return;
    }
    const probe = make("div", "row");
    probe.style.cssText = "position: absolute; visibility: hidden; left: 0; top: 0;";
    const label = make("span", "label", "H");
    const base = make("span");
    base.style.cssText = "display: inline-block; width: 0; height: 0; vertical-align: baseline;";
    label.appendChild(base);
    const box = make("span", "tags");
    const pill = make("span", "tag");
    pill.appendChild(make("span", "tag-text", "H"));
    box.appendChild(pill);
    probe.append(label, box);
    treeEl.appendChild(probe);

    const pillStyle = getComputedStyle(pill);
    const pillCap = drawnCap(pillStyle.fontStyle + " " + pillStyle.fontWeight + " " + pillStyle.fontSize + " " + pillStyle.fontFamily);
    const asked = parseFloat(pillStyle.getPropertyValue("--pill"));
    const labelStyle = getComputedStyle(label);
    const labelCap = drawnCap(labelStyle.fontStyle + " " + labelStyle.fontWeight + " " + labelStyle.fontSize + " " + labelStyle.fontFamily);
    const wanted = Math.round(18 * treeScale);
    if (!pillCap || !labelCap || !asked) {
      probe.remove();
      return;
    }
    const height = pillCap + 2 * Math.floor((asked - pillCap) / 2);
    const row = wanted + ((wanted - height) % 2 ? 1 : 0);
    treeEl.style.setProperty("--tree-row", row + "px");
    treeEl.style.setProperty("--tag-height", height + "px");
    treeEl.style.setProperty("--tag-top", (row - height) / 2 + "px");
    treeEl.style.setProperty("--label-shift", "0px");

    const top = label.getBoundingClientRect();
    const baseline = Math.round(base.getBoundingClientRect().top - top.top);
    probe.remove();
    if (!top.height) {
      return;
    }
    treeEl.style.setProperty("--label-shift", Math.round((row + labelCap) / 2 - baseline) + "px");
    treeLineKey = key;
  }

  function shortenPills(pills, short) {
    for (const pill of pills) {
      const text = short ? pill.dataset.short : pill.dataset.name;
      if (pill.firstChild.textContent !== text) {
        pill.firstChild.textContent = text;
      }
      pill.classList.toggle("short", short);
    }
  }

  // Tags that do not fit beside a name, all of them at their full width, give way to their
  // initials, every pill in the row at once; the pills keep their width and only the name
  // is cut. Each row is put back to full names and measured before any is changed, so the
  // whole tree costs two layouts, not one a row.
  function fitTags() {
    fitTreeLine();
    const rows = [...treeEl.querySelectorAll(".row")].filter((row) => row.querySelector(".tags"));
    for (const row of rows) {
      shortenPills(row.querySelectorAll(".tag"), false);
    }
    const tight = rows.filter((row) => {
      const label = row.querySelector(".label");
      return label.scrollWidth > label.clientWidth;
    });
    for (const row of tight) {
      shortenPills(row.querySelectorAll(".tag"), true);
    }
    fitHeaderTags();
  }

  // The same in the file bar, where the file's name is what must not be cut.
  function fitHeaderTags() {
    fitPillHeights(headerTagsEl);
    const pills = headerTagsEl.querySelectorAll(".tag");
    shortenPills(pills, false);
    const tight =
      headerTagsEl.scrollWidth > headerTagsEl.clientWidth || titleEl.scrollWidth > titleEl.clientWidth;
    shortenPills(pills, tight && pills.length > 0);
  }

  function tagColor(name) {
    return TAG_COLORS.includes(tagColors[name]) ? tagColors[name] : "grey";
  }

  function togglePin(path) {
    if (!pinned.delete(path)) {
      pinned.add(path);
    }
    drawTree();
    persist();
  }

  function openFile(path) {
    if (finderOpen) {
      closeFinder(true);
    }
    cursor = path;
    if (path === selected) {
      return;
    }
    save();
    selected = path;
    visit(path);
    drawTree();
    persist();
    vscode.postMessage({ type: "open", path: path });
  }

  // Every file opened is a step, the way a page is in a browser, and the mouse's back and
  // forward buttons walk the steps. A step to a file that has gone since is passed over.
  function visit(path) {
    if (walking || visits[visitAt] === path) {
      return;
    }
    visits.splice(visitAt + 1);
    visits.push(path);
    if (visits.length > MAX_VISITS) {
      visits.shift();
    }
    visitAt = visits.length - 1;
  }

  function walkVisits(delta) {
    for (let i = visitAt + delta; i >= 0 && i < visits.length; i += delta) {
      const path = visits[i];
      if (findNode(nodes, path) || findNode(trashNodes, path)) {
        visitAt = i;
        walking = true;
        expandTo(path, false);
        if (path === selected) {
          drawTree();
        }
        openFile(path);
        walking = false;
        showRow(path, false);
        return;
      }
    }
  }

  window.addEventListener("mousedown", (event) => {
    if (event.button === 3 || event.button === 4) {
      event.preventDefault();
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 3 || event.button === 4) {
      event.preventDefault();
      walkVisits(event.button === 3 ? -1 : 1);
    }
  });

  function stashDraft() {
    if (mode !== "edit" || !current) {
      return;
    }
    const area = bodyEl.querySelector("textarea");
    if (area && area.value !== current.text) {
      drafts.set(current.path, area.value);
    }
  }

  // Tree paths are relative to the docs root; anything shown or copied is relative to the
  // project, which is the path the rest of the editor and the terminal use.
  function fullPath(path) {
    return rootPrefix ? rootPrefix + "/" + path : path;
  }

  function copyPath(path, prefixed) {
    const text = (prefixed ? prefixFor(path) : "") + fullPath(path);
    copyText(text);
    toast("copied to clipboard: " + text);
  }

  // The setting is keyed by extension, and its value is taken exactly as written: a
  // trailing space is what separates the command from the path, so nothing is trimmed.
  function prefixFor(path) {
    const name = path.split("/").pop() || "";
    const dot = name.lastIndexOf(".");
    return (dot > 0 && prefixes[name.slice(dot + 1).toLowerCase()]) || "";
  }

  // One menu for the whole panel: a list of items in, a placed menu out.
  function openMenu(x, y, items) {
    menuEl.textContent = "";
    for (const item of items) {
      if (item.separator) {
        menuEl.appendChild(document.createElement("hr"));
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = item.danger ? "danger" : "";
      button.disabled = !!item.disabled;
      if (item.checked !== undefined) {
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = item.checked ? "✓" : "";
        button.appendChild(tick);
      }
      if (item.swatch) {
        const swatch = document.createElement("span");
        swatch.className = "swatch " + item.swatch;
        button.appendChild(swatch);
      }
      button.appendChild(document.createTextNode(item.label));
      button.addEventListener("click", () => runMenuItem(item));
      button.addEventListener("pointerenter", () => lightMenuItem(button.disabled ? null : button));
      menuEl.appendChild(button);
    }
    menuEl.hidden = false;
    menuOn = null;
    place(menuEl, x, y);
    if (menuKeys) {
      stepMenu(1);
    }
  }

  // The menu is walked with a light, not with the focus, so whatever opened it keeps the
  // focus throughout and has it still when the menu is closed again.
  let menuOn = null;
  // Where the focus goes once a menu opened from the keyboard is done with, and whether
  // the menu being opened now is one of those, so it comes up with its first entry lit.
  let menuReturn = null;
  let pickerReturn = null;
  let menuKeys = false;

  function lightMenuItem(button) {
    if (menuOn) {
      menuOn.classList.remove("on");
    }
    menuOn = button;
    if (menuOn) {
      menuOn.classList.add("on");
      menuOn.scrollIntoView({ block: "nearest" });
    }
  }

  function stepMenu(delta) {
    const buttons = [...menuEl.querySelectorAll("button")].filter((button) => !button.disabled);
    if (!buttons.length) {
      return;
    }
    const index = buttons.indexOf(menuOn);
    lightMenuItem(
      index < 0
        ? buttons[delta > 0 ? 0 : buttons.length - 1]
        : buttons[(index + delta + buttons.length) % buttons.length]
    );
  }

  // An entry that leads on to another menu or to the tag picker hands the way back along,
  // so the focus returns only when the whole errand is over.
  function runMenuItem(item) {
    const back = menuReturn;
    closeMenu();
    menuKeys = !!back;
    item.run();
    menuKeys = false;
    if (!back) {
      return;
    }
    if (!menuEl.hidden) {
      menuReturn = back;
    } else if (!tagPickerEl.hidden) {
      pickerReturn = back;
    } else {
      back.focus({ preventScroll: true });
    }
  }

  // A floating box opens at the point asked for, pulled back inside the window.
  function place(el, x, y) {
    el.style.left = "0px";
    el.style.top = "0px";
    const box = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(x, window.innerWidth - box.width - 4)) + "px";
    el.style.top = Math.max(0, Math.min(y, window.innerHeight - box.height - 4)) + "px";
  }

  // "none" is offered only where having no colour at all is a choice; a tag always has one,
  // from a palette of its own.
  function openColorMenu(x, y, chosen, none, apply) {
    const palette = none ? COLORS : TAG_COLORS;
    const items = palette.map((color) => ({
      label: color,
      swatch: (none ? "c-" : "t-") + color,
      checked: chosen === color,
      run: () => apply(color)
    }));
    if (none) {
      items.unshift({ label: "no colour", checked: !chosen, run: () => apply(null) }, { separator: true });
    }
    openMenu(x, y, items);
  }

  function setColor(node, color) {
    if (color) {
      colors[node.path] = color;
    } else {
      delete colors[node.path];
    }
    drawTree();
    vscode.postMessage({ type: "color", path: node.path, dir: !!node.dir, color: color });
  }

  // It is also a listener, so only a plain true sends the focus back.
  function closeMenu(refocus) {
    menuEl.hidden = true;
    menuEl.textContent = "";
    menuOn = null;
    const back = menuReturn;
    menuReturn = null;
    if (refocus === true && back) {
      back.focus({ preventScroll: true });
    }
  }

  // The marks come first, as they are what the menu is most often opened for.
  function nodeMenu(node, x, y) {
    const trashed = inTrash(node.path);
    const items = [];
    if (!trashed) {
      if (!node.dir) {
        items.push({ label: "Tags…", run: () => openTagPicker(node.path, x, y) });
      }
      items.push({
        label: "Colour…",
        run: () => openColorMenu(x, y, colors[node.path], true, (color) => setColor(node, color))
      });
      items.push({
        label: pinned.has(node.path) ? "Unpin" : "Pin to top",
        run: () => togglePin(node.path)
      });
      items.push({ separator: true });
    }
    if (node.dir && !trashed) {
      items.push(...makeItems(node.path), { separator: true });
    }
    items.push({ label: "Reveal in file explorer", run: () => send("reveal", node) });
    if (!node.dir) {
      items.push({ label: "Open in browser", run: () => send("browser", node) });
    }
    items.push({ label: "Rename…", run: () => send("rename", node) });
    items.push({ label: "Clone", run: () => send("clone", node) });
    items.push({ label: "Copy path", run: () => copyPath(node.path) });
    items.push({ separator: true });
    if (trashed) {
      items.push({ label: "Restore", run: () => send("restore", node) });
    } else {
      items.push({ label: "Move to the trash", run: () => send("trash", node) });
    }
    items.push({ label: "Delete", danger: true, run: () => send("delete", node) });
    return items;
  }

  // The same pair of entries wherever a new file can go: a folder's menu, and the empty
  // space below the tree, which stands for the docs root.
  function makeItems(at) {
    return [
      { label: "New file…", run: () => create("file", at) },
      { label: "New folder…", run: () => create("folder", at) }
    ];
  }

  // The folder is opened first, so whatever is made in it is on screen when it arrives.
  function create(kind, at) {
    if (at) {
      expanded.add(at);
      persist();
    }
    vscode.postMessage({ type: "create", kind: kind, at: at });
  }

  // A file on its way out of the tree takes any unsaved draft of it along.
  function send(type, node) {
    if (type === "trash" || type === "restore" || type === "delete") {
      drafts.delete(node.path);
    }
    vscode.postMessage({ type: type, path: node.path, dir: !!node.dir });
  }

  const BLOCKS = "p, li, pre, blockquote, td, th, h1, h2, h3, h4, h5, h6";

  // Reading only: the page cannot be changed from here, so there is nothing to cut into
  // and nothing to paste over. The block is the paragraph or item under the pointer.
  bodyEl.addEventListener("contextmenu", (event) => {
    if (mode === "edit" || !article) {
      return;
    }
    const block = rowOf(blockAt(event.target));
    const selection = window.getSelection();
    const picked = String(selection).trim();
    // Clicking the menu takes the selection away, so the range is kept as it stands now.
    const range = picked && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const word = picked ? firstLine(picked) : wordAt(event.clientX, event.clientY);
    if (!block && !picked && !word) {
      return;
    }
    event.preventDefault();
    const items = [];
    if (picked) {
      items.push({
        label: "Copy",
        run: () => {
          copyBlock(picked);
          flashRange(range);
        }
      });
    }
    if (block) {
      items.push({
        label: "Copy text block",
        run: () => {
          copyBlock(blockText(block));
          flashOutline(block);
        }
      });
    }
    if (word) {
      const shown = "“" + (word.length > 24 ? word.slice(0, 24) + "…" : word) + "”";
      items.push(
        { separator: true },
        { label: "Find " + shown, run: () => openSearch(word) },
        { label: "Find " + shown + " in all docs", run: () => openFinder(null, word) }
      );
    }
    openMenu(event.clientX, event.clientY, items);
  });

  // The word under the pointer: letters, digits and underscores either side of it.
  function wordAt(x, y) {
    const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    const node = range && range.startContainer;
    if (!node || node.nodeType !== 3 || !article.contains(node)) {
      return "";
    }
    const text = node.nodeValue;
    const part = /[\p{L}\p{N}_]/u;
    let from = range.startOffset;
    let to = from;
    while (from > 0 && part.test(text[from - 1])) {
      from -= 1;
    }
    while (to < text.length && part.test(text[to])) {
      to += 1;
    }
    return text.slice(from, to);
  }

  function firstLine(text) {
    return (text.split(/\r?\n/).find((line) => line.trim()) || "").trim().slice(0, 200);
  }

  // What is selected in the page, or in the editor while it has the focus, as one line to
  // search for.
  function pickedText() {
    const area = mode === "edit" ? bodyEl.querySelector("textarea") : null;
    if (area && document.activeElement === area) {
      return firstLine(area.value.slice(area.selectionStart, area.selectionEnd));
    }
    const selection = window.getSelection();
    return selection.rangeCount && bodyEl.contains(selection.anchorNode) ? firstLine(String(selection)) : "";
  }

  function blockAt(el) {
    return el && el.closest && article.contains(el) ? el.closest(BLOCKS) : null;
  }

  // A table is read a row at a time, so a cell stands for the row it is in.
  function rowOf(block) {
    return block && /^T[DH]$/.test(block.tagName) && block.parentElement && block.parentElement.tagName === "TR"
      ? block.parentElement
      : block;
  }

  // Anything that only holds other blocks - a quote, a loose list item, a table - is
  // passed over, so the light always lands on a block whose own text it is.
  const HOLDERS = BLOCKS + ", ul, ol, table, thead, tbody, tfoot, tr, div, hr, details, figure";

  function ownsText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3 ? node.nodeValue.trim() : node.nodeType === 1 && !node.matches(HOLDERS)) {
        return true;
      }
    }
    return false;
  }

  function lightableAt(el) {
    const cell = blockAt(el);
    if (cell && rowOf(cell) !== cell) {
      return rowOf(cell);
    }
    let block = cell;
    while (block && !ownsText(block)) {
      block = block.parentElement && article.contains(block.parentElement)
        ? block.parentElement.closest(BLOCKS)
        : null;
    }
    return block;
  }

  // Only a Markdown page is read block by block; the other kinds are one block of code
  // or someone else's layout.
  function readingMarkdown() {
    return !!article && mode !== "edit" && !!current && current.kind === "md";
  }

  // Any file shown rather than edited can take the focus, so the keys can at least scroll
  // it; only Markdown has blocks to walk.
  function readingFile() {
    return mode !== "edit" && !!current;
  }

  let blockOn = null;
  let blockByKey = false;
  let pointerAt = null;

  // One block is lit at a time: the one under the pointer, or the one the arrow keys
  // moved to. It is marked by a class that paints and moves nothing.
  function lightBlock(block, byKey) {
    if (blockOn !== block) {
      if (blockOn) {
        blockOn.classList.remove("block-on");
      }
      blockOn = block;
      if (blockOn) {
        blockOn.classList.add("block-on");
      }
    }
    blockByKey = !!block && byKey;
  }

  bodyEl.addEventListener("pointermove", (event) => {
    // A scroll slides the page under a pointer that stays put, and that is reported as a
    // move too; only a pointer that went somewhere takes the light from the keys.
    if (pointerAt && pointerAt.x === event.clientX && pointerAt.y === event.clientY) {
      return;
    }
    pointerAt = { x: event.clientX, y: event.clientY };
    if (readingMarkdown()) {
      lightBlock(lightableAt(event.target), false);
    }
  });

  bodyEl.addEventListener("pointerleave", () => {
    pointerAt = null;
    if (!blockByKey) {
      lightBlock(null);
    }
  });

  function readableBlocks() {
    const out = [];
    for (const el of article.querySelectorAll(BLOCKS)) {
      const block = rowOf(el);
      if (block === out[out.length - 1] || !el.getClientRects().length) {
        continue;
      }
      if (block === el ? ownsText(el) : block.innerText.trim()) {
        out.push(block);
      }
    }
    return out;
  }

  // The keys walk on from the lit block while it is on screen. With none, or after the
  // page was scrolled away from it, the walk starts again at the edge of what is shown.
  function stepBlock(delta) {
    const blocks = readableBlocks();
    const view = bodyEl.getBoundingClientRect();
    let index = blockOn ? blocks.indexOf(blockOn) : -1;
    if (index >= 0 && onScreen(blockOn, view)) {
      index += delta;
    } else if (delta > 0) {
      index = blocks.findIndex((el) => el.getBoundingClientRect().top >= view.top - 1);
    } else {
      index = -1;
      blocks.forEach((el, i) => {
        if (el.getBoundingClientRect().bottom <= view.bottom + 1) {
          index = i;
        }
      });
    }
    // Past the first or the last block there is still the page's own margin to show.
    if (index < 0 || index >= blocks.length) {
      bodyEl.scrollTop = delta > 0 ? bodyEl.scrollHeight : 0;
      return;
    }
    lightBlock(blocks[index], true);
    keepInView(blocks[index]);
  }

  function onScreen(el, view) {
    const rect = el.getBoundingClientRect();
    return rect.bottom > view.top && rect.top < view.bottom;
  }

  const BLOCK_MARGIN = 32;

  // The pane moves only as far as it must, the way a caret pulls a page along; a block
  // taller than the pane is shown from its top.
  function keepInView(el) {
    const rect = el.getBoundingClientRect();
    const view = bodyEl.getBoundingClientRect();
    if (rect.top < view.top + BLOCK_MARGIN || rect.height > view.height - 2 * BLOCK_MARGIN) {
      bodyEl.scrollTop += rect.top - view.top - BLOCK_MARGIN;
    } else if (rect.bottom > view.bottom - BLOCK_MARGIN) {
      bodyEl.scrollTop += rect.bottom - view.bottom + BLOCK_MARGIN;
    }
  }

  // The block lit when the keys left for the tree, so coming back carries on from it.
  let blockLeft = null;

  // Coming in from the tree lights the first block, or the one the keys were on when
  // they last left this page. Any other file only takes the focus, and the arrows then
  // scroll it the way they scroll any box.
  function enterText() {
    if (!readingMarkdown()) {
      blockLeft = null;
      bodyEl.focus({ preventScroll: true });
      return;
    }
    const blocks = readableBlocks();
    const block = blocks.includes(blockLeft) ? blockLeft : blocks[0];
    blockLeft = null;
    bodyEl.focus({ preventScroll: true });
    if (block) {
      lightBlock(block, true);
      keepInView(block);
    }
  }

  // Only a file being read gives the focus back, not one being edited, and only while the
  // focus is on the page itself rather than in a box laid over it.
  function leaveText(target) {
    if (!readingFile() || !(target === document.body || bodyEl.contains(target))) {
      return false;
    }
    blockLeft = blockByKey ? blockOn : null;
    lightBlock(null);
    treeEl.focus({ preventScroll: true });
    return true;
  }

  // While the find in the page has hits the arrows step through them, wherever the focus
  // is; otherwise they walk the blocks, unless something else is taking the typing.
  function arrowKey(delta, target) {
    if (!menuEl.hidden || !tagPickerEl.hidden) {
      return false;
    }
    if (searchOpen && matches.length) {
      step(delta);
      return true;
    }
    if (!readingMarkdown() || (target && target.closest && target.closest("input, textarea, select, #tree"))) {
      return false;
    }
    stepBlock(delta);
    return true;
  }

  // Lifted out of its list an item loses the mark that made it one, so the mark is written
  // back in front of the text the way it is read aloud.
  function blockText(block) {
    const item = itemOf(block);
    const mark = item ? marker(item) : "";
    return mark ? mark + " " + block.innerText : block.innerText;
  }

  // A loose list wraps an item's text in a paragraph, and that paragraph is the item.
  function itemOf(block) {
    if (block.tagName === "LI") {
      return block;
    }
    const parent = block.parentElement;
    const loose = block.tagName === "P" && parent && parent.tagName === "LI";
    return loose && parent.firstElementChild === block ? parent : null;
  }

  const ALPHA = { a: 97, A: 65 };

  // A bullet reads as a dash; a count keeps the number or letter the browser drew, and the
  // dot that goes with it.
  function marker(item) {
    const list = item.parentElement;
    if (!list) {
      return "";
    }
    if (list.tagName === "UL") {
      return "-";
    }
    if (list.tagName !== "OL") {
      return "";
    }
    const items = [...list.children].filter((el) => el.tagName === "LI");
    const start = Number(list.getAttribute("start")) || 1;
    const value = Number(item.getAttribute("value")) || start + items.indexOf(item);
    const base = ALPHA[list.getAttribute("type")];
    return (base === undefined ? String(value) : letters(value, base)) + ".";
  }

  // Past z the count carries, the way a spreadsheet names its columns.
  function letters(value, base) {
    let out = "";
    for (let n = Math.max(1, value); n > 0; n = Math.floor((n - 1) / 26)) {
      out = String.fromCharCode(base + ((n - 1) % 26)) + out;
    }
    return out;
  }

  function copyBlock(text) {
    copyText(text);
    const line = text.replace(/\s+/g, " ").trim();
    toast("copied to clipboard: " + (line.length > 60 ? line.slice(0, 60) + "…" : line));
  }

  const FLASH_MS = 1100;

  // A mark is laid over what it points at rather than put into it, so the page is never
  // rewritten and no anchor, selection or scroll position is disturbed.
  function flashMark(rects, kind) {
    const box = bodyEl.getBoundingClientRect();
    for (const rect of rects) {
      if (rect.width < 1 || rect.height < 1) {
        continue;
      }
      const mark = document.createElement("div");
      mark.className = "flash-mark " + kind;
      mark.style.left = rect.left - box.left + bodyEl.scrollLeft + "px";
      mark.style.top = rect.top - box.top + bodyEl.scrollTop + "px";
      mark.style.width = rect.width + "px";
      mark.style.height = rect.height + "px";
      bodyEl.appendChild(mark);
      setTimeout(() => mark.remove(), FLASH_MS);
    }
  }

  // A run of text is filled line by line, because that is the shape it actually has.
  function flashRange(range) {
    if (range) {
      flashMark(range.getClientRects(), "flash-fill");
    }
  }

  // A whole element is ringed instead: one box, and its own text stays plain to read.
  function flashOutline(element) {
    flashMark([element.getBoundingClientRect()], "flash-outline");
  }

  document.addEventListener("pointerdown", (event) => {
    if (!menuEl.hidden && !menuEl.contains(event.target)) {
      closeMenu();
    }
    // The colour menu opens over the picker, and the header's own tag buttons toggle it,
    // so neither counts as a click away from it.
    const target = event.target;
    if (
      !tagPickerEl.hidden &&
      !tagPickerEl.contains(target) &&
      !menuEl.contains(target) &&
      !addTagEl.contains(target) &&
      !headerTagsEl.contains(target)
    ) {
      closeTagPicker();
    }
  }, true);

  const CORNER_WIDTH = 72;
  const CORNER_HEIGHT = 40;

  // The tree's buttons come up only while the pointer is in the corner they sit in, so
  // crossing the rows on the way to a file does not keep throwing them over the names.
  // The side is listened to rather than the tree, because the scrollbar lies over the
  // tree's right edge and takes the pointer there.
  sideEl.addEventListener("pointermove", (event) => {
    const box = treeEl.getBoundingClientRect();
    const near =
      event.clientX >= box.right - CORNER_WIDTH &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.top + CORNER_HEIGHT;
    treeToolsEl.classList.toggle("near", near);
  });

  sideEl.addEventListener("pointerleave", () => treeToolsEl.classList.remove("near"));

  window.addEventListener("blur", closeMenu);
  bodyEl.addEventListener("scroll", closeMenu);
  treeEl.addEventListener("scroll", closeMenu);

  treeEl.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".row")) {
      return;
    }
    event.preventDefault();
    if (event.target === treeEl && Date.now() - keyMenuAt < KEY_MENU_MS) {
      keyMenuAt = 0;
      return;
    }
    openMenu(event.clientX, event.clientY, makeItems(""));
  });

  // The rows on screen, top to bottom, which is the order the keys walk them in.
  function treeRows() {
    return [...treeEl.querySelectorAll(".row")];
  }

  // The keys start on the open file. A row they were on that has gone, trashed or folded
  // away, leaves them on whatever row now stands where it stood.
  function cursorRow(rows) {
    rows = rows || treeRows();
    const own = (path) => rows.find((row) => row.dataset.path === path);
    return (
      (cursor !== null && own(cursor)) ||
      (cursor === null && own(selected)) ||
      rows[Math.min(cursorIndex, rows.length - 1)] ||
      null
    );
  }

  function markCursor(row) {
    if (row) {
      cursor = row.dataset.path;
    }
    for (const el of treeEl.querySelectorAll(".row.cursor")) {
      el.classList.remove("cursor");
    }
    const rows = treeRows();
    const index = rows.findIndex((el) => el.dataset.path === cursor);
    if (index >= 0) {
      rows[index].classList.add("cursor");
      cursorIndex = index;
    }
  }

  const OPEN_DELAY_MS = 150;
  let openTimer = 0;
  // A file the keys asked to step into before it had arrived; it is stepped into when it does.
  let pendingEnter = null;

  // A file the keys land on opens, as a click would; held down, the key runs past the
  // files on the way without opening each of them.
  function moveCursor(row) {
    clearTimeout(openTimer);
    pendingEnter = null;
    markCursor(row);
    const rect = row.getBoundingClientRect();
    const view = treeEl.getBoundingClientRect();
    if (rect.top < view.top) {
      treeEl.scrollTop += rect.top - view.top;
    } else if (rect.bottom > view.bottom) {
      treeEl.scrollTop += rect.bottom - view.bottom;
    }
    if (!row.dataset.dir) {
      const path = row.dataset.path;
      openTimer = setTimeout(() => openFile(path), OPEN_DELAY_MS);
    }
  }

  function parentRow(row) {
    const li = row.parentElement.parentElement.parentElement;
    return li && li.tagName === "LI" ? li.querySelector(":scope > .row") : null;
  }

  function enterFile(path) {
    clearTimeout(openTimer);
    if (current && current.path === path) {
      if (readingFile()) {
        enterText();
      }
      return;
    }
    pendingEnter = path;
    openFile(path);
  }

  // The row's own right click, so a menu opened from the keys is the very same menu.
  function openRowMenu(row) {
    const anchor = row ? row.querySelector(".label") || row : treeEl;
    const box = anchor.getBoundingClientRect();
    menuReturn = treeEl;
    menuKeys = true;
    (row || treeEl).dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: box.left,
        clientY: row ? box.bottom : box.top
      })
    );
    menuKeys = false;
    if (menuEl.hidden) {
      menuReturn = null;
    }
  }

  // Up and Down walk the rows. Right opens a folder, then goes into it; on a file it goes
  // into the page, where the arrows walk a Markdown file's blocks and scroll any other. Left closes a folder, then goes up to the one holding it.
  // Space opens the row's menu, and so do Shift+F10 and the menu key.
  function treeKey(key) {
    const rows = treeRows();
    const row = cursorRow(rows);
    if (key === " ") {
      openRowMenu(row);
      return true;
    }
    if (!row) {
      return false;
    }
    const index = rows.indexOf(row);
    if (key === "ArrowDown" || key === "ArrowUp") {
      const next = index + (key === "ArrowDown" ? 1 : -1);
      moveCursor(rows[Math.min(Math.max(next, 0), rows.length - 1)]);
      return true;
    }
    if (key === "ArrowRight") {
      if (!row.dataset.dir) {
        markCursor(row);
        enterFile(row.dataset.path);
      } else if (!row.dataset.open) {
        markCursor(row);
        row.click();
      } else {
        const child = row.parentElement.querySelector(":scope > ul .row");
        if (child) {
          moveCursor(child);
        }
      }
      return true;
    }
    if (key === "ArrowLeft") {
      if (row.dataset.dir && row.dataset.open) {
        markCursor(row);
        row.click();
      } else {
        const parent = parentRow(row);
        if (parent) {
          moveCursor(parent);
        }
      }
      return true;
    }
    return false;
  }

  // A click puts the keys on the row clicked, so they carry on from there.
  treeEl.addEventListener("pointerdown", (event) => {
    const row = event.target.closest(".row");
    if (row) {
      markCursor(row);
    }
  });

  treeEl.addEventListener("focus", () => markCursor(cursorRow()));

  // A drop lands in a folder, and the tree's own background is the docs root. A file row
  // stands for the folder holding it, so the whole list is a target and nothing is dead.
  function dropInfo(target) {
    if (!dragging || !target || !target.closest) {
      return null;
    }
    const row = target.closest(".row");
    const path = !row
      ? ""
      : row.dataset.dir
        ? row.dataset.path
        : row.dataset.path.split("/").slice(0, -1).join("/");
    const parent = dragging.path.split("/").slice(0, -1).join("/");
    if (path === parent || path === dragging.path || path.startsWith(dragging.path + "/")) {
      return null;
    }
    return { row: row, path: path };
  }

  let dropEl = null;

  function highlightDrop(element) {
    if (dropEl === element) {
      return;
    }
    if (dropEl) {
      dropEl.classList.remove("drop");
    }
    dropEl = element;
    if (dropEl) {
      dropEl.classList.add("drop");
    }
  }

  treeEl.addEventListener("dragover", (event) => {
    const info = dropInfo(event.target);
    highlightDrop(info ? info.row || treeEl : null);
    if (!info) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  treeEl.addEventListener("dragleave", (event) => {
    if (event.target === treeEl) {
      highlightDrop(null);
    }
  });

  treeEl.addEventListener("drop", (event) => {
    const info = dropInfo(event.target);
    highlightDrop(null);
    if (!info) {
      return;
    }
    event.preventDefault();
    vscode.postMessage({
      type: "relocate",
      from: dragging.path,
      to: info.path,
      dir: dragging.dir
    });
    dragging = null;
  });

  const MIN_THUMB = 20;

  // The webview will not style its own scrollbars, so every pane gets one of these: an
  // overlay laid over the pane rather than inside it, so showing it costs no width and
  // never reflows what it sits on. That lets it stay up whenever there is more to scroll.
  // "host" is the positioned box the overlay is placed in, which the pane sits inside.
  function addBar(pane, host) {
    const bar = document.createElement("div");
    bar.className = "bar";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    bar.appendChild(thumb);
    host.appendChild(bar);

    const entry = { pane: pane, bar: bar, thumb: thumb, host: host };
    bars.push(entry);

    pane.addEventListener("scroll", () => drawBar(entry));
    new ResizeObserver(() => drawBar(entry)).observe(pane);
    new MutationObserver(() => drawBar(entry)).observe(pane, { childList: true, subtree: true });

    thumb.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startTop = pane.scrollTop;
      const span = pane.clientHeight - thumb.offsetHeight;
      const reach = pane.scrollHeight - pane.clientHeight;
      const move = (moveEvent) => {
        pane.scrollTop = startTop + ((moveEvent.clientY - startY) * reach) / Math.max(span, 1);
      };
      const up = (upEvent) => {
        thumb.releasePointerCapture(upEvent.pointerId);
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", up);
        bar.classList.remove("held");
      };
      bar.classList.add("held");
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", up);
    });

    drawBar(entry);
    return entry;
  }

  function drawBar(entry) {
    const pane = entry.pane;
    const view = pane.clientHeight;
    const total = pane.scrollHeight;
    const box = pane.getBoundingClientRect();
    const host = entry.host.getBoundingClientRect();
    entry.bar.style.top = box.top - host.top + "px";
    entry.bar.style.height = view + "px";
    if (total <= view + 1) {
      entry.bar.hidden = true;
      return;
    }
    entry.bar.hidden = false;
    const height = Math.max(MIN_THUMB, (view * view) / total);
    entry.thumb.style.height = height + "px";
    entry.thumb.style.transform =
      "translateY(" + ((view - height) * pane.scrollTop) / (total - view) + "px)";
  }

  function refreshBars() {
    for (const entry of bars) {
      drawBar(entry);
    }
  }

  addBar(treeEl, sideEl);
  addBar(tocEl, sideEl);
  addBar(bodyEl, paneEl);
  addBar(optionsBodyEl, optionsDialogEl);

  splitter.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY, [
      { label: "No auto size of the side width", checked: !autoWidth, run: () => setAutoWidth(false) },
      { label: "Auto size the side width to the files", checked: autoWidth, run: () => setAutoWidth(true) }
    ]);
  });

  // Dragging the divider is a width chosen by hand, so the automatic one steps aside.
  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    autoWidth = false;
    splitter.setPointerCapture(event.pointerId);
    const move = (moveEvent) => setSplit(moveEvent.clientX);
    const up = (upEvent) => {
      splitter.releasePointerCapture(upEvent.pointerId);
      splitter.removeEventListener("pointermove", move);
      splitter.removeEventListener("pointerup", up);
      document.body.classList.remove("dragging");
      persist();
    };
    document.body.classList.add("dragging");
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", up);
    event.preventDefault();
  });

  sideSplitter.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY, [
      { label: "Auto size the files", checked: autoSize === "tree", run: () => setAutoSize("tree") },
      { label: "Auto size toc", checked: autoSize === "toc", run: () => setAutoSize("toc") },
      { label: "No auto size", checked: autoSize === "none", run: () => setAutoSize("none") }
    ]);
  });

  // Dragging the seam is a size chosen by hand, so the automatic one steps aside.
  sideSplitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    autoSize = "none";
    sideSplitter.setPointerCapture(event.pointerId);
    const box = sideBodyEl.getBoundingClientRect();
    const move = (moveEvent) => setSideSplit((moveEvent.clientY - box.top) / box.height);
    const up = (upEvent) => {
      sideSplitter.releasePointerCapture(upEvent.pointerId);
      sideSplitter.removeEventListener("pointermove", move);
      sideSplitter.removeEventListener("pointerup", up);
      document.body.classList.remove("dragging-rows");
      persist();
    };
    document.body.classList.add("dragging-rows");
    sideSplitter.addEventListener("pointermove", move);
    sideSplitter.addEventListener("pointerup", up);
    event.preventDefault();
  });

  window.addEventListener("resize", () => {
    setSplit(split);
    fitWidth();
    fitSide();
    fitEditor();
  });

  bodyEl.addEventListener("scroll", scheduleActive);

  function stepTextScale(delta) {
    setTextScale(textScale + delta);
    fitEditor();
    persist();
    scheduleActive();
  }

  toggleEl.addEventListener("click", () => {
    if (!current || !editable(current)) {
      return;
    }
    save();
    const ratio = scrollRatio();
    mode = mode === "edit" ? "preview" : "edit";
    // The mode is the file's own, and it opens in it again next time.
    if (mode === "edit") {
      editing.add(current.path);
    } else {
      editing.delete(current.path);
    }
    persist();
    focusEditor = true;
    draw();
    focusEditor = false;
    applyScrollRatio(ratio);
  });

  // Only the button puts the caret in the editor: a file opening in edit mode from the
  // tree leaves the focus where the keys walking the tree have it.
  let focusEditor = false;

  // Each file keeps how far down it was read, as a share of the way, so a file that changed
  // since still opens near the same place. The share is written a moment after the scroll
  // settles, and at once when another file takes the pane.
  let scrollTimer = 0;
  // The place just put back, kept while pictures still loading can push it down the page.
  let restored = null;

  bodyEl.addEventListener("scroll", () => {
    if (!current) {
      return;
    }
    clearTimeout(scrollTimer);
    const path = current.path;
    scrollTimer = setTimeout(() => rememberScroll(path), 300);
  });

  function rememberScroll(path) {
    clearTimeout(scrollTimer);
    if (!current || current.path !== path) {
      return;
    }
    const ratio = Math.round(scrollRatio() * 10000) / 10000;
    if (scrolls[path] === ratio) {
      return;
    }
    delete scrolls[path];
    if (ratio > 0) {
      scrolls[path] = ratio;
    }
    const paths = Object.keys(scrolls);
    for (const old of paths.slice(0, Math.max(0, paths.length - MAX_SCROLLS))) {
      delete scrolls[old];
    }
    persist();
  }

  function restoreScroll(path) {
    const ratio = scrolls[path] || 0;
    applyScrollRatio(ratio);
    restored = ratio ? { path: path, ratio: ratio, top: bodyEl.scrollTop } : null;
  }

  // A picture that loads after the place was put back makes the page longer; the place is
  // put back again, unless the reader has moved since.
  bodyEl.addEventListener("load", (event) => {
    if (event.target.tagName !== "IMG" || !restored || !current || current.path !== restored.path) {
      return;
    }
    if (Math.abs(bodyEl.scrollTop - restored.top) > 1) {
      restored = null;
      return;
    }
    applyScrollRatio(restored.ratio);
    restored.top = bodyEl.scrollTop;
  }, true);

  // Both modes scroll the same box, so a share of the way down carries over as it is.
  function scrollRatio() {
    const range = bodyEl.scrollHeight - bodyEl.clientHeight;
    return range > 0 ? bodyEl.scrollTop / range : 0;
  }

  function applyScrollRatio(ratio) {
    const range = bodyEl.scrollHeight - bodyEl.clientHeight;
    bodyEl.scrollTop = range > 0 ? Math.round(ratio * range) : 0;
  }

  titleEl.addEventListener("click", () => {
    if (current) {
      copyPath(current.path, true);
    }
  });

  renameEl.addEventListener("click", () => {
    if (current) {
      stashDraft();
      vscode.postMessage({ type: "rename", path: current.path });
    }
  });

  trashEl.addEventListener("click", () => {
    if (current && !inTrash(current.path)) {
      drafts.delete(current.path);
      vscode.postMessage({ type: "trash", path: current.path });
    }
  });

  restoreEl.addEventListener("click", () => {
    if (current && inTrash(current.path)) {
      drafts.delete(current.path);
      vscode.postMessage({ type: "restore", path: current.path });
    }
  });

  // In the trash at the docs root, or in a folder's own .trash.
  function inTrash(path) {
    return path.split("/").slice(0, -1).includes(".trash");
  }

  function applyView() {
    const trashed = !!current && inTrash(current.path);
    trashEl.hidden = trashed || !current;
    restoreEl.hidden = !trashed || !current;
    addTagEl.hidden = trashed || !current;
  }

  document.addEventListener("keydown", (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (!menuEl.hidden && event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    // A box being typed in keeps its keys, as the tag picker's does under a colour menu
    // opened from it.
    if (!menuEl.hidden && !event.target.closest("input, textarea")) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        stepMenu(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.key === "Enter" && menuOn) {
          menuOn.click();
        }
        return;
      }
    }
    if (ctrl && key === "f") {
      event.preventDefault();
      findKey(event);
      return;
    }
    if (!tagPickerEl.hidden && event.key === "Escape") {
      event.preventDefault();
      closeTagPicker();
      return;
    }
    if (optionsOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOptions();
      }
      return;
    }
    // The search across the docs covers the reading pane, so the pane's own keys wait
    // until it is closed again; only saving goes through.
    if (finderOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFinder();
        return;
      }
      if (!(ctrl && key === "s")) {
        return;
      }
    }
    if (!lightboxEl.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        fitLightbox();
        return;
      }
      if (event.key === "+" || event.key === "-") {
        event.preventDefault();
        zoomAt(event.key === "+" ? 1.25 : 1 / 1.25, window.innerWidth / 2, window.innerHeight / 2);
        return;
      }
    }
    if (searchOpen && event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    const plain = !ctrl && !event.altKey && !event.shiftKey;
    const onTree = lightboxEl.hidden && menuEl.hidden && event.target === treeEl;
    if (plain && onTree && treeKey(event.key)) {
      event.preventDefault();
      return;
    }
    // The keys every list in the editor opens its menu with do what Space does here.
    if (onTree && !ctrl && !event.altKey && menuKey(event)) {
      event.preventDefault();
      keyMenuAt = Date.now();
      treeKey(" ");
      return;
    }
    if (plain && lightboxEl.hidden && menuEl.hidden && event.key === "ArrowLeft" && leaveText(event.target)) {
      event.preventDefault();
      return;
    }
    const arrow = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (arrow && plain) {
      if (arrowKey(arrow, event.target)) {
        event.preventDefault();
      }
      return;
    }
    // While the search is up the pages belong to it; closing it gives them back to the
    // headings, which is where they go when there is nothing to step through.
    if (event.key === "PageUp" || event.key === "PageDown") {
      const delta = event.key === "PageDown" ? 1 : -1;
      if (searchOpen && matches.length) {
        event.preventDefault();
        step(delta);
        return;
      }
      if (jumpSection(delta, event.target)) {
        event.preventDefault();
      }
      return;
    }
    if (ctrl && key === "s") {
      event.preventDefault();
      save();
    }
  });

  function menuKey(event) {
    return (event.key === "ContextMenu" && !event.shiftKey) || (event.key === "F10" && event.shiftKey);
  }

  // Those keys have the browser send a menu event of its own, at the tree rather than at a
  // row, once the menu is already open from the key; that one is let go.
  const KEY_MENU_MS = 600;
  let keyMenuAt = 0;

  const FIND_TWICE_MS = 500;
  let findAt = 0;
  let findFocus = null;
  let findWasOpen = false;
  let findPick = "";

  // Ctrl+F finds in the page. A second F soon after, with Ctrl held down the whole time,
  // searches every doc instead, and the find the first press opened is put away again.
  function findKey(event) {
    if (event.repeat) {
      return;
    }
    const now = Date.now();
    if (findAt && now - findAt < FIND_TWICE_MS) {
      findAt = 0;
      if (!findWasOpen) {
        closeSearch();
      }
      openFinder(findFocus, findPick);
      return;
    }
    findAt = now;
    findFocus = document.activeElement;
    findWasOpen = searchOpen;
    findPick = finderOpen ? "" : pickedText();
    if (finderOpen) {
      finderTextEl.focus();
      finderTextEl.select();
      return;
    }
    if (!optionsOpen && article) {
      openSearch(findPick);
    }
  }

  document.addEventListener("keyup", (event) => {
    if (event.key === "Control" || event.key === "Meta") {
      findAt = 0;
    }
  });

  // Paging moves by heading, which is the unit the contents list is written in. The tree
  // and an open editor keep the plain paging they already have.
  function jumpSection(delta, target) {
    if (mode === "edit" || !sections.length || (target && target.closest && target.closest("#tree"))) {
      return false;
    }
    const top = bodyEl.getBoundingClientRect().top;
    const offsets = sections.map((section) => section.heading.getBoundingClientRect().top - top);
    let index = -1;
    if (delta > 0) {
      index = offsets.findIndex((offset) => offset > 1);
    } else {
      // The heading above the top edge, so the first press lands on the section being read.
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i] < -1) {
          index = i;
        }
      }
    }
    if (index < 0) {
      bodyEl.scrollTop = delta > 0 ? bodyEl.scrollHeight : 0;
      return true;
    }
    bodyEl.scrollTop += offsets[index];
    flash(sections[index].own);
    scheduleActive();
    return true;
  }

  function openLightbox(src, alt) {
    lightboxImageEl.alt = alt || "";
    lightboxImageEl.src = src;
    lightboxEl.hidden = false;
    if (lightboxImageEl.complete && lightboxImageEl.naturalWidth) {
      fitLightbox();
    }
  }

  lightboxImageEl.addEventListener("load", fitLightbox);

  function closeLightbox() {
    lightboxEl.hidden = true;
    lightboxImageEl.removeAttribute("src");
  }

  // The image keeps its natural size; scale and pan are one transform, so the
  // aspect ratio can never drift.
  function fitLightbox() {
    const width = lightboxImageEl.naturalWidth;
    const height = lightboxImageEl.naturalHeight;
    if (!width || !height) {
      return;
    }
    lightboxImageEl.style.width = width + "px";
    fitScale = Math.min((window.innerWidth * 0.96) / width, (window.innerHeight * 0.92) / height, 1);
    zoom = fitScale;
    panX = 0;
    panY = 0;
    applyZoom();
  }

  function applyZoom() {
    lightboxImageEl.style.transform =
      "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
    lightboxHintEl.textContent =
      Math.round(zoom * 100) + "%  ·  scroll to zoom, drag to pan, 0 to fit, Escape to close";
  }

  function zoomAt(factor, pointerX, pointerY) {
    const next = Math.min(Math.max(zoom * factor, fitScale * 0.5), 16);
    const centreX = window.innerWidth / 2;
    const centreY = window.innerHeight / 2;
    const ratio = next / zoom;
    panX = pointerX - centreX - (pointerX - centreX - panX) * ratio;
    panY = pointerY - centreY - (pointerY - centreY - panY) * ratio;
    zoom = next;
    applyZoom();
  }

  lightboxEl.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
  }, { passive: false });

  lightboxEl.addEventListener("pointerdown", (event) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = panX;
    const originY = panY;
    let moved = false;

    lightboxEl.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      panX = originX + (moveEvent.clientX - startX);
      panY = originY + (moveEvent.clientY - startY);
      if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 3) {
        moved = true;
        lightboxEl.classList.add("panning");
      }
      applyZoom();
    };
    const up = (upEvent) => {
      lightboxEl.releasePointerCapture(upEvent.pointerId);
      lightboxEl.removeEventListener("pointermove", move);
      lightboxEl.removeEventListener("pointerup", up);
      lightboxEl.classList.remove("panning");
      if (!moved && upEvent.target !== lightboxImageEl) {
        closeLightbox();
      }
    };
    lightboxEl.addEventListener("pointermove", move);
    lightboxEl.addEventListener("pointerup", up);
    event.preventDefault();
  });

  lightboxEl.addEventListener("dblclick", fitLightbox);
  window.addEventListener("resize", () => {
    if (!lightboxEl.hidden) {
      fitLightbox();
    }
  });

  function save() {
    if (mode !== "edit" || !current) {
      return;
    }
    const area = bodyEl.querySelector("textarea");
    if (area) {
      vscode.postMessage({ type: "save", path: current.path, text: area.value });
    }
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "tree") {
      nodes = message.nodes || [];
      trashNodes = message.trash || [];
      rootPrefix = typeof message.root === "string" ? message.root : "";
      if (finderOpen) {
        vscode.postMessage({ type: "corpus" });
      }
      // A rename or a move rewrites the pins, so the tree carries the list that is true now.
      if (Array.isArray(message.pinned)) {
        pinned = new Set(message.pinned);
      }
      drawTree(message.notice || "");
      if (current) {
        titleEl.title = "Copy the path (" + fullPath(current.path) + ")";
      }
    } else if (message.type === "select") {
      selected = message.path;
      visit(message.path);
      cursor = message.path;
      drawTree();
      persist();
    } else if (message.type === "content") {
      // A save fires the watcher, which sends this back. Redrawing then would drop the
      // caret, so an echo of what is already on screen only refreshes the stored copy.
      const area = bodyEl.querySelector("textarea");
      if (area && current && current.path === message.path) {
        if (area.value === message.text) {
          current = message;
          return;
        }
        drafts.set(message.path, area.value);
      }
      // A file rewritten under the reader is the same page, so the place in it is kept.
      const reopened = !!current && current.path === message.path;
      logOpen = logOpen && reopened;
      const anchor = reopened ? captureAnchor() : null;
      flashModified = reopened && !!current.modified && current.modified !== message.modified;
      if (current && !reopened) {
        rememberScroll(current.path);
      }
      current = message;
      if (!reopened) {
        mode = editing.has(message.path) ? "edit" : "preview";
      }
      if (!editable(message)) {
        mode = "preview";
      }
      draw();
      if (anchor) {
        restoreAnchor(anchor);
      } else {
        restoreScroll(message.path);
      }
      if (pendingFind && pendingFind.path === message.path) {
        applyPendingFind();
      }
      if (pendingEnter === message.path) {
        pendingEnter = null;
        if (readingFile() && document.activeElement === treeEl) {
          enterText();
        }
      }
    } else if (message.type === "state") {
      applyState(message);
      setSplit(split);
      setSideSplit(sideSplit);
      setTextScale(textScale);
      setTreeScale(treeScale);
      setLineHeight(lineHeight);
      setMono(mono);
      setHoverStrength(hoverStrength);
      setBlockPad(blockPad);
      setTagSide(tagSide);
      if (selected) {
        visit(selected);
      }
      drawTree();
    } else if (message.type === "saved") {
      drafts.delete(message.path);
      drawTree();
    } else if (message.type === "renamed") {
      if (drafts.has(message.from)) {
        drafts.set(message.to, drafts.get(message.from));
        drafts.delete(message.from);
      }
      selected = message.to;
      if (cursor === message.from) {
        cursor = message.to;
      }
      if (editing.delete(message.from)) {
        editing.add(message.to);
      }
      visits.forEach((path, i) => {
        if (path === message.from) {
          visits[i] = message.to;
        }
      });
      if (message.from in scrolls) {
        scrolls[message.to] = scrolls[message.from];
        delete scrolls[message.from];
      }
      if (current) {
        current.path = message.to;
      }
      persist();
      drawHeaderTags();
    } else if (message.type === "moved") {
      selected = null;
      current = null;
      mode = "preview";
      draw();
      persist();
    } else if (message.type === "marks") {
      tags = message.tags || {};
      colors = message.colors || {};
      tagColors = message.tagColors || {};
      tagShorts = message.tagShorts || {};
      tagStyles = message.tagStyles || {};
      tagOrder = message.tagOrder || [];
      drawTree();
      drawHeaderTags();
      drawTagPicker();
      drawOptions();
      if (finderOpen) {
        runFinder(true);
      }
    } else if (message.type === "corpus") {
      corpus = (message.entries || []).map((entry) => ({
        path: entry.path,
        name: entry.name,
        dir: !!entry.dir,
        lines: typeof entry.text === "string" ? entry.text.split(/\r?\n/) : null
      }));
      if (finderOpen) {
        runFinder(true);
      }
    } else if (message.type === "version") {
      version = message.version || "";
      drawOptions();
    } else if (message.type === "dataFiles") {
      dataFiles = message.files || [];
      drawOptions();
    } else if (message.type === "reads") {
      reads = new Set(message.reads || []);
      drawTree();
    } else if (message.type === "mentions") {
      mentions = message.mentions || {};
      drawTree();
      drawLog();
    } else if (message.type === "prunedTags") {
      const pruned = message.names || [];
      toast(pruned.length ? "pruned " + pruned.length + (pruned.length === 1 ? " tag: " : " tags: ") + pruned.join(", ") : "no tags to prune");
    } else if (message.type === "prefixes") {
      prefixes = message.prefixes || {};
    }
  });

  function editable(content) {
    return content.kind !== "img" && typeof content.text === "string";
  }

  const HIGHLIGHT_ALL = "docs-find";
  const HIGHLIGHT_ONE = "docs-find-on";
  const MAX_MATCHES = 5000;

  let searchOpen = false;
  let searchCase = false;
  let searchWord = false;
  let searchRegex = false;
  let matches = [];
  let matchIndex = -1;

  // A term given, the selection in the page as a rule, takes the place of what was there.
  function openSearch(term) {
    if (!article) {
      return;
    }
    if (term) {
      searchTextEl.value = term;
    }
    searchOpen = true;
    searchEl.hidden = false;
    findEl.classList.add("active");
    searchTextEl.focus();
    searchTextEl.select();
    runSearch();
  }

  function closeSearch() {
    searchOpen = false;
    searchEl.hidden = true;
    findEl.classList.remove("active");
    clearMatches();
  }

  function clearMatches() {
    matches = [];
    matchIndex = -1;
    if (window.CSS && CSS.highlights) {
      CSS.highlights.delete(HIGHLIGHT_ALL);
      CSS.highlights.delete(HIGHLIGHT_ONE);
    }
  }

  // The page is searched as one long run of text, so a phrase that crosses a bold or a
  // link is still found; each hit is mapped back onto the nodes it actually covers.
  function runSearch() {
    clearMatches();
    const pattern = searchPattern();
    if (article && pattern) {
      const nodes = [];
      let text = "";
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        nodes.push({ node: node, from: text.length });
        text += node.nodeValue;
      }
      for (const hit of text.matchAll(pattern)) {
        if (hit[0]) {
          matches.push(spanRange(nodes, hit.index, hit.index + hit[0].length));
        }
        if (matches.length >= MAX_MATCHES) {
          break;
        }
      }
    }
    if (matches.length) {
      matchIndex = 0;
      reveal(matches[0]);
    }
    paint();
    showCount();
  }

  // A regular expression the reader wrote is used as it stands; anything else is matched
  // letter for letter.
  function searchPattern() {
    return makePattern(searchTextEl, searchCase, searchWord, searchRegex);
  }

  // Both searches read their term the same way; a term that is no expression marks the
  // box it was typed in.
  function makePattern(input, matchCase, word, regex, term) {
    term = term === undefined ? input.value : term;
    input.classList.remove("bad");
    if (!term) {
      return null;
    }
    const body = regex ? term : term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const source = word ? "\\b(?:" + body + ")\\b" : body;
    try {
      return new RegExp(source, matchCase ? "g" : "gi");
    } catch {
      input.classList.add("bad");
      return null;
    }
  }

  function spanRange(nodes, from, to) {
    const start = locate(nodes, from);
    const end = locate(nodes, to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  }

  // The nodes are in order and there can be thousands of them, so the one holding an index
  // is halved down to rather than walked to.
  function locate(nodes, index) {
    let low = 0;
    let high = nodes.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (nodes[mid].from <= index) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return { node: nodes[low].node, offset: Math.min(index - nodes[low].from, nodes[low].node.length) };
  }

  // Highlights are painted over the text rather than wrapped around it, so the document
  // keeps the shape the contents list, the anchors and the scroll were measured against.
  function paint() {
    if (!window.CSS || !CSS.highlights || !window.Highlight) {
      return;
    }
    CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...matches));
    const one = matches[matchIndex];
    if (one) {
      CSS.highlights.set(HIGHLIGHT_ONE, new Highlight(one));
    } else {
      CSS.highlights.delete(HIGHLIGHT_ONE);
    }
  }

  function showCount() {
    searchCountEl.textContent = !searchTextEl.value
      ? ""
      : matches.length
        ? matchIndex + 1 + "/" + matches.length
        : "no results";
  }

  function step(delta) {
    if (!matches.length) {
      return;
    }
    matchIndex = (matchIndex + delta + matches.length) % matches.length;
    reveal(matches[matchIndex]);
    paint();
    showCount();
  }

  // Scrolled by hand so only the reading pane moves, and the hit lands a third of the way
  // down the pane instead of hard against its top edge.
  function reveal(range) {
    const rect = range.getBoundingClientRect();
    const view = bodyEl.getBoundingClientRect();
    if (rect.height) {
      bodyEl.scrollTop += rect.top - view.top - view.height / 3;
    }
  }

  function toggleOption(el, value) {
    el.classList.toggle("active", value);
    runSearch();
    return value;
  }

  findEl.addEventListener("pointerdown", () => {
    buttonPick = pickedText();
  });
  findEl.addEventListener("click", () => (searchOpen ? closeSearch() : openSearch(buttonPick)));
  searchCloseEl.addEventListener("click", closeSearch);
  searchPrevEl.addEventListener("click", () => step(-1));
  searchNextEl.addEventListener("click", () => step(1));
  searchTextEl.addEventListener("input", runSearch);
  searchCaseEl.addEventListener("click", () => {
    searchCase = toggleOption(searchCaseEl, !searchCase);
  });
  searchWordEl.addEventListener("click", () => {
    searchWord = toggleOption(searchWordEl, !searchWord);
  });
  searchRegexEl.addEventListener("click", () => {
    searchRegex = toggleOption(searchRegexEl, !searchRegex);
  });

  searchTextEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  });

  // Every hit points at text that a redraw has just thrown away, so the search is dropped
  // and then run again over whatever the pane now holds.
  function draw() {
    clearMatches();
    drawPane();
    if (!searchOpen) {
      return;
    }
    if (article) {
      runSearch();
    } else {
      closeSearch();
    }
  }

  function drawPane() {
    bodyEl.textContent = "";
    tocEl.textContent = "";
    tocEl.hidden = true;
    sideBodyEl.classList.add("no-toc");
    sections = [];
    activeSection = null;
    article = null;
    blockOn = null;
    blockByKey = false;
    blockLeft = null;

    if (!current) {
      headerEl.hidden = true;
      applyView();
      return;
    }

    headerEl.hidden = false;
    titleEl.textContent = current.path.split("/").pop();
    titleEl.title = "Copy the path (" + fullPath(current.path) + ")";
    drawStamps();
    drawHeaderTags();
    toggleEl.hidden = !editable(current);
    toggleEl.classList.toggle("active", mode === "edit");
    toggleEl.title = mode === "edit" ? "Stop editing" : "Edit";
    applyView();
    drawLog();

    if (mode === "edit") {
      drawEditor();
      return;
    }

    if (current.kind === "img") {
      const img = document.createElement("img");
      img.className = "single";
      img.src = current.uri;
      img.alt = current.path;
      img.addEventListener("click", () => openLightbox(img.src, img.alt));
      bodyEl.appendChild(img);
      return;
    }

    article = document.createElement("div");
    article.className = "markdown-body";
    article.innerHTML = current.html || "";
    bodyEl.appendChild(article);
    bodyEl.scrollTop = 0;

    linkNames(article, current.links || {});

    article.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-open]");
      if (link) {
        event.preventDefault();
        expandTo(link.dataset.open, false);
        openFile(link.dataset.open);
        showRow(link.dataset.open, false);
        return;
      }
      const outside = event.target.closest("a[data-workspace]");
      if (outside) {
        event.preventDefault();
        vscode.postMessage({ type: "openWorkspace", path: outside.dataset.workspace });
        return;
      }
      if (event.target.tagName === "IMG") {
        openLightbox(event.target.src, event.target.alt);
      }
    });

    if (current.kind === "md" || current.kind === "html") {
      buildToc();
    }
  }

  // A name in the text that is a file, one of the docs or any other in the workspace, is
  // made a link to it. The host works out which names are files and the page finds them in
  // its text with the same pattern the host read them with; a name already in a link is
  // left as it is.
  const FILE_NAME = /[\w-][\w.\-\\/]*\.[A-Za-z][A-Za-z0-9]{0,5}/g;

  function linkNames(root, links) {
    if (!Object.keys(links).length) {
      return;
    }
    const texts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement.closest("a")) {
        texts.push(node);
      }
    }
    for (const node of texts) {
      const text = node.nodeValue;
      const parts = [];
      let at = 0;
      for (const hit of text.matchAll(FILE_NAME)) {
        const link = links[hit[0]];
        if (!link) {
          continue;
        }
        const a = make("a", "file-link", hit[0]);
        a.href = "#";
        if (link.workspace) {
          a.dataset.workspace = link.path;
          a.title = "Open " + link.path + " in an editor";
        } else {
          a.dataset.open = link.path;
          a.title = fullPath(link.path);
        }
        parts.push(text.slice(at, hit.index), a);
        at = hit.index + hit[0].length;
      }
      if (parts.length) {
        parts.push(text.slice(at));
        node.replaceWith(...parts.filter((part) => part !== ""));
      }
    }
  }

  function drawStamps() {
    const created = formatStamp(current.created);
    const modified = formatStamp(current.modified);
    createdEl.textContent = created;
    createdEl.title = created ? "Created " + created : "";
    modifiedEl.textContent = modified;
    modifiedEl.title = modified ? "Updated " + modified : "";
    drawTimes();
    modifiedEl.classList.remove("flash");
    if (flashModified && modified) {
      void modifiedEl.offsetWidth; // restart the animation on a second update
      modifiedEl.classList.add("flash");
    }
    flashModified = false;
  }

  // One clock for the whole panel: the header's distance, and the log rows on screen. The
  // rows the log is not showing are not in the page at all, so none of them is counted.
  function drawTimes(root) {
    const ago = current ? formatAgo(current.modified) : "";
    agoEl.textContent = ago;
    agoEl.title = ago ? "Updated " + formatStamp(current.modified) : "";
    const log = root || document.getElementById("log");
    if (!log) {
      return;
    }
    for (const when of log.querySelectorAll(".log-when")) {
      const at = Number(when.dataset.at);
      when.textContent = formatAgo(at);
      when.title = formatStamp(at);
    }
  }

  setInterval(() => drawTimes(), AGO_MS);

  // The heading the reader is on is the anchor: after a redraw the same heading is put
  // back the same distance down the pane, so the page does not jump.
  function captureAnchor() {
    if (mode === "edit" || !activeSection) {
      return { ratio: scrollRatio() };
    }
    return {
      text: activeSection.heading.textContent,
      offset:
        activeSection.heading.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top
    };
  }

  function restoreAnchor(anchor) {
    if (anchor.text === undefined) {
      applyScrollRatio(anchor.ratio);
      return;
    }
    const match = sections.find((section) => section.heading.textContent === anchor.text);
    if (!match) {
      return;
    }
    const top = match.heading.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top;
    bodyEl.scrollTop += top - anchor.offset;
    scheduleActive();
  }

  // The log sits above the file it belongs to, so anything added to it pushes the reading
  // line down. Whatever the growth was is given back to the scroll, and the words the eye
  // is on stay where they are.
  function drawLog() {
    const old = document.getElementById("log");
    const before = old ? old.offsetHeight : 0;
    if (old) {
      old.remove();
    }
    const log = current ? buildLog(mentions[current.path]) : null;
    if (log) {
      bodyEl.insertBefore(log, bodyEl.firstChild);
    }
    const after = log ? log.offsetHeight : 0;
    if (bodyEl.scrollTop > 0 && after !== before) {
      bodyEl.scrollTop += after - before;
    }
  }

  function buildLog(items) {
    if (!items || !items.length || !mentionLines) {
      return null;
    }
    const log = document.createElement("div");
    log.id = "log";
    log.className = "log";

    // What was said last is what the reader came for, so the log runs backwards, and the
    // older lines wait behind one button rather than pushing the file down the pane.
    const rows = items.slice().reverse();
    for (const item of logOpen ? rows : rows.slice(0, mentionLines)) {
      const row = document.createElement("div");
      row.className = "log-row " + (item.role === "user" ? "log-you" : "log-them");

      const when = document.createElement("span");
      when.className = "log-when";
      when.dataset.at = String(Date.parse(item.at) || 0);
      row.appendChild(when);

      const said = document.createElement("span");
      said.className = "log-said";
      said.textContent = item.excerpt;
      said.title = item.excerpt;
      row.appendChild(said);

      log.appendChild(row);
    }

    if (rows.length > mentionLines) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "log-more";
      more.textContent = logOpen ? "Show fewer" : "Show " + (rows.length - mentionLines) + " more";
      more.addEventListener("click", () => {
        logOpen = !logOpen;
        drawLog();
      });
      log.appendChild(more);
    }
    drawTimes(log);
    return log;
  }

  function drawEditor() {
    const area = document.createElement("textarea");
    area.spellcheck = false;
    area.value = drafts.has(current.path) ? drafts.get(current.path) : current.text;
    bodyEl.appendChild(area);
    fitEditor(area);
    // The italic name is all a keystroke can change in the tree, so the tree is only
    // rebuilt on the stroke that turns the draft on or off.
    area.addEventListener("input", () => {
      fitEditor(area);
      const dirty = area.value !== current.text;
      const was = drafts.has(current.path);
      if (dirty) {
        drafts.set(current.path, area.value);
      } else {
        drafts.delete(current.path);
      }
      if (dirty !== was) {
        drawTree();
      }
    });
    if (focusEditor) {
      area.focus();
    }
  }

  // The editor grows to its text so the reading pane keeps the only scrollbar.
  function fitEditor(area) {
    const target = area || bodyEl.querySelector("textarea");
    if (!target) {
      return;
    }
    target.style.height = "auto";
    target.style.height = target.scrollHeight + "px";
  }

  function buildToc() {
    const entries = tocEntries();
    if (entries.length < 2) {
      return;
    }
    const list = document.createElement("ul");
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.el.id) {
        entry.el.id = "docs-panel-heading-" + i;
      }
      const li = document.createElement("li");
      li.className = "toc-h" + entry.level;
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = entry.text;
      link.title = entry.text;
      const next = entries[i + 1];
      const section = { heading: entry.el, li: li, own: ownedBy(entry.el, next && next.el) };
      link.addEventListener("click", (event) => {
        event.preventDefault();
        entry.el.scrollIntoView({ block: "start" });
        flash(section.own);
      });
      li.appendChild(link);
      list.appendChild(li);
      sections.push(section);
    }
    tocEl.appendChild(list);
    tocEl.hidden = false;
    sideBodyEl.classList.remove("no-toc");
    fitSide();
    scheduleActive();
  }

  // A block that opens in bold is a heading the author never marked up as one, so it is
  // listed too: a paragraph, or a list item, which is the same habit written as a list.
  function tocEntries() {
    const found = [];
    const bold = [];
    let level = 1;
    for (const el of article.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li")) {
      if (/^H[1-6]$/.test(el.tagName)) {
        level = Number(el.tagName[1]);
        found.push({ el: el, level: level, text: el.textContent });
        continue;
      }
      // A paragraph inside a list is that item's own opening, and is counted as the item.
      if (el.tagName === "P" && el.parentElement !== article) {
        continue;
      }
      const lead = leadBold(el);
      if (lead) {
        const entry = {
          el: el,
          level: Math.min(level + 1 + listDepth(el), 6),
          text: lead.text,
          tail: lead.tail
        };
        found.push(entry);
        bold.push(entry);
      }
    }
    // One bold block on its own is an emphasis, not a habit of writing headings.
    if (bold.length < 2) {
      return found.filter((entry) => entry.tail === undefined);
    }
    widenDuplicates(bold);
    return found;
  }

  // The same bold opening on several blocks names none of them, so every one of those
  // takes the words after it as well and they tell each other apart again.
  function widenDuplicates(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const group = groups.get(entry.text) || [];
      group.push(entry);
      groups.set(entry.text, group);
    }
    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }
      for (const entry of group) {
        if (entry.tail) {
          entry.text += " " + entry.tail;
        }
      }
    }
  }

  // A name runs on through letters, digits, spaces and commas, and stops at the first
  // mark that ends a phrase.
  const NAME_TAIL = /^[\p{L}\p{N} ,]*/u;

  // The bold run a block opens with, if that is how it opens, and the plain text after it.
  // A loose list item wraps its text in a paragraph first, so one step inward is allowed
  // before giving up.
  function leadBold(el) {
    let node = firstNode(el);
    if (node && node.nodeName === "P") {
      node = firstNode(node);
    }
    if (!node || node.nodeName !== "STRONG") {
      return null;
    }
    const text = node.textContent.trim();
    if (!text) {
      return null;
    }
    let rest = "";
    for (let next = node.nextSibling; next; next = next.nextSibling) {
      rest += next.textContent;
    }
    const tail = NAME_TAIL.exec(rest)[0].replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
    return { text: text, tail: tail };
  }

  function firstNode(el) {
    let node = el.firstChild;
    while (node && node.nodeType === 3 && !node.textContent.trim()) {
      node = node.nextSibling;
    }
    return node;
  }

  // The list an item sits in costs it no level of its own; only nesting inside it does.
  function listDepth(el) {
    let depth = 0;
    for (let node = el.parentElement; node && node !== article; node = node.parentElement) {
      if (node.tagName === "UL" || node.tagName === "OL") {
        depth += 1;
      }
    }
    return Math.max(0, depth - 1);
  }

  // An entry owns everything down to the next one.
  function ownedBy(from, stop) {
    const own = [from];
    let node = from.nextElementSibling;
    while (node && node !== stop) {
      own.push(node);
      node = node.nextElementSibling;
    }
    return own;
  }

  let flashTimer = 0;
  let flashed = [];

  function clearFlash() {
    for (const element of flashed) {
      element.classList.remove("flash");
    }
    flashed = [];
  }

  // The mark is taken off when it has faded, so a class never outlives its animation and
  // the next flash has nothing of the last one still on the page to argue with.
  function flash(elements) {
    clearTimeout(flashTimer);
    clearFlash();
    flashed = [...elements];
    void flashed[0].offsetWidth; // restart the animation on a repeated click
    for (const element of flashed) {
      element.classList.add("flash");
    }
    flashTimer = setTimeout(clearFlash, FLASH_MS);
  }

  function scheduleActive() {
    if (activeFrame) {
      return;
    }
    activeFrame = requestAnimationFrame(() => {
      activeFrame = 0;
      markActive();
    });
  }

  // Every section with more than a tenth of itself on screen is marked, so a run of short
  // sections all light up instead of one of them winning the pane.
  function markActive() {
    if (!sections.length || !article) {
      return;
    }
    const view = bodyEl.getBoundingClientRect();
    const end = article.getBoundingClientRect().bottom;
    let first = null;

    for (let i = 0; i < sections.length; i++) {
      const top = sections[i].heading.getBoundingClientRect().top;
      const bottom =
        i + 1 < sections.length ? sections[i + 1].heading.getBoundingClientRect().top : end;
      const shown = Math.min(bottom, view.bottom) - Math.max(top, view.top);
      const active = shown > 0 && shown / Math.max(bottom - top, 1) > ACTIVE_SHARE;
      sections[i].li.classList.toggle("active", active);
      if (active && !first) {
        first = sections[i];
      }
    }

    if (first && first !== activeSection) {
      revealInToc(first.li);
    }
    activeSection = first;
  }

  // Scrolled by hand, not by scrollIntoView: that one drags the reading pane along too.
  // The offset is measured off the list itself, because offsetTop answers to whichever
  // ancestor happens to be positioned, and that is not the pane being scrolled.
  function revealInToc(li) {
    const top = li.getBoundingClientRect().top - tocEl.getBoundingClientRect().top + tocEl.scrollTop;
    const bottom = top + li.offsetHeight;
    if (top < tocEl.scrollTop) {
      tocEl.scrollTop = top;
    } else if (bottom > tocEl.scrollTop + tocEl.clientHeight) {
      tocEl.scrollTop = bottom - tocEl.clientHeight;
    }
  }

  // The file's tags close the file bar, and any of them opens the picker.
  function drawHeaderTags() {
    headerTagsEl.textContent = "";
    if (!current) {
      return;
    }
    for (const tag of byOrder(tags[current.path] || [])) {
      const pill = tagPill(tag);
      pill.addEventListener("click", () => toggleTagPicker(pill));
      headerTagsEl.appendChild(pill);
    }
    fitHeaderTags();
  }

  addTagEl.addEventListener("click", () => toggleTagPicker(addTagEl));

  function toggleTagPicker(anchor) {
    if (!tagPickerEl.hidden) {
      closeTagPicker();
      return;
    }
    if (current && !inTrash(current.path)) {
      const box = anchor.getBoundingClientRect();
      openTagPicker(current.path, box.right - 220, box.bottom + 4);
    }
  }

  let pickerPath = null;
  let pickerIndex = 0;

  function openTagPicker(path, x, y) {
    closeMenu();
    pickerPath = path;
    pickerIndex = 0;
    tagPickerTitleEl.textContent = "Tags of " + path.split("/").pop();
    tagInputEl.value = "";
    tagPickerEl.hidden = false;
    drawTagPicker();
    place(tagPickerEl, x, y);
    tagInputEl.focus();
  }

  function closeTagPicker() {
    if (tagPickerEl.hidden) {
      return;
    }
    tagPickerEl.hidden = true;
    pickerPath = null;
    tagListEl.textContent = "";
    const back = pickerReturn;
    pickerReturn = null;
    if (back) {
      back.focus({ preventScroll: true });
    }
  }

  // Every tag there is, narrowed to what has been typed; a name no tag has yet is offered
  // last, as the tag it would make, so Enter on part of a name picks the tag it names.
  function pickerChoices() {
    const text = tagInputEl.value.replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    const names = byOrder([...new Set(Object.keys(tagColors).concat(tags[pickerPath] || []))]);
    const choices = names
      .filter((name) => name.toLowerCase().includes(lower))
      .map((name) => ({ name: name }));
    if (text && !names.some((name) => name.toLowerCase() === lower)) {
      choices.push({ name: text, fresh: true });
    }
    return choices;
  }

  function drawTagPicker() {
    if (tagPickerEl.hidden || !pickerPath) {
      return;
    }
    const choices = pickerChoices();
    pickerIndex = Math.min(Math.max(pickerIndex, 0), Math.max(choices.length - 1, 0));
    const own = new Set(tags[pickerPath] || []);
    tagListEl.textContent = "";
    if (!choices.length) {
      const empty = document.createElement("p");
      empty.className = "notice";
      empty.textContent = "Type a name to make a tag.";
      tagListEl.appendChild(empty);
      return;
    }
    choices.forEach((choice, index) => {
      const row = document.createElement("div");
      row.className = "tag-choice" + (index === pickerIndex ? " on" : "");

      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = own.has(choice.name) ? "✓" : "";
      row.appendChild(tick);

      const swatch = document.createElement("span");
      swatch.className = "swatch pick t-" + tagColor(choice.name);
      if (!choice.fresh) {
        swatch.title = "Colour";
        swatch.addEventListener("click", (event) => {
          event.stopPropagation();
          const box = swatch.getBoundingClientRect();
          pickTagColor(choice.name, box.left, box.bottom + 4);
        });
      }
      row.appendChild(swatch);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = choice.fresh ? "Add “" + choice.name + "”" : choice.name;
      row.appendChild(name);

      // The input keeps the focus, so typing carries on after a click.
      row.addEventListener("pointerdown", (event) => event.preventDefault());
      row.addEventListener("click", () => {
        pickerIndex = index;
        toggleTag(choice);
      });
      tagListEl.appendChild(row);
    });
    const on = tagListEl.children[pickerIndex];
    if (on) {
      on.scrollIntoView({ block: "nearest" });
    }
  }

  function toggleTag(choice) {
    if (!pickerPath) {
      return;
    }
    const own = tags[pickerPath] || [];
    const next = own.includes(choice.name)
      ? own.filter((name) => name !== choice.name)
      : own.concat(choice.name);
    tags = Object.assign({}, tags, { [pickerPath]: next });
    if (choice.fresh) {
      tagInputEl.value = "";
    }
    vscode.postMessage({ type: "tags", path: pickerPath, tags: next });
    drawTagPicker();
    drawTree();
    drawHeaderTags();
  }

  function pickTagColor(name, x, y) {
    openColorMenu(x, y, tagColor(name), false, (color) => {
      tagColors = Object.assign({}, tagColors, { [name]: color });
      vscode.postMessage({ type: "tagColor", name: name, color: color });
      drawTree();
      drawHeaderTags();
      drawTagPicker();
      drawOptions();
      if (!tagPickerEl.hidden) {
        tagInputEl.focus();
      }
    });
  }

  tagInputEl.addEventListener("input", () => {
    pickerIndex = 0;
    drawTagPicker();
  });

  tagInputEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      pickerIndex += event.key === "ArrowDown" ? 1 : -1;
      drawTagPicker();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = pickerChoices()[pickerIndex];
      if (choice) {
        toggleTag(choice);
      }
    } else if (event.key === "Escape" && menuEl.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeTagPicker();
    }
  });

  let optionsOpen = false;
  let dataFiles = null;
  let version = "";

  function openOptions() {
    closeMenu();
    closeTagPicker();
    if (finderOpen) {
      closeFinder();
    }
    optionsOpen = true;
    optionsLayerEl.hidden = false;
    drawOptions();
    placeOptions();
    optionsDialogEl.focus();
    vscode.postMessage({ type: "dataFiles" });
  }

  function closeOptions() {
    optionsOpen = false;
    optionsLayerEl.hidden = true;
    optionsHeadEl.textContent = "";
    optionsBodyEl.textContent = "";
  }

  // Set on whole pixels. Centred by the stylesheet the box can land on a half one, and
  // every rule and label in it is then smeared over two rows of pixels.
  function placeOptions() {
    if (!optionsOpen) {
      return;
    }
    const top = Math.round(window.innerHeight * 0.06);
    optionsDialogEl.style.top = top + "px";
    optionsDialogEl.style.maxHeight = window.innerHeight - 2 * top + "px";
    optionsDialogEl.style.left = Math.round((window.innerWidth - optionsDialogEl.offsetWidth) / 2) + "px";
  }

  window.addEventListener("resize", placeOptions);

  openOptionsEl.addEventListener("click", openOptions);

  optionsLayerEl.addEventListener("pointerdown", (event) => {
    if (event.target === optionsLayerEl) {
      closeOptions();
    }
  });

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined) {
      el.textContent = text;
    }
    return el;
  }

  // The label is a box of its own so the stylesheet can set its capitals on the button's
  // centre line.
  function makeButton(label, run, className) {
    const button = make("button", className || "opt-button");
    button.type = "button";
    if (label) {
      button.appendChild(make("span", "cap", label));
    }
    button.addEventListener("click", run);
    return button;
  }

  function optionSection(title) {
    const section = make("section", "opt-section");
    section.appendChild(make("h3", "", title));
    optionsBodyEl.appendChild(section);
    return section;
  }

  function optionRow(section, label, controls) {
    const row = make("div", "opt-row");
    const name = make("div", "opt-label");
    for (const part of [].concat(label)) {
      name.appendChild(typeof part === "string" ? make("span", "cap", part) : part);
    }
    const box = make("div", "opt-controls");
    for (const control of controls) {
      box.appendChild(control);
    }
    row.appendChild(name);
    row.appendChild(box);
    section.appendChild(row);
    return row;
  }

  function optionChoice(labels, chosen, apply) {
    const select = make("select", "opt-select");
    labels.forEach((label, index) => {
      const option = make("option", "", label);
      option.value = String(index);
      option.selected = index === chosen;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      apply(Number(select.value));
      drawOptions();
    });
    return select;
  }

  // A number is shown first and its two buttons after it, the pair as wide as a choice
  // box, so the buttons stand in the same column as the boxes above and below them.
  function optionStepper(text, titles, down, up, atMin, atMax) {
    const value = make("span", "opt-value cap", text);
    const smaller = makeButton("", down, "opt-button opt-step");
    smaller.innerHTML = MINUS_ICON;
    smaller.title = titles[0];
    smaller.disabled = atMin;
    const bigger = makeButton("", up, "opt-button opt-step");
    bigger.innerHTML = PLUS_ICON;
    bigger.title = titles[1];
    bigger.disabled = atMax;
    const pair = make("span", "opt-steps");
    pair.append(smaller, bigger);
    return [value, pair];
  }

  function stepHover(delta) {
    setHoverStrength(Math.round(hoverStrength / HOVER_STEP) * HOVER_STEP + delta);
    persist();
    drawOptions();
  }

  function formatSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function stepBlockPad(delta) {
    setBlockPad(blockPad + delta);
    persist();
    drawOptions();
  }

  function stepMentionLines(delta) {
    mentionLines = Math.min(Math.max(mentionLines + delta, 0), MAX_MENTION_LINES);
    logOpen = false;
    persist();
    drawLog();
    drawOptions();
  }

  // Everything the panel keeps of its own: how a page reads, the tags, and the files
  // the panel writes, each of which can be thrown away from here. The head stays put and
  // only what is under it scrolls.
  function drawOptions() {
    if (!optionsOpen) {
      return;
    }
    const scroll = optionsBodyEl.scrollTop;
    optionsHeadEl.textContent = "";
    optionsBodyEl.textContent = "";

    const title = make("h2", "", "Docs Panel options");
    if (version) {
      title.appendChild(make("span", "opt-version", "v" + version));
    }
    optionsHeadEl.appendChild(title);
    const close = makeButton("", closeOptions, "icon");
    close.title = "Close (Escape)";
    close.appendChild(make("span", "glyph", "✕"));
    optionsHeadEl.appendChild(close);

    const reading = optionSection("Reading");
    optionRow(reading, "Text size", optionStepper(
      Math.round(textScale * 100) + "%",
      ["Smaller text", "Bigger text"],
      () => {
        stepTextScale(-TEXT_STEP);
        drawOptions();
      },
      () => {
        stepTextScale(TEXT_STEP);
        drawOptions();
      },
      textScale <= MIN_TEXT,
      textScale >= MAX_TEXT
    ));
    optionRow(reading, "Line spacing", [
      optionChoice(LINE_LABELS, lineHeight, (step) => {
        setLineHeight(step);
        fitEditor();
        persist();
        scheduleActive();
      })
    ]);
    optionRow(reading, "Font", [
      optionChoice(["default", "mono"], mono ? 1 : 0, (choice) => {
        setMono(choice === 1);
        fitEditor();
        persist();
        scheduleActive();
      })
    ]);
    optionRow(reading, "Auto size list height", [
      optionChoice(AUTO_LABELS, AUTO_SIZES.indexOf(autoSize), (choice) => setAutoSize(AUTO_SIZES[choice]))
    ]);
    optionRow(reading, "Auto size side width", [
      optionChoice(["off", "on"], autoWidth ? 1 : 0, (choice) => setAutoWidth(choice === 1))
    ]);
    optionRow(reading, "Block highlight", optionStepper(
      hoverStrength ? hoverStrength + "%" : "off",
      ["Dimmer", "Brighter"],
      () => stepHover(-HOVER_STEP),
      () => stepHover(HOVER_STEP),
      hoverStrength <= 0,
      hoverStrength >= 100
    ));
    optionRow(reading, "Block highlight padding", optionStepper(
      blockPad + "px",
      ["Less padding", "More padding"],
      () => stepBlockPad(-1),
      () => stepBlockPad(1),
      blockPad <= 0,
      blockPad >= MAX_BLOCK_PAD
    ));
    optionRow(reading, "Mentions shown", optionStepper(
      mentionLines ? String(mentionLines) : "off",
      ["Fewer mentions before Show more, none turns them off", "More mentions before Show more"],
      () => stepMentionLines(-1),
      () => stepMentionLines(1),
      mentionLines <= 0,
      mentionLines >= MAX_MENTION_LINES
    ));

    const tree = optionSection("Tree");
    optionRow(tree, "Text size", optionStepper(
      Math.round(treeScale * 100) + "%",
      ["Smaller text in the tree", "Bigger text in the tree"],
      () => stepTreeScale(-TEXT_STEP),
      () => stepTreeScale(TEXT_STEP),
      treeScale <= MIN_TREE + 0.001,
      treeScale >= MAX_TREE - 0.001
    ));
    optionRow(tree, "Tags beside the name", [
      optionChoice(TAG_SIDES, TAG_SIDES.indexOf(tagSide), (choice) => {
        setTagSide(TAG_SIDES[choice]);
        persist();
      })
    ]);

    const folder = optionSection("Folder");
    optionRow(folder, [make("span", "opt-path cap", rootPrefix || "the workspace root")], [
      makeButton("Open settings", () => vscode.postMessage({ type: "settings" }))
    ]);

    const tagBox = optionSection("Tags");
    const names = byOrder(Object.keys(tagColors));
    if (!names.length) {
      tagBox.appendChild(make("p", "notice", "No tags yet. Add one with + in a file's header."));
    }
    const list = make("div", "opt-tags");
    for (const name of names) {
      list.appendChild(tagOptionRow(name, names));
    }
    tagBox.appendChild(list);
    const unused = names.filter((name) => !Object.values(tags).some((own) => own.includes(name))).length;
    if (unused) {
      const prune = makeButton("Prune", () => vscode.postMessage({ type: "pruneTags" }), "opt-button opt-wide");
      prune.title = "Remove the tags no file has";
      optionRow(tagBox, "Tags on no file", [make("span", "opt-dim cap", String(unused)), prune]);
    }

    const data = optionSection("Data files");
    if (!dataFiles) {
      data.appendChild(make("p", "notice", "Reading the sizes…"));
    } else {
      for (const file of dataFiles) {
        const label = make("div", "opt-file");
        label.appendChild(make("span", "opt-name", file.label));
        const where = make("span", "opt-path", file.path);
        where.title = file.path + "\nPurging: " + file.note;
        label.appendChild(where);
        const purge = makeButton("Purge", () => vscode.postMessage({ type: "purge", ids: [file.id] }), "opt-button danger");
        purge.disabled = file.size < 0;
        optionRow(data, [label], [
          make("span", "opt-dim cap", file.size < 0 ? "none" : formatSize(file.size)),
          purge
        ]);
      }
    }
    fitPillHeights(optionsBodyEl);
    optionsBodyEl.scrollTop = scroll;
  }

  // The style a tag's pill can take besides its colour, each a button that is lit while on.
  const STYLE_BUTTONS = [
    { flag: "bold", title: "Bold", html: "<b>B</b>" },
    { flag: "italic", title: "Italic", html: "<i>I</i>" },
    { flag: "underline", title: "Underline", html: "<u>U</u>" },
    { flag: "white", title: "White text", html: '<span class="opt-white">A</span>' },
    {
      flag: "square",
      title: "Square corners",
      html: '<svg viewBox="0 0 11 9" width="11" height="9" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1" d="M.5 .5h10v8H.5z"/></svg>'
    }
  ];

  // One tag: its letters, which open a menu for its colour and letters, its name, which
  // renames it, its style, and a way to delete it. The row is dragged to move the tag in
  // the order every list of tags follows.
  function tagOptionRow(name, names) {
    const used = Object.values(tags).filter((own) => own.includes(name)).length;
    const style = tagStyles[name] || {};

    const letters = tagPill(name);
    letters.classList.add("short", "opt-short");
    letters.firstChild.textContent = letters.dataset.short;
    letters.title = "Colour and letters";
    letters.addEventListener("click", () => {
      const box = letters.getBoundingClientRect();
      openMenu(box.left, box.bottom + 4, [
        { label: "Colour…", run: () => pickTagColor(name, box.left, box.bottom + 4) },
        { label: "Change letters…", run: () => vscode.postMessage({ type: "tagShort", name: name }) }
      ]);
    });

    const label = make("span", "opt-name opt-rename cap", name);
    label.title = "Click to rename";
    label.addEventListener("click", () => vscode.postMessage({ type: "renameTag", name: name }));

    const buttons = STYLE_BUTTONS.map((item) => {
      const button = makeButton("", () => setTagStyle(name, { [item.flag]: !style[item.flag] }), "opt-button opt-toggle");
      button.innerHTML = item.html;
      button.title = item.title;
      button.classList.toggle("active", !!style[item.flag]);
      button.setAttribute("aria-pressed", style[item.flag] ? "true" : "false");
      return button;
    });

    const wrap = make("input", "opt-wrap");
    wrap.type = "text";
    wrap.spellcheck = false;
    wrap.maxLength = 4;
    wrap.value = style.wrap || "";
    wrap.placeholder = "[ ]";
    wrap.title = "Characters to put the name between, as in []";
    wrap.addEventListener("change", () => {
      setTagStyle(name, { wrap: Array.from(wrap.value.replace(/\s+/g, "")).slice(0, 2).join("") });
    });
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        wrap.blur();
      }
    });

    const row = optionRow(make("div"), [letters, label], [
      make("span", "opt-dim cap", used + (used === 1 ? " file" : " files")),
      ...buttons,
      wrap,
      makeButton("Delete", () => vscode.postMessage({ type: "deleteTag", name: name }), "opt-button opt-wide danger")
    ]);
    row.classList.add("opt-tag");
    row.dataset.name = name;
    dragTagRow(row, name, names);
    return row;
  }

  function setTagStyle(name, change) {
    const style = Object.assign({}, tagStyles[name], change);
    for (const key of Object.keys(style)) {
      if (!style[key]) {
        delete style[key];
      }
    }
    tagStyles = Object.assign({}, tagStyles, { [name]: style });
    vscode.postMessage({ type: "tagStyle", name: name, style: style });
    drawTree();
    drawHeaderTags();
    drawOptions();
  }

  // A row is dropped above or below the one under the pointer, whichever half it is in. A
  // row is only draggable while the press is not in its box for the wrap, so the text in
  // that box can still be chosen with the pointer.
  let tagDrag = null;

  function dragTagRow(row, name, names) {
    row.addEventListener("pointerdown", (event) => {
      row.draggable = !event.target.closest("input");
    });
    row.addEventListener("dragstart", (event) => {
      tagDrag = name;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", name);
      row.classList.add("dragged");
    });
    row.addEventListener("dragend", () => {
      tagDrag = null;
      row.classList.remove("dragged");
      markTagDrop(null);
    });
    row.addEventListener("dragover", (event) => {
      if (!tagDrag) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markTagDrop(row, dropsAfter(row, event));
    });
    row.addEventListener("drop", (event) => {
      if (!tagDrag) {
        return;
      }
      event.preventDefault();
      const moved = tagDrag;
      const after = dropsAfter(row, event);
      tagDrag = null;
      markTagDrop(null);
      if (moved === name) {
        return;
      }
      const order = names.filter((other) => other !== moved);
      order.splice(order.indexOf(name) + (after ? 1 : 0), 0, moved);
      tagOrder = order;
      vscode.postMessage({ type: "tagOrder", names: order });
      drawTree();
      drawHeaderTags();
      drawTagPicker();
      drawOptions();
    });
  }

  function dropsAfter(row, event) {
    const box = row.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2;
  }

  function markTagDrop(row, after) {
    for (const el of optionsBodyEl.querySelectorAll(".drop-before, .drop-after")) {
      el.classList.remove("drop-before", "drop-after");
    }
    if (row) {
      row.classList.add(after ? "drop-after" : "drop-before");
    }
  }

  const MAX_FINDER_HITS = 2000;
  const MAX_FILE_HITS = 200;
  const MAX_LINE_HITS = 50;
  const EXCERPT_LEAD = 40;
  const EXCERPT_MAX = 220;
  const FINDER_PAGE = 10;

  let finderOpen = false;
  let corpus = null;
  let finderCase = false;
  let finderWord = false;
  let finderRegex = false;
  let finderItems = [];
  let finderIndex = -1;
  let finderTimer = 0;
  let finderReturn = null;
  let pendingFind = null;

  // The search covers the reading pane rather than replacing it, so whatever was open is
  // still there underneath when it closes.
  function openFinder(returnTo, term) {
    if (term) {
      finderTextEl.value = term;
    }
    if (finderOpen) {
      finderTextEl.focus();
      finderTextEl.select();
      if (term) {
        runFinder();
      }
      return;
    }
    closeMenu();
    closeTagPicker();
    if (optionsOpen) {
      closeOptions();
    }
    if (!lightboxEl.hidden) {
      closeLightbox();
    }
    finderReturn = returnTo || document.activeElement;
    finderOpen = true;
    finderEl.hidden = false;
    finderTextEl.focus();
    finderTextEl.select();
    vscode.postMessage({ type: "corpus" });
    runFinder();
  }

  // A file opened while the search is up takes the pane back, and the focus goes where the
  // click that opened it left it rather than to where it was before the search.
  function closeFinder(keepFocus) {
    finderOpen = false;
    finderEl.hidden = true;
    clearTimeout(finderTimer);
    const back = finderReturn;
    finderReturn = null;
    if (!keepFocus && back && back !== document.body && back.isConnected && back.offsetParent !== null) {
      back.focus();
    }
  }

  // The button toggles: pressed again it puts the search away, back to the file it covered.
  // The selection is read as the button is pressed, before the press can take it away.
  let buttonPick = "";
  findAllEl.addEventListener("pointerdown", () => {
    buttonPick = pickedText();
  });
  findAllEl.addEventListener("click", () => (finderOpen ? closeFinder() : openFinder(null, buttonPick)));
  finderCloseEl.addEventListener("click", closeFinder);
  finderTextEl.addEventListener("input", () => {
    clearTimeout(finderTimer);
    finderTimer = setTimeout(() => runFinder(), 40);
  });

  function finderOption(el, value) {
    el.classList.toggle("active", value);
    runFinder();
    finderTextEl.focus();
    return value;
  }

  finderCaseEl.addEventListener("click", () => {
    finderCase = finderOption(finderCaseEl, !finderCase);
  });
  finderWordEl.addEventListener("click", () => {
    finderWord = finderOption(finderWordEl, !finderWord);
  });
  finderRegexEl.addEventListener("click", () => {
    finderRegex = finderOption(finderRegexEl, !finderRegex);
  });

  // The arrows only ever move the pick: the caret stays put and the focus stays here.
  finderTextEl.addEventListener("keydown", (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      if (ctrl) {
        jumpGroup(delta);
      } else {
        moveFinder(finderIndex + delta);
      }
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      event.stopPropagation();
      moveFinder(finderIndex + (event.key === "PageDown" ? FINDER_PAGE : -FINDER_PAGE));
    } else if (event.key === "Enter") {
      event.preventDefault();
      activateFinder();
    }
  });

  // What is being searched for, without any scope written in front of it.
  let finderTerm = "";

  // Names come first, folders and files alike, because a name that matches is most often
  // what was being looked for; the files that only match inside follow in tree order.
  function runFinder(keep) {
    const scope = parseScope(finderTextEl.value);
    if (scope) {
      runScoped(scope, keep);
      return;
    }
    finderTerm = finderTextEl.value;
    const pattern = makePattern(finderTextEl, finderCase, finderWord, finderRegex);
    const named = [];
    const inside = [];
    const found = { total: 0, capped: false };
    if (pattern && corpus) {
      for (const entry of corpus) {
        const group = searchEntry(entry, pattern, found);
        if (group.name.length) {
          named.push(group);
        } else if (group.hits.length) {
          inside.push(group);
        }
      }
    }
    drawFinder([{ groups: named.concat(inside) }], !!pattern, found.capped, keep);
  }

  function searchEntry(entry, pattern, found) {
    const group = { entry: entry, name: rangesIn(entry.name, pattern), hits: [], more: 0, count: 0 };
    if (entry.lines) {
      if (found.total < MAX_FINDER_HITS) {
        scanLines(entry.lines, pattern, group);
        found.total += group.hits.length;
      } else {
        found.capped = true;
      }
    }
    return group;
  }

  // "tag:", "file:" or "folder:" in front, then a name or part of one, quoted when it has a
  // space or a comma in it, then what to search for. Several names are split by commas, with
  // or without space around them, and any of them lets a file in; one left empty among
  // others is dropped. Nothing to search for lists every file let in.
  const SCOPE = /^\s*(tag|file|folder):/i;
  const SCOPE_NAME = /^(?:"([^"]*)"?|([^\s,]*))/;
  const SCOPE_COMMA = /^\s*,\s*/;

  function parseScope(text) {
    const head = SCOPE.exec(text);
    if (!head) {
      return null;
    }
    let rest = text.slice(head[0].length);
    const names = [];
    for (;;) {
      const name = SCOPE_NAME.exec(rest);
      names.push((name[1] !== undefined ? name[1] : name[2]).trim().toLowerCase());
      rest = rest.slice(name[0].length);
      const comma = SCOPE_COMMA.exec(rest);
      if (!comma) {
        break;
      }
      rest = rest.slice(comma[0].length);
    }
    const kept = names.filter((name) => name);
    return {
      kind: head[1].toLowerCase(),
      names: names.length > 1 && kept.length ? kept : [names[0] || ""],
      term: rest.replace(/^\s+/, "")
    };
  }

  // A name the scope can take back as it is: quoted when it would otherwise be cut short.
  function scopeName(name) {
    return /[\s,"]/.test(name) ? '"' + name.replace(/"/g, "") + '"' : name;
  }

  // A tag clicked in the tree searches the files with it. With the search up already it
  // takes the place of whatever scope is there and keeps what is searched for; with Shift
  // held it joins the tags already there instead.
  function searchTag(name, add) {
    const scope = finderOpen ? parseScope(finderTextEl.value) : null;
    const term = !finderOpen ? "" : scope ? scope.term : finderTextEl.value.trim();
    const names = add && scope && scope.kind === "tag" ? scope.names.filter((other) => other) : [];
    if (!names.includes(name.toLowerCase())) {
      names.push(name);
    }
    finderTextEl.value = "tag:" + names.map(scopeName).join(",") + " " + term;
    if (finderOpen) {
      finderTextEl.focus();
      runFinder();
    } else {
      openFinder();
    }
    finderTextEl.setSelectionRange(finderTextEl.value.length, finderTextEl.value.length);
  }

  // The files a scope lets in, grouped by what let them in: each tag whose name holds the
  // part written, each folder whose name does, or, for files, each file on its own. A file
  // under two such folders is given to the nearer one.
  function scopeSections(scope) {
    const files = corpus.filter((entry) => !entry.dir);
    const fits = (name) => scope.names.some((part) => name.toLowerCase().includes(part));
    if (scope.kind === "file") {
      return [{ files: files.filter((entry) => fits(entry.name)) }];
    }
    if (scope.kind === "tag") {
      const names = byOrder([...new Set(Object.keys(tagColors).concat(...Object.values(tags)))].filter(fits));
      return names.map((name) => ({
        head: { kind: "tag", name: name },
        files: files.filter((entry) => (tags[entry.path] || []).includes(name))
      }));
    }
    const folders = corpus.filter((entry) => entry.dir && fits(entry.name));
    return folders.map((folder) => ({
      head: { kind: "folder", name: folder.name, path: folder.path },
      files: files.filter((entry) => {
        const near = folders.filter((other) => entry.path.startsWith(other.path + "/"));
        return near.length && near[near.length - 1] === folder;
      })
    }));
  }

  function runScoped(scope, keep) {
    finderTerm = scope.term;
    const pattern = scope.term
      ? makePattern(finderTextEl, finderCase, finderWord, finderRegex, scope.term)
      : null;
    if (scope.term && !pattern) {
      drawFinder([], true, false, keep);
      return;
    }
    const found = { total: 0, capped: false };
    const sections = [];
    for (const section of corpus ? scopeSections(scope) : []) {
      const groups = [];
      for (const entry of section.files) {
        if (!pattern) {
          const parts = scope.names.filter((name) => name);
          const part = scope.kind === "file" && parts.length ? rangesIn(entry.name, partPattern(parts)) : [];
          groups.push({ entry: entry, name: part, hits: [], more: 0, count: 0 });
          continue;
        }
        const group = searchEntry(entry, pattern, found);
        if (group.name.length || group.hits.length) {
          groups.push(group);
        }
      }
      if (groups.length) {
        sections.push({ head: section.head, groups: groups });
      }
    }
    drawFinder(sections, true, found.capped, keep);
  }

  function partPattern(parts) {
    return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  }

  function scanLines(lines, pattern, group) {
    for (let i = 0; i < lines.length; i++) {
      const ranges = rangesIn(lines[i], pattern);
      if (!ranges.length) {
        continue;
      }
      if (group.hits.length < MAX_FILE_HITS) {
        group.hits.push({ line: i + 1, text: lines[i], ranges: ranges, nth: group.count });
      } else {
        group.more += 1;
      }
      group.count += ranges.length;
    }
  }

  function rangesIn(text, pattern) {
    const out = [];
    pattern.lastIndex = 0;
    let hit;
    while (out.length < MAX_LINE_HITS && (hit = pattern.exec(text))) {
      if (hit[0]) {
        out.push([hit.index, hit.index + hit[0].length]);
      } else {
        pattern.lastIndex += 1;
      }
    }
    return out;
  }

  function finderKey(item) {
    return item ? item.kind + ":" + item.path + ":" + (item.nth === undefined ? "" : item.nth) : "";
  }

  // Each section is headed by what let its files in, when a scope did; a plain search is
  // one section with no head.
  function drawFinder(sections, searched, capped, keep) {
    const kept = keep ? finderKey(finderItems[finderIndex]) : "";
    finderResultsEl.textContent = "";
    finderItems = [];
    let hits = 0;
    let entries = 0;

    for (const section of sections) {
      const holder = section.head ? make("div", "f-section") : finderResultsEl;
      if (section.head) {
        holder.appendChild(sectionHead(section.head, section.groups.length));
        finderResultsEl.appendChild(holder);
      }
      for (const group of section.groups) {
        hits += drawGroup(holder, group);
        entries += 1;
      }
    }

    if (!searched) {
      finderCountEl.textContent = "";
      finderResultsEl.appendChild(
        make("p", "notice", "Type to search the names of files and folders, and the text in the files. " +
          "Start with tag:, file: or folder: and a name, or part of one, to search only the files " +
          "with that tag, of that name, or in that folder; several names split by commas, as in " +
          "tag:plan,draft, take the files of any of them.")
      );
    } else if (!corpus) {
      finderCountEl.textContent = "";
      finderResultsEl.appendChild(make("p", "notice", "Reading the docs…"));
    } else if (!entries) {
      finderCountEl.textContent = "no results";
    } else {
      const files = entries + (entries === 1 ? " entry" : " entries");
      finderCountEl.textContent = hits ? hits + " lines in " + files + (capped ? ", stopped early" : "") : files;
    }

    finderIndex = -1;
    const back = kept ? finderItems.findIndex((item) => finderKey(item) === kept) : -1;
    fitPillHeights(finderResultsEl);
    moveFinder(back >= 0 ? back : 0);
  }

  // A tag is shown as its pill. A folder's head is a row like any other, and shows the
  // folder in the tree.
  function sectionHead(head, count) {
    const row = make("div", "f-row f-title");
    if (head.kind === "tag") {
      row.appendChild(tagPill(head.name));
    } else {
      const icon = make("span", "f-icon");
      icon.innerHTML = FOLDER_ICON;
      row.appendChild(icon);
      row.appendChild(make("span", "f-name", head.path));
      row.title = head.path;
      addFinderItem({ kind: "folder", path: head.path, el: row, head: true });
    }
    row.appendChild(make("span", "f-count", count + (count === 1 ? " file" : " files")));
    return row;
  }

  function drawGroup(holder, group) {
    const entry = group.entry;
    const box = make("div", "f-group");

    const head = make("div", "f-row f-head");
    const icon = make("span", "f-icon");
    icon.innerHTML = entry.dir ? FOLDER_ICON : FILE_ICON;
    head.appendChild(icon);
    head.appendChild(marked(make("span", "f-name"), entry.name, group.name));
    const parent = entry.path.split("/").slice(0, -1).join("/");
    if (parent) {
      head.appendChild(make("span", "f-where", parent));
    }
    if (group.count) {
      head.appendChild(make("span", "f-count", String(group.count)));
    }
    head.title = entry.path;
    box.appendChild(head);
    addFinderItem({ kind: entry.dir ? "folder" : "file", path: entry.path, el: head, head: true });

    for (const hit of group.hits) {
      const row = make("div", "f-row f-hit");
      row.appendChild(make("span", "f-line", String(hit.line)));
      const excerpt = excerptOf(hit.text, hit.ranges);
      row.appendChild(marked(make("span", "f-text"), excerpt.text, excerpt.ranges));
      box.appendChild(row);
      addFinderItem({ kind: "hit", path: entry.path, nth: hit.nth, el: row });
    }
    if (group.more) {
      box.appendChild(make("div", "f-more", group.more + " more lines in this file"));
    }
    holder.appendChild(box);
    return group.hits.length;
  }

  function addFinderItem(item) {
    const index = finderItems.length;
    finderItems.push(item);
    // The input keeps the focus, so the arrows still work after a click.
    item.el.addEventListener("pointerdown", (event) => event.preventDefault());
    item.el.addEventListener("click", () => {
      moveFinder(index);
      activateFinder();
    });
  }

  // A long line is cut to a window that starts a little before its first hit.
  function excerptOf(text, ranges) {
    const lead = text.length - text.trimStart().length;
    let start = lead;
    if (ranges.length && ranges[0][0] - start > EXCERPT_LEAD && text.length - start > EXCERPT_MAX) {
      start = ranges[0][0] - EXCERPT_LEAD;
    }
    const end = Math.min(text.length, start + EXCERPT_MAX);
    const shift = start > lead ? 1 : 0;
    return {
      text: (shift ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""),
      ranges: ranges
        .filter((range) => range[0] >= start && range[1] <= end)
        .map((range) => [range[0] - start + shift, range[1] - start + shift])
    };
  }

  function marked(el, text, ranges) {
    let at = 0;
    for (const range of ranges) {
      if (range[0] > at) {
        el.appendChild(document.createTextNode(text.slice(at, range[0])));
      }
      el.appendChild(make("mark", "", text.slice(range[0], range[1])));
      at = range[1];
    }
    if (at < text.length) {
      el.appendChild(document.createTextNode(text.slice(at)));
    }
    return el;
  }

  // Scrolled by hand, so only the result list moves.
  function moveFinder(index) {
    if (!finderItems.length) {
      finderIndex = -1;
      return;
    }
    const old = finderItems[finderIndex];
    if (old) {
      old.el.classList.remove("on");
    }
    finderIndex = Math.min(Math.max(index, 0), finderItems.length - 1);
    const item = finderItems[finderIndex];
    item.el.classList.add("on");
    const view = finderResultsEl.getBoundingClientRect();
    const box = item.el.getBoundingClientRect();
    if (box.top < view.top) {
      finderResultsEl.scrollTop += box.top - view.top - 4;
    } else if (box.bottom > view.bottom) {
      finderResultsEl.scrollTop += box.bottom - view.bottom + 4;
    }
  }

  // A group is a file or folder and the lines found in it; the pick is in the group of
  // the last heading at or above it.
  function jumpGroup(delta) {
    const heads = [];
    finderItems.forEach((item, index) => {
      if (item.head) {
        heads.push(index);
      }
    });
    if (!heads.length) {
      return;
    }
    let at = 0;
    heads.forEach((head, k) => {
      if (head <= finderIndex) {
        at = k;
      }
    });
    moveFinder(heads[Math.min(Math.max(at + delta, 0), heads.length - 1)]);
  }

  // A folder is shown in the tree; a file is opened, and a line in it is found again in
  // the page with the same term, at the same count of hits from the top.
  function activateFinder() {
    const item = finderItems[finderIndex];
    if (!item) {
      return;
    }
    pendingFind =
      item.kind === "hit"
        ? {
            path: item.path,
            term: finderTerm,
            matchCase: finderCase,
            word: finderWord,
            regex: finderRegex,
            nth: item.nth
          }
        : null;
    closeFinder();
    expandTo(item.path, item.kind === "folder");
    if (item.kind === "folder") {
      drawTree();
      persist();
      showRow(item.path, true);
      return;
    }
    if (item.path === selected) {
      drawTree();
      persist();
      if (current && current.path === item.path) {
        applyPendingFind();
      }
    } else {
      openFile(item.path);
    }
    showRow(item.path, false);
  }

  function expandTo(path, self) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      expanded.add(parts.slice(0, i).join("/"));
    }
    if (self) {
      expanded.add(path);
    }
  }

  // A file needs no mark of its own: it is the one selected.
  function showRow(path, flash) {
    const row = [...treeEl.querySelectorAll(".row")].find((el) => el.dataset.path === path);
    if (!row) {
      return;
    }
    const view = treeEl.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (box.top < view.top || box.bottom > view.bottom) {
      treeEl.scrollTop += box.top - view.top - view.height / 3;
    }
    if (!flash) {
      return;
    }
    row.classList.remove("found");
    void row.offsetWidth; // restart the animation on a repeated jump
    row.classList.add("found");
    setTimeout(() => row.classList.remove("found"), FLASH_MS);
  }

  function applyPendingFind() {
    const find = pendingFind;
    pendingFind = null;
    if (!find || !article || mode === "edit") {
      return;
    }
    searchCase = find.matchCase;
    searchWord = find.word;
    searchRegex = find.regex;
    searchCaseEl.classList.toggle("active", searchCase);
    searchWordEl.classList.toggle("active", searchWord);
    searchRegexEl.classList.toggle("active", searchRegex);
    searchTextEl.value = find.term;
    openSearch();
    // The page is the file rendered, not the file, so the count can come out short; the
    // last hit there is then the nearest one to go to.
    if (matches.length > 1) {
      matchIndex = Math.min(find.nth, matches.length - 1);
      reveal(matches[matchIndex]);
      paint();
      showCount();
    }
  }

  followTheme();
  if (document.fonts) {
    document.fonts.ready.then(followTheme);
  }
  vscode.postMessage({ type: "ready" });
})();
