(function () {
  const vscode = acquireVsCodeApi();

  const layout = document.getElementById("layout");
  const treeEl = document.getElementById("tree");
  const splitter = document.getElementById("splitter");
  const sideTitleEl = document.getElementById("sideTitle");
  const trashViewEl = document.getElementById("trashView");
  const trashEl = document.getElementById("trash");
  const restoreEl = document.getElementById("restore");
  const statusEl = document.getElementById("status");
  const headerEl = document.getElementById("header");
  const titleEl = document.getElementById("title");
  const dirtyEl = document.getElementById("dirty");
  const toggleEl = document.getElementById("toggle");
  const bodyEl = document.getElementById("body");
  const tocEl = document.getElementById("toc");
  const lightboxEl = document.getElementById("lightbox");
  const lightboxImageEl = document.getElementById("lightboxImage");
  const lightboxHintEl = document.getElementById("lightboxHint");

  const MIN_SPLIT = 120;

  let nodes = [];
  let expanded = new Set();
  let selected = null;
  let split = 240;

  let current = null;
  let mode = "preview";
  let viewTrash = false;
  let zoom = 1;
  let fitScale = 1;
  let panX = 0;
  let panY = 0;
  const drafts = new Map();
  let statuses = {};

  const saved = vscode.getState();
  if (saved) {
    applyState(saved);
  }
  setSplit(split);

  function applyState(state) {
    if (typeof state.split === "number") {
      split = state.split;
    }
    if (Array.isArray(state.expanded)) {
      expanded = new Set(state.expanded);
    }
    selected = typeof state.selected === "string" ? state.selected : null;
  }

  function currentState() {
    return { split: split, expanded: [...expanded], selected: selected };
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

  function drawTree(notice) {
    treeEl.textContent = "";
    if (notice) {
      const p = document.createElement("p");
      p.className = "notice";
      p.textContent = notice;
      treeEl.appendChild(p);
      return;
    }
    treeEl.appendChild(buildList(nodes));
  }

  function buildList(items) {
    const ul = document.createElement("ul");
    for (const node of items) {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "row";

      const twisty = document.createElement("span");
      twisty.className = "twisty";
      const open = node.dir && expanded.has(node.path);
      twisty.textContent = node.dir ? (open ? "▾" : "▸") : "";
      row.appendChild(twisty);

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

  window.addEventListener("resize", () => setSplit(split));

  toggleEl.addEventListener("click", () => {
    if (!current || !editable(current)) {
      return;
    }
    stashDraft();
    mode = mode === "edit" ? "preview" : "edit";
    draw();
  });

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

  trashViewEl.addEventListener("click", () => {
    stashDraft();
    viewTrash = !viewTrash;
    selected = null;
    current = null;
    mode = "preview";
    draw();
    applyView();
    vscode.postMessage({ type: "view", trash: viewTrash });
  });

  trashEl.addEventListener("click", () => {
    if (current && !viewTrash) {
      drafts.delete(current.path);
      vscode.postMessage({ type: "trash", path: current.path });
    }
  });

  restoreEl.addEventListener("click", () => {
    if (current && viewTrash) {
      drafts.delete(current.path);
      vscode.postMessage({ type: "restore", path: current.path });
    }
  });

  function applyView() {
    sideTitleEl.textContent = viewTrash ? "Trash" : "Docs";
    trashViewEl.classList.toggle("active", viewTrash);
    trashViewEl.title = viewTrash ? "Back to the docs" : "Show the trash";
    trashEl.hidden = viewTrash || !current;
    restoreEl.hidden = !viewTrash || !current;
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
      drawTree(message.notice);
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
      current = message;
      if (!editable(message)) {
        mode = "preview";
      }
      draw();
    } else if (message.type === "state") {
      applyState(message);
      setSplit(split);
      drawTree();
    } else if (message.type === "saved") {
      drafts.delete(message.path);
      markDirty(false);
      drawTree();
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
    } else if (message.type === "view") {
      viewTrash = !!message.trash;
      applyView();
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

    if (!current) {
      headerEl.hidden = true;
      applyView();
      return;
    }

    headerEl.hidden = false;
    titleEl.textContent = current.path;
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

    const article = document.createElement("div");
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

    if (current.kind === "md") {
      buildToc(article);
    }
  }

  function drawEditor() {
    const area = document.createElement("textarea");
    area.spellcheck = false;
    area.value = drafts.has(current.path) ? drafts.get(current.path) : current.text;
    bodyEl.appendChild(area);
    markDirty(area.value !== current.text);
    area.addEventListener("input", () => {
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

  function buildToc(article) {
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
      link.addEventListener("click", (event) => {
        event.preventDefault();
        heading.scrollIntoView({ block: "start" });
        heading.classList.remove("flash");
        void heading.offsetWidth; // restart the animation on a repeated click
        heading.classList.add("flash");
      });
      link.title = heading.textContent;
      li.appendChild(link);
      list.appendChild(li);
    }
    tocEl.appendChild(list);
    tocEl.hidden = false;
  }

  vscode.postMessage({ type: "ready" });
})();
