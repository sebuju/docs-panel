(function () {
  const vscode = acquireVsCodeApi();

  const layout = document.getElementById("layout");
  const treeEl = document.getElementById("tree");
  const sideBodyEl = document.getElementById("sideBody");
  const sideSplitter = document.getElementById("sideSplitter");
  const splitter = document.getElementById("splitter");
  const trashGlyphEl = document.getElementById("trashGlyph");
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

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = trashOpen ? "▾" : "▸";
    row.appendChild(twisty);

    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.appendChild(trashGlyphEl.content.cloneNode(true));
    row.appendChild(icon);

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

      const twisty = document.createElement("span");
      twisty.className = "twisty";
      const open = node.dir && expanded.has(node.path);
      twisty.textContent = node.dir ? (open ? "▾" : "▸") : "";
      row.appendChild(twisty);

      // The dot keeps its place whether or not it is shown, so a row never shifts.
      if (!node.dir) {
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

      li.appendChild(row);
      if (node.dir && open && node.children && node.children.length) {
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

  sideSplitter.addEventListener("pointerdown", (event) => {
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
    setSideSplit(sideSplit);
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
      copyText(current.path);
      toast("copied to clipboard: " + current.path);
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  });

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
      drawTree(message.notice || "");
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
    titleEl.title = "Copy the path (" + current.path + ")";
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
    const headings = article.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (headings.length < 2) {
      return;
    }
    const list = document.createElement("ul");
    let index = 0;
    for (const heading of headings) {
      if (!heading.id) {
        heading.id = "docs-panel-heading-" + index;
      }
      index += 1;
      const li = document.createElement("li");
      li.className = "toc-" + heading.tagName.toLowerCase();
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = heading.textContent;
      const section = { heading: heading, li: li, own: [heading, ...ownedBy(heading)] };
      link.addEventListener("click", (event) => {
        event.preventDefault();
        heading.scrollIntoView({ block: "start" });
        flash(section.own);
      });
      link.title = heading.textContent;
      li.appendChild(link);
      list.appendChild(li);
      sections.push(section);
    }
    tocEl.appendChild(list);
    tocEl.hidden = false;
    sideBodyEl.classList.remove("no-toc");
    setSideSplit(sideSplit);
    scheduleActive();
  }

  // A heading owns everything down to the next heading, whatever its level.
  function ownedBy(heading) {
    const own = [];
    let node = heading.nextElementSibling;
    while (node && !/^H[1-6]$/.test(node.tagName)) {
      own.push(node);
      node = node.nextElementSibling;
    }
    return own;
  }

  function flash(elements) {
    for (const element of elements) {
      element.classList.remove("flash");
    }
    void elements[0].offsetWidth; // restart the animation on a repeated click
    for (const element of elements) {
      element.classList.add("flash");
    }
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
  function revealInToc(li) {
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    if (top < tocEl.scrollTop) {
      tocEl.scrollTop = top;
    } else if (bottom > tocEl.scrollTop + tocEl.clientHeight) {
      tocEl.scrollTop = bottom - tocEl.clientHeight;
    }
  }

  vscode.postMessage({ type: "ready" });
})();
