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
  const dirtyEl = document.getElementById("dirty");
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
  let trashOpen = false;
  let trashNodes = [];
  let zoom = 1;
  let fitScale = 1;
  let panX = 0;
  let panY = 0;
  const drafts = new Map();
  let statuses = {};
  let reads = new Set();
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

  function drawTree(text) {
    if (text !== undefined) {
      notice = text;
    }
    treeEl.textContent = "";
    const list = buildList(nodes, notice);
    const li = document.createElement("li");
    li.appendChild(trashRow());
    if (trashOpen) {
      li.appendChild(buildList(trashNodes, trashNodes.length ? "" : "The trash is empty."));
    }
    list.appendChild(li);
    treeEl.appendChild(list);
  }

  // The trash is a folder in the list, below the docs it came from and opening in place.
  function trashRow() {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.path = ".trash";
    row.dataset.dir = "1";

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = trashOpen ? "▾" : "▸";
    row.appendChild(twisty);

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "Trash";
    row.appendChild(label);

    row.addEventListener("click", () => {
      trashOpen = !trashOpen;
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
    for (const node of items) {
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
        dot.className = reads.has(node.path) ? "unread read" : "unread";
        dot.title = reads.has(node.path) ? "" : "Not read yet";
        row.appendChild(dot);
      }

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = node.name;
      row.appendChild(label);

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
        openMenu(event.clientX, event.clientY, nodeMenu(node));
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
      if (node.dir && expanded.has(node.path) && node.children && node.children.length) {
        li.appendChild(buildList(node.children));
      }
      ul.appendChild(li);
    }
    return ul;
  }

  function openFile(path) {
    if (path === selected) {
      return;
    }
    stashDraft();
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

  function copyPath(path) {
    copyText(fullPath(path));
    toast("copied to clipboard: " + fullPath(path));
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
      button.appendChild(document.createTextNode(item.label));
      button.addEventListener("click", () => {
        closeMenu();
        item.run();
      });
      menuEl.appendChild(button);
    }
    menuEl.style.left = "0px";
    menuEl.style.top = "0px";
    menuEl.hidden = false;
    const box = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.max(0, Math.min(x, window.innerWidth - box.width - 4)) + "px";
    menuEl.style.top = Math.max(0, Math.min(y, window.innerHeight - box.height - 4)) + "px";
  }

  function closeMenu() {
    menuEl.hidden = true;
    menuEl.textContent = "";
  }

  function nodeMenu(node) {
    const trashed = inTrash(node.path);
    const items = [];
    if (node.dir && !trashed) {
      items.push(...makeItems(node.path), { separator: true });
    }
    items.push({ label: "Reveal in file explorer", run: () => send("reveal", node) });
    items.push({ label: "Rename…", run: () => send("rename", node) });
    items.push({ label: "Copy path", run: () => copyPath(node.path) });
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
          copyBlock(block.innerText);
          flashOutline(block);
        }
      });
    }
    openMenu(event.clientX, event.clientY, items);
  });

  function blockAt(el) {
    return el && el.closest && article.contains(el) ? el.closest(BLOCKS) : null;
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
    stashDraft();
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
      copyPath(current.path);
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
  }

  document.addEventListener("keydown", (event) => {
    if (!menuEl.hidden && event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
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
    if (event.key === "PageUp" || event.key === "PageDown") {
      if (jumpSection(event.key === "PageDown" ? 1 : -1, event.target)) {
        event.preventDefault();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
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
      markDirty(false);
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
    } else if (message.type === "moved") {
      selected = null;
      current = null;
      mode = "preview";
      draw();
      persist();
    } else if (message.type === "statuses") {
      statuses = message.statuses || {};
      drawTree();
      if (current) {
        showStatus(statuses[current.path]);
      }
    } else if (message.type === "reads") {
      reads = new Set(message.reads || []);
      drawTree();
    }
  });

  function editable(content) {
    return content.kind !== "img" && typeof content.text === "string";
  }

  function markDirty(value) {
    dirtyEl.hidden = !value;
  }

  function draw() {
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
    toggleEl.hidden = !editable(current);
    toggleEl.classList.toggle("editing", mode === "edit");
    toggleEl.title = mode === "edit" ? "Preview" : "Edit";
    markDirty(drafts.has(current.path));
    applyView();

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
    modifiedEl.classList.remove("flash");
    if (flashModified && modified) {
      void modifiedEl.offsetWidth; // restart the animation on a second update
      modifiedEl.classList.add("flash");
    }
    flashModified = false;
  }

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

  function drawEditor() {
    const area = document.createElement("textarea");
    area.spellcheck = false;
    area.value = drafts.has(current.path) ? drafts.get(current.path) : current.text;
    bodyEl.appendChild(area);
    fitEditor(area);
    markDirty(area.value !== current.text);
    area.addEventListener("input", () => {
      fitEditor(area);
      const dirty = area.value !== current.text;
      markDirty(dirty);
      if (dirty) {
        drafts.set(current.path, area.value);
      } else {
        drafts.delete(current.path);
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
      const text = leadBold(el);
      if (text) {
        found.push({ el: el, level: Math.min(level + 1 + listDepth(el), 6), text: text });
      }
    }
    return found;
  }

  // The bold run a block opens with, if that is how it opens. A loose list item wraps its
  // text in a paragraph first, so one step inward is allowed before giving up.
  function leadBold(el) {
    let node = firstNode(el);
    if (node && node.nodeName === "P") {
      node = firstNode(node);
    }
    return node && node.nodeName === "STRONG" ? node.textContent.trim() : "";
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

  vscode.postMessage({ type: "ready" });
})();
