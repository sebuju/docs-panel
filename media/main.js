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
  const statusEl = document.getElementById("status");
  const headerEl = document.getElementById("header");
  const titleEl = document.getElementById("title");
  const createdEl = document.getElementById("created");
  const modifiedEl = document.getElementById("modified");
  const agoEl = document.getElementById("ago");
  const toastsEl = document.getElementById("toasts");
  const textSmallerEl = document.getElementById("textSmaller");
  const textBiggerEl = document.getElementById("textBigger");
  const lineHeightEl = document.getElementById("lineHeight");
  const fontEl = document.getElementById("font");
  const typeToggleEl = document.getElementById("typeToggle");
  const typeSettingsEl = document.getElementById("typeSettings");
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
  const rootNameEl = document.getElementById("rootName");
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
  const finderEl = document.getElementById("finder");
  const finderTextEl = document.getElementById("finderText");
  const finderCountEl = document.getElementById("finderCount");
  const finderCaseEl = document.getElementById("finderCase");
  const finderWordEl = document.getElementById("finderWord");
  const finderRegexEl = document.getElementById("finderRegex");
  const finderCloseEl = document.getElementById("finderClose");
  const finderResultsEl = document.getElementById("finderResults");

  const PIN_ICON =
    '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">' +
    '<path fill="currentColor" d="M6.2 2H9.8L9.1 3.1 9.6 6 11.2 7.6V8.7H8.5L8 13.8 7.5 8.7H4.8V7.6L6.4 6 6.9 3.1Z"/>' +
    "</svg>";

  const CAN_ICON =
    '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" ' +
    'd="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9h6.6l.7-9M6.6 6.5v4M9.4 6.5v4"/></svg>';

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

  const MIN_SPLIT = 120;
  const MIN_ROW = 60;
  const MIN_TEXT = 0.7;
  const MAX_TEXT = 2.5;
  const TEXT_STEP = 0.1;
  const LINE_HEIGHTS = ["normal", "1.6", "2"];
  const LINE_LABELS = ["tight", "normal", "loose"];
  const ACTIVE_SHARE = 0.1;
  const TRASH_PREFIX = ".trash/";

  let nodes = [];
  let expanded = new Set();
  let selected = null;
  let split = 240;
  let sideSplit = 0.5;
  let textScale = 1;
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
  let statuses = {};
  let tags = {};
  let colors = {};
  let tagColors = {};
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
  let tocAuto = false;

  const saved = vscode.getState();
  if (saved) {
    applyState(saved);
  }
  setSplit(split);
  setSideSplit(sideSplit);
  setTextScale(textScale);
  setLineHeight(lineHeight);
  setMono(mono);

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
    if (typeof state.lineHeight === "number") {
      lineHeight = state.lineHeight;
    }
    if (typeof state.mono === "boolean") {
      mono = state.mono;
    }
    if (typeof state.tocAuto === "boolean") {
      tocAuto = state.tocAuto;
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
      lineHeight: lineHeight,
      mono: mono,
      tocAuto: tocAuto,
      expanded: [...expanded],
      pinned: [...pinned],
      selected: selected
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
  }

  function setSideSplit(value) {
    const height = sideBodyEl.clientHeight || 1;
    const min = Math.min(0.4, MIN_ROW / height);
    sideSplit = Math.min(Math.max(value, min), 1 - min);
    sideBodyEl.style.setProperty("--tree-row", "calc(" + sideSplit * 100 + "% - 2px)");
    refreshBars();
  }

  const TOC_MAX_SHARE = 0.75;

  // Auto size gives the contents list exactly the height its entries need, so it never
  // scrolls; past three quarters of the side the tree would be squeezed out, so it stops.
  function fitToc() {
    const list = tocEl.firstElementChild;
    if (!tocAuto || tocEl.hidden || !list) {
      setSideSplit(sideSplit);
      return;
    }
    // The pane's own scrollHeight is never less than the pane, so it can only ever grow.
    // The list inside it is not a scroller, and its height is the height actually wanted.
    const style = getComputedStyle(tocEl);
    const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const wanted = list.getBoundingClientRect().height + pad + 3;
    const total = sideBodyEl.clientHeight || 1;
    setSideSplit(1 - Math.min(TOC_MAX_SHARE, wanted / total));
  }

  // One scale for every file, so the reading size is a property of the panel.
  function setTextScale(value) {
    textScale = Math.min(Math.max(Math.round(value * 100) / 100, MIN_TEXT), MAX_TEXT);
    layout.style.setProperty("--text-scale", textScale);
    const percent = Math.round(textScale * 100) + "%";
    textSmallerEl.title = "Smaller text (" + percent + ")";
    textBiggerEl.title = "Bigger text (" + percent + ")";
    textSmallerEl.disabled = textScale <= MIN_TEXT;
    textBiggerEl.disabled = textScale >= MAX_TEXT;
  }

  function setLineHeight(value) {
    lineHeight = Math.min(Math.max(Math.round(value) || 0, 0), LINE_HEIGHTS.length - 1);
    layout.style.setProperty("--line-height", LINE_HEIGHTS[lineHeight]);
    lineHeightEl.dataset.step = String(lineHeight);
    lineHeightEl.title = "Line spacing (" + LINE_LABELS[lineHeight] + ")";
  }

  function setMono(value) {
    mono = !!value;
    layout.style.setProperty(
      "--body-font",
      mono ? "var(--vscode-editor-font-family)" : "var(--vscode-font-family)"
    );
    fontEl.classList.toggle("active", mono);
    fontEl.title = mono ? "Font (mono)" : "Font (default)";
  }

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

  function trashFor(at) {
    const node = findNode(trashNodes, TRASH_PREFIX + at);
    return node && node.children ? node.children : [];
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
    return row;
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
      if (!node.dir && statuses[node.path]) {
        const badge = document.createElement("span");
        badge.className = "status status-" + statuses[node.path].replace(/ /g, "-");
        badge.textContent = statuses[node.path];
        badge.title = statuses[node.path];
        row.appendChild(badge);
      }
      if (!node.dir) {
        for (const tag of tags[node.path] || []) {
          row.appendChild(tagPill(tag));
        }
      }

      row.addEventListener("click", () => {
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

  // A tag is drawn the way a status is, in the colour it was given.
  function tagPill(name) {
    const pill = document.createElement("span");
    pill.className = "status tag c-" + tagColor(name);
    pill.textContent = name;
    pill.title = name;
    return pill;
  }

  function tagColor(name) {
    return tagColors[name] || "grey";
  }

  function togglePin(path) {
    if (!pinned.delete(path)) {
      pinned.add(path);
    }
    drawTree();
    persist();
  }

  function openFile(path) {
    if (path === selected) {
      return;
    }
    save();
    selected = path;
    drawTree();
    persist();
    vscode.postMessage({ type: "open", path: path });
  }

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
      if (item.checked !== undefined) {
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = item.checked ? "✓" : "";
        button.appendChild(tick);
      }
      if (item.swatch) {
        const swatch = document.createElement("span");
        swatch.className = "swatch c-" + item.swatch;
        button.appendChild(swatch);
      }
      button.appendChild(document.createTextNode(item.label));
      button.addEventListener("click", () => {
        closeMenu();
        item.run();
      });
      menuEl.appendChild(button);
    }
    menuEl.hidden = false;
    place(menuEl, x, y);
  }

  // A floating box opens at the point asked for, pulled back inside the window.
  function place(el, x, y) {
    el.style.left = "0px";
    el.style.top = "0px";
    const box = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(x, window.innerWidth - box.width - 4)) + "px";
    el.style.top = Math.max(0, Math.min(y, window.innerHeight - box.height - 4)) + "px";
  }

  // "none" is offered only where having no colour at all is a choice; a tag always has one.
  function openColorMenu(x, y, chosen, none, apply) {
    const items = COLORS.map((color) => ({
      label: color,
      swatch: color,
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

  function closeMenu() {
    menuEl.hidden = true;
    menuEl.textContent = "";
  }

  function nodeMenu(node, x, y) {
    const trashed = inTrash(node.path);
    const items = [];
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
    if (!trashed) {
      items.push({ separator: true });
      items.push({
        label: pinned.has(node.path) ? "Unpin" : "Pin to top",
        run: () => togglePin(node.path)
      });
      items.push({
        label: "Colour…",
        run: () => openColorMenu(x, y, colors[node.path], true, (color) => setColor(node, color))
      });
      if (!node.dir) {
        items.push({ label: "Tags…", run: () => openTagPicker(node.path, x, y) });
      }
    }
    items.push({ separator: true });
    if (trashed) {
      items.push({ label: "Put back", run: () => send("restore", node) });
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
    const block = blockAt(event.target);
    const selection = window.getSelection();
    const picked = String(selection).trim();
    // Clicking the menu takes the selection away, so the range is kept as it stands now.
    const range = picked && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    if (!block && !picked) {
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
    openMenu(event.clientX, event.clientY, items);
  });

  function blockAt(el) {
    return el && el.closest && article.contains(el) ? el.closest(BLOCKS) : null;
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

  window.addEventListener("blur", closeMenu);
  bodyEl.addEventListener("scroll", closeMenu);
  treeEl.addEventListener("scroll", closeMenu);

  treeEl.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".row")) {
      return;
    }
    event.preventDefault();
    openMenu(event.clientX, event.clientY, makeItems(""));
  });

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

  splitter.addEventListener("pointerdown", (event) => {
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
      {
        label: "Auto size the contents",
        checked: tocAuto,
        run: () => {
          tocAuto = !tocAuto;
          fitToc();
          persist();
        }
      }
    ]);
  });

  // Dragging the seam is a size chosen by hand, so the automatic one steps aside.
  sideSplitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    tocAuto = false;
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
    fitToc();
    fitEditor();
  });

  bodyEl.addEventListener("scroll", scheduleActive);

  typeToggleEl.addEventListener("click", () => {
    const open = typeSettingsEl.hidden;
    typeSettingsEl.hidden = !open;
    typeToggleEl.classList.toggle("active", open);
    typeToggleEl.setAttribute("aria-expanded", String(open));
  });

  textSmallerEl.addEventListener("click", () => stepTextScale(-TEXT_STEP));
  textBiggerEl.addEventListener("click", () => stepTextScale(TEXT_STEP));

  lineHeightEl.addEventListener("click", () => {
    setLineHeight((lineHeight + 1) % LINE_HEIGHTS.length);
    fitEditor();
    persist();
    scheduleActive();
  });

  fontEl.addEventListener("click", () => {
    setMono(!mono);
    fitEditor();
    persist();
    scheduleActive();
  });

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
    draw();
    applyScrollRatio(ratio);
  });

  // Both modes scroll the same box, so a share of the way down carries over as it is.
  function scrollRatio() {
    const range = bodyEl.scrollHeight - bodyEl.clientHeight;
    return range > 0 ? bodyEl.scrollTop / range : 0;
  }

  function applyScrollRatio(ratio) {
    const range = bodyEl.scrollHeight - bodyEl.clientHeight;
    bodyEl.scrollTop = range > 0 ? Math.round(ratio * range) : 0;
  }

  statusEl.addEventListener("change", () => {
    showStatus(statusEl.value);
    if (current) {
      vscode.postMessage({ type: "status", path: current.path, status: statusEl.value });
    }
  });

  // The pill colour follows the value, so the class list is the single place it is named.
  function showStatus(value) {
    statusEl.value = value || "";
    statusEl.className = "pill-" + (value || "none").replace(/ /g, "-");
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

  function inTrash(path) {
    return path.startsWith(TRASH_PREFIX);
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
      closeMenu();
      return;
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

  const FIND_TWICE_MS = 500;
  let findAt = 0;
  let findFocus = null;
  let findWasOpen = false;

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
      openFinder(findFocus);
      return;
    }
    findAt = now;
    findFocus = document.activeElement;
    findWasOpen = searchOpen;
    if (finderOpen) {
      finderTextEl.focus();
      finderTextEl.select();
      return;
    }
    if (!optionsOpen && article) {
      openSearch();
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
      rootNameEl.textContent = message.name || "";
      rootNameEl.title = rootPrefix;
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
      current = message;
      if (!editable(message)) {
        mode = "preview";
      }
      draw();
      if (anchor) {
        restoreAnchor(anchor);
      }
      if (pendingFind && pendingFind.path === message.path) {
        applyPendingFind();
      }
    } else if (message.type === "state") {
      applyState(message);
      setSplit(split);
      setSideSplit(sideSplit);
      setTextScale(textScale);
      setLineHeight(lineHeight);
      setMono(mono);
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
    } else if (message.type === "statuses") {
      statuses = message.statuses || {};
      tags = message.tags || {};
      colors = message.colors || {};
      tagColors = message.tagColors || {};
      drawTree();
      if (current) {
        showStatus(statuses[current.path]);
      }
      drawHeaderTags();
      drawTagPicker();
      drawOptions();
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

  function openSearch() {
    if (!article) {
      return;
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
  function makePattern(input, matchCase, word, regex) {
    const term = input.value;
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

  findEl.addEventListener("click", () => (searchOpen ? closeSearch() : openSearch()));
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

    if (!current) {
      headerEl.hidden = true;
      applyView();
      return;
    }

    headerEl.hidden = false;
    titleEl.textContent = current.path.split("/").pop();
    titleEl.title = "Copy the path (" + fullPath(current.path) + ")";
    drawStamps();
    showStatus(statuses[current.path]);
    drawHeaderTags();
    toggleEl.hidden = !editable(current);
    toggleEl.classList.toggle("editing", mode === "edit");
    toggleEl.title = mode === "edit" ? "Preview" : "Edit";
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

    article.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-open]");
      if (link) {
        event.preventDefault();
        openFile(link.dataset.open);
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

  const LOG_SHOWN = 5;

  function buildLog(items) {
    if (!items || !items.length) {
      return null;
    }
    const log = document.createElement("div");
    log.id = "log";
    log.className = "log";

    // What was said last is what the reader came for, so the log runs backwards, and the
    // older lines wait behind one button rather than pushing the file down the pane.
    const rows = items.slice().reverse();
    for (const item of logOpen ? rows : rows.slice(0, LOG_SHOWN)) {
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

    if (rows.length > LOG_SHOWN) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "log-more";
      more.textContent = logOpen ? "Show fewer" : "Show " + (rows.length - LOG_SHOWN) + " more";
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
    area.focus();
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
    fitToc();
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

  // The file's tags sit after its status, and any of them opens the picker.
  function drawHeaderTags() {
    headerTagsEl.textContent = "";
    if (!current) {
      return;
    }
    for (const tag of tags[current.path] || []) {
      const pill = tagPill(tag);
      pill.addEventListener("click", () => toggleTagPicker(pill));
      headerTagsEl.appendChild(pill);
    }
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
  }

  // Every tag there is, narrowed to what has been typed; a name no tag has yet is offered
  // last, as the tag it would make, so Enter on part of a name picks the tag it names.
  function pickerChoices() {
    const text = tagInputEl.value.replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    const names = [...new Set(Object.keys(tagColors).concat(tags[pickerPath] || []))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
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
      swatch.className = "swatch pick c-" + tagColor(choice.name);
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

  function openOptions() {
    closeMenu();
    closeTagPicker();
    if (finderOpen) {
      closeFinder();
    }
    optionsOpen = true;
    optionsLayerEl.hidden = false;
    drawOptions();
    optionsDialogEl.focus();
    vscode.postMessage({ type: "dataFiles" });
  }

  function closeOptions() {
    optionsOpen = false;
    optionsLayerEl.hidden = true;
    optionsDialogEl.textContent = "";
  }

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

  function makeButton(label, run, className) {
    const button = make("button", className || "opt-button", label);
    button.type = "button";
    button.addEventListener("click", run);
    return button;
  }

  function optionSection(title) {
    const section = make("section", "opt-section");
    section.appendChild(make("h3", "", title));
    optionsDialogEl.appendChild(section);
    return section;
  }

  function optionRow(section, label, controls) {
    const row = make("div", "opt-row");
    const name = make("div", "opt-label");
    for (const part of [].concat(label)) {
      name.appendChild(typeof part === "string" ? make("span", "", part) : part);
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

  function formatSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  // Everything the panel keeps of its own: how a page reads, the tags, and the files
  // the panel writes, each of which can be thrown away from here.
  function drawOptions() {
    if (!optionsOpen) {
      return;
    }
    const scroll = optionsDialogEl.scrollTop;
    optionsDialogEl.textContent = "";

    const head = make("div", "opt-head");
    head.appendChild(make("h2", "", "Docs Panel options"));
    const close = makeButton("", closeOptions, "icon");
    close.title = "Close (Escape)";
    close.appendChild(make("span", "glyph", "✕"));
    head.appendChild(close);
    optionsDialogEl.appendChild(head);

    const reading = optionSection("Reading");
    const smaller = makeButton("−", () => {
      stepTextScale(-TEXT_STEP);
      drawOptions();
    });
    smaller.disabled = textScale <= MIN_TEXT;
    const bigger = makeButton("+", () => {
      stepTextScale(TEXT_STEP);
      drawOptions();
    });
    bigger.disabled = textScale >= MAX_TEXT;
    optionRow(reading, "Text size", [
      smaller,
      make("span", "opt-value", Math.round(textScale * 100) + "%"),
      bigger
    ]);
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
    optionRow(reading, "Contents list", [
      optionChoice(["sized by hand", "sized to fit"], tocAuto ? 1 : 0, (choice) => {
        tocAuto = choice === 1;
        fitToc();
        persist();
      })
    ]);

    const folder = optionSection("Folder");
    optionRow(folder, [make("span", "opt-path", rootPrefix || "the workspace root")], [
      makeButton("Open settings", () => vscode.postMessage({ type: "settings" }))
    ]);

    const tagBox = optionSection("Tags");
    const names = Object.keys(tagColors).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    if (!names.length) {
      tagBox.appendChild(make("p", "notice", "No tags yet. Add one with + in a file's header."));
    }
    for (const name of names) {
      const used = Object.values(tags).filter((list) => list.includes(name)).length;
      const swatch = make("span", "swatch pick c-" + tagColor(name));
      swatch.title = "Colour";
      swatch.addEventListener("click", () => {
        const box = swatch.getBoundingClientRect();
        pickTagColor(name, box.left, box.bottom + 4);
      });
      optionRow(tagBox, [swatch, make("span", "opt-name", name)], [
        make("span", "opt-dim", used + (used === 1 ? " file" : " files")),
        makeButton("Rename…", () => vscode.postMessage({ type: "renameTag", name: name })),
        makeButton("Delete", () => vscode.postMessage({ type: "deleteTag", name: name }), "opt-button danger")
      ]);
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
          make("span", "opt-dim", file.size < 0 ? "none" : formatSize(file.size)),
          purge
        ]);
      }
      const present = dataFiles.filter((file) => file.size >= 0);
      const total = present.reduce((sum, file) => sum + file.size, 0);
      const all = makeButton(
        "Purge all",
        () => vscode.postMessage({ type: "purge", ids: present.map((file) => file.id) }),
        "opt-button danger"
      );
      all.disabled = !present.length;
      optionRow(data, [make("span", "opt-dim", "Together")], [
        make("span", "opt-dim", formatSize(total)),
        all
      ]);
    }
    optionsDialogEl.scrollTop = scroll;
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
  function openFinder(returnTo) {
    if (finderOpen) {
      finderTextEl.focus();
      finderTextEl.select();
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

  function closeFinder() {
    finderOpen = false;
    finderEl.hidden = true;
    clearTimeout(finderTimer);
    const back = finderReturn;
    finderReturn = null;
    if (back && back !== document.body && back.isConnected && back.offsetParent !== null) {
      back.focus();
    }
  }

  findAllEl.addEventListener("click", () => openFinder());
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

  // Names come first, folders and files alike, because a name that matches is most often
  // what was being looked for; the files that only match inside follow in tree order.
  function runFinder(keep) {
    const pattern = makePattern(finderTextEl, finderCase, finderWord, finderRegex);
    const named = [];
    const inside = [];
    let total = 0;
    let capped = false;
    if (pattern && corpus) {
      for (const entry of corpus) {
        const group = { entry: entry, name: rangesIn(entry.name, pattern), hits: [], more: 0, count: 0 };
        if (entry.lines) {
          if (total < MAX_FINDER_HITS) {
            scanLines(entry.lines, pattern, group);
            total += group.hits.length;
          } else {
            capped = true;
          }
        }
        if (group.name.length) {
          named.push(group);
        } else if (group.hits.length) {
          inside.push(group);
        }
      }
    }
    drawFinder(named.concat(inside), !!pattern, capped, keep);
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

  function drawFinder(groups, searched, capped, keep) {
    const kept = keep ? finderKey(finderItems[finderIndex]) : "";
    finderResultsEl.textContent = "";
    finderItems = [];
    let hits = 0;

    for (const group of groups) {
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
        hits += 1;
      }
      if (group.more) {
        box.appendChild(make("div", "f-more", group.more + " more lines in this file"));
      }
      finderResultsEl.appendChild(box);
    }

    if (!searched) {
      finderCountEl.textContent = "";
      finderResultsEl.appendChild(
        make("p", "notice", "Type to search the names of files and folders, and the text in the files.")
      );
    } else if (!corpus) {
      finderCountEl.textContent = "";
      finderResultsEl.appendChild(make("p", "notice", "Reading the docs…"));
    } else if (!groups.length) {
      finderCountEl.textContent = "no results";
    } else {
      const files = groups.length + (groups.length === 1 ? " entry" : " entries");
      finderCountEl.textContent = hits ? hits + " lines in " + files + (capped ? ", stopped early" : "") : files;
    }

    finderIndex = -1;
    const back = kept ? finderItems.findIndex((item) => finderKey(item) === kept) : -1;
    moveFinder(back >= 0 ? back : 0);
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
            term: finderTextEl.value,
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

  vscode.postMessage({ type: "ready" });
})();
