// The screenshots taken of a checkout. Each scene sets the panel's state, may act on the
// page, and keeps a clip of it. Edit freely: add the scenes a change needs.
//
//   name   file name of the shot
//   theme  one of themes.js, dark-modern by default
//   state  merged over the panel state build.js starts from
//   act    async (page) => {...}, run once the page has drawn
//   hover  true to leave the pointer where the scene put it
//   clip   { x, y, width, height } in CSS pixels; the whole window when left out

const side = { x: 0, y: 0, width: 340, height: 300 };
const wide = { x: 0, y: 0, width: 520, height: 300 };
const menu = { x: 0, y: 0, width: 560, height: 440 };
const finder = { x: 0, y: 0, width: 1000, height: 460 };
const header = { x: 300, y: 0, width: 700, height: 40 };

// The tree's corner buttons only take the pointer while it is near them.
const press = (id) => async (page) => {
  await page.evaluate((el) => document.getElementById(el).click(), id);
  await page.waitForTimeout(120);
};

const search = (text) => async (page) => {
  await press("findAll")(page);
  await page.fill("#finderText", text);
  await page.waitForTimeout(150);
};

// A long page of every heading level, sections of uneven length.
const crowded = () => {
  const text = (n) => "<p>" + "Some text to read. ".repeat(n) + "</p>";
  let html = "<h1>Storage layer</h1>" + text(30);
  for (let i = 1; i <= 6; i++) {
    html += "<h2>Part " + i + "</h2>" + text(i % 2 ? 4 : 40);
    html += "<h3>Details of part " + i + "</h3>" + text(3);
    html += "<h4>Notes " + i + "</h4>" + text(2) + "<h5>Aside " + i + "</h5>" + text(2) + "<h6>Footnote " + i + "</h6>" + text(20);
  }
  return html;
};

// The page's own place is put back when it opens; a wheel a moment later is the reader's.
const scrollPage = (by) => async (page) => {
  await page.waitForTimeout(400);
  await page.mouse.move(600, 200);
  await page.mouse.wheel(0, by);
  await page.waitForTimeout(250);
};

module.exports = [
  { name: "tree-tags-right", state: { tagSide: "right" }, clip: side },
  { name: "tree-tags-left", state: { tagSide: "left" }, clip: side },
  { name: "tree-tags-right-autowidth", state: { tagSide: "right", autoWidth: true }, clip: wide },
  { name: "tree-tags-left-autowidth", state: { tagSide: "left", autoWidth: true }, clip: wide },
  { name: "tree-tags-narrow", state: { tagSide: "right", split: 220 }, clip: side },
  { name: "tree-tags-narrow-left", state: { tagSide: "left", split: 220 }, clip: side },
  { name: "tree-focused", clip: side, act: async (page) => page.focus("#tree") },
  { name: "tree-text-size", state: { treeScale: 1.3 }, clip: wide },
  { name: "tree-light", theme: "light-modern", clip: side },
  // The pointer on the file next to the one selected: the two lit rows keep apart.
  {
    name: "tree-hover-by-selected",
    hover: true,
    clip: { x: 0, y: 120, width: 300, height: 90 },
    act: async (page) => page.hover('.row[data-path="plans/migration-plan-for-the-new-storage-layer.md"] .label')
  },
  {
    name: "tree-hover-by-selected-light",
    theme: "light-modern",
    hover: true,
    clip: { x: 0, y: 120, width: 300, height: 90 },
    act: async (page) => page.hover('.row[data-path="plans/migration-plan-for-the-new-storage-layer.md"] .label')
  },
  {
    name: "tree-cursor-by-selected",
    hover: true,
    clip: { x: 0, y: 120, width: 300, height: 90 },
    act: async (page) => {
      await page.focus("#tree");
      await page.keyboard.press("ArrowUp");
      await page.hover('.row[data-path="plans/archive"] .label');
    }
  },
  {
    name: "menu-file",
    clip: menu,
    act: async (page) => page.click('.row[data-path="guide.md"] .label', { button: "right" })
  },
  {
    name: "menu-folder",
    clip: menu,
    act: async (page) => page.click('.row[data-path="plans"] .label', { button: "right" })
  },
  {
    name: "menu-shift-f10",
    clip: menu,
    act: async (page) => {
      await page.focus("#tree");
      await page.keyboard.press("Shift+F10");
    }
  },
  {
    name: "tag-click",
    clip: finder,
    act: async (page) => {
      await page.click('.row[data-path="plans/roadmap.md"] .tag >> nth=0');
      await page.waitForTimeout(150);
    }
  },
  {
    name: "tag-shift-click",
    clip: finder,
    act: async (page) => {
      await page.click('.row[data-path="plans/roadmap.md"] .tag >> nth=0');
      await page.waitForTimeout(150);
      await page.click('.row[data-path="guide.md"] .tag >> nth=0', { modifiers: ["Shift"] });
      await page.waitForTimeout(150);
    }
  },
  { name: "search-tags", clip: finder, act: search("tag:plan ,  , meet  review") },
  { name: "search-files", clip: finder, act: search("file:road , ideas,") },
  { name: "options", act: press("openOptions") },
  {
    name: "options-tags",
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => {
        const box = document.getElementById("optionsBody");
        box.scrollTop = box.scrollHeight;
      });
      await page.waitForTimeout(100);
    }
  },
  {
    name: "options-pruned",
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => {
        const box = document.getElementById("optionsBody");
        box.scrollTop = box.scrollHeight;
      });
      await page.click("#optionsDialog button:has-text('Prune')");
      await page.waitForTimeout(200);
    }
  },
  {
    name: "tag-colours",
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => {
        const box = document.getElementById("optionsBody");
        box.scrollTop = box.scrollHeight;
      });
      await page.click("#optionsBody .opt-short >> nth=0");
      await page.waitForTimeout(100);
      await page.click("#menu button:has-text('Colour')");
      await page.waitForTimeout(100);
    }
  },
  {
    name: "tag-letters-menu",
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => {
        const box = document.getElementById("optionsBody");
        box.scrollTop = box.scrollHeight;
      });
      await page.click("#optionsBody .opt-short >> nth=1");
      await page.waitForTimeout(100);
    }
  },
  {
    name: "tags-ctrl-click",
    clip: menu,
    act: async (page) => page.click('.row[data-path="guide.md"] .label', { modifiers: ["Control"] })
  },
  {
    name: "page-table-row",
    state: { selected: "guide.md" },
    clip: { x: 300, y: 0, width: 700, height: 300 },
    hover: true,
    act: async (page) => page.mouse.move(380, 195)
  },
  {
    name: "page-links-and-edit",
    state: { selected: "guide.md", editing: [] },
    clip: { x: 300, y: 0, width: 700, height: 140 },
    hover: true,
    act: async (page) => page.hover("a.file-link >> nth=0")
  },
  {
    name: "page-edit-on",
    state: { selected: "guide.md", editing: ["guide.md"] },
    clip: header
  },
  {
    name: "page-menu-find",
    state: { selected: "guide.md" },
    clip: { x: 300, y: 0, width: 700, height: 300 },
    act: async (page) => page.click(".markdown-body table td >> nth=1", { button: "right" })
  },
  {
    name: "options-prune-hover",
    hover: true,
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => {
        const box = document.getElementById("optionsBody");
        box.scrollTop = box.scrollHeight;
      });
      await page.hover("#optionsDialog button:has-text('Prune')");
    }
  },
  { name: "tree-pins", state: { pinned: ["guide.md", "plans/roadmap.md", "notes"] }, clip: side },
  { name: "tree-scrollbar-edge", state: { expanded: ["plans", "notes", "plans/archive"] }, clip: { x: 270, y: 0, width: 60, height: 60 } },
  { name: "search-edge", clip: { x: 280, y: 0, width: 120, height: 60 }, act: press("findAll") },
  {
    name: "buckets-across",
    state: { pinned: ["plans/roadmap.md"], buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-down-filled",
    state: { bucketFill: 30, buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 1 } } },
    clip: side
  },
  {
    name: "buckets-span-ordered",
    state: { buckets: { plans: { tags: ["q3", "plan", "blocked"], perRow: 2, spans: { q3: 2 }, ordered: true } } },
    clip: side
  },
  {
    name: "buckets-untagged",
    state: {
      expanded: ["plans", "plans/archive"],
      buckets: { plans: { tags: ["q3", " untagged"], perRow: 2 }, "plans/archive": { tags: [" untagged"], perRow: 1 } }
    },
    clip: side
  },
  {
    name: "buckets-untagged-picker",
    state: { expanded: ["plans", "plans/archive"], buckets: { "plans/archive": { tags: [" untagged"], perRow: 1 } } },
    act: async (page) => page.click('.bucket[data-folder="plans/archive"] .bucket-head', { button: "right" })
  },
  {
    name: "buckets-head-tinted-bold",
    state: { bucketHeadStyle: "plain", bucketHeadTint: true, bucketHeadBold: true, bucketFill: 8, buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-head-outside-fill",
    state: { bucketHead: "outside", bucketHeadStyle: "fill", buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-head-over-plain",
    state: { bucketHead: "over", bucketHeadStyle: "plain", buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-head-inside-plain",
    theme: "light-modern",
    state: { bucketHeadStyle: "plain", buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-picker",
    state: { buckets: { plans: { tags: ["plan", "blocked"], perRow: 2, spans: { blocked: 2 }, ordered: true } } },
    clip: menu,
    act: async (page) => {
      await page.click('.row[data-path="plans"] .label', { button: "right" });
      await page.click("#menu button:has-text('Tag buckets')");
    }
  },
  // Buckets in the root folder itself, from the menu of the space under the tree, the
  // picker standing to the right of the side; and a heading of a bigger size.
  {
    name: "buckets-root",
    state: { expanded: [], buckets: { "": { tags: ["draft", "overview"], perRow: 2 } } },
    clip: side
  },
  {
    name: "buckets-root-picker",
    state: { expanded: [] },
    clip: menu,
    act: async (page) => {
      await page.click("#tree", { button: "right", position: { x: 100, y: 250 } });
      await page.click("#menu button:has-text('Tag buckets')");
    }
  },
  {
    name: "buckets-head-size",
    state: { bucketHeadSize: 140, buckets: { plans: { tags: ["plan", "blocked", "q3"], perRow: 2 } } },
    clip: side
  },
  // Several root folders, each under its divider, drawn as the options set.
  ...[
    ["roots", {}],
    ["roots-centered-dashed", { dividerAlign: "center", dividerLine: "dashed", dividerCaps: false, dividerColor: "blue" }],
    ["roots-path-right-thick", { dividerLabel: "path", dividerAlign: "right", dividerWidth: 3, dividerSize: 110, dividerGap: 16, dividerBold: false }],
    ["roots-bare-double", { dividerLabel: "none", dividerLine: "double" }]
  ].map(([name, look]) => ({
    name: "tree-" + name,
    state: Object.assign(
      {
        roots: ["docs", "team"],
        expanded: ["docs/plans", "team/runbooks"],
        selected: "docs/plans/roadmap.md",
        buckets: { team: { tags: [" untagged"], perRow: 1 } }
      },
      look
    ),
    clip: { x: 0, y: 0, width: 340, height: 420 },
    viewport: { width: 1000, height: 420 }
  })),
  {
    name: "tree-roots-three",
    state: {
      roots: ["docs", "team", "specs"],
      expanded: ["team/runbooks"],
      selected: "specs/api.md",
      dividerColor: "blue"
    },
    clip: { x: 0, y: 0, width: 340, height: 420 },
    viewport: { width: 1000, height: 420 }
  },
  {
    name: "tree-roots-menu",
    state: { roots: ["docs", "team"], expanded: [], selected: "docs/plans/roadmap.md" },
    clip: menu,
    act: async (page) => page.click(".root-section[data-root='team'] .root-divider", { button: "right" })
  },
  {
    name: "options-roots",
    state: { roots: ["docs", "team"], selected: "docs/plans/roadmap.md" },
    viewport: { width: 1000, height: 800 },
    act: async (page) => {
      await press("openOptions")(page);
      await page.evaluate(() => document.getElementById("optRoots").scrollIntoView());
    }
  },
  {
    name: "page-block-pad",
    state: { selected: "guide.md", blockPadY: 2, blockPadX: 12, hoverStrength: 100 },
    clip: { x: 300, y: 0, width: 700, height: 300 },
    hover: true,
    act: async (page) => page.mouse.move(500, 85)
  },
  { name: "header-tags", clip: header },
  { name: "header-tags-light", theme: "light-modern", clip: header },
  // A page long enough to scroll, rolled down a little: the headings come up by the bar.
  ...["dark-modern", "light-modern"].map((theme) => ({
    name: "page-marks" + (theme === "light-modern" ? "-light" : ""),
    theme: theme,
    viewport: { width: 1000, height: 320 },
    state: { selected: "plans/migration-plan-for-the-new-storage-layer.md", textScale: 1.6 },
    hover: true,
    act: scrollPage(240)
  })),
  {
    name: "page-marks-h2",
    viewport: { width: 1000, height: 320 },
    state: { selected: "plans/migration-plan-for-the-new-storage-layer.md", textScale: 1.6, marksRules: "h2" },
    hover: true,
    act: scrollPage(240)
  },
  // Headings of every level, some close together: no two labels overlap, a lower one
  // moves out of a higher one's way or is left out, and the text size follows the level.
  {
    name: "page-marks-crowded",
    viewport: { width: 1000, height: 420 },
    state: { marksRules: "h1-6" },
    hover: true,
    act: async (page) => {
      await page.evaluate((html) => window.postMessage({
        type: "content", path: "plans/roadmap.md", kind: "md", text: "", html: html,
        created: 1760000000000, modified: 1760500000000
      }, "*"), crowded());
      await scrollPage(300)(page);
    }
  },
  // Brought up by the pointer near the bar rather than by a scroll, and picked by a rule
  // with a word: the ## headings and the one named Steps.
  {
    name: "page-marks-hover",
    viewport: { width: 1000, height: 320 },
    state: { selected: "plans/migration-plan-for-the-new-storage-layer.md", textScale: 1.6, marksMode: "hover", marksRules: "h1, h2:ste*" },
    hover: true,
    act: async (page) => {
      await page.waitForTimeout(400);
      await page.mouse.move(990, 200);
      await page.waitForTimeout(250);
    }
  },
  ...["dark-modern", "light-modern"].map((theme) => ({
    name: "page-refs" + (theme === "light-modern" ? "-light" : ""),
    theme: theme,
    clip: { x: 300, y: 0, width: 700, height: 220 },
    act: async (page) => {
      await page.evaluate(() => window.postMessage({
        type: "refs",
        path: "plans/roadmap.md",
        refs: [{ path: "README.md" }, { path: "notes/meeting-notes.md" }, { path: "src/panel.ts", workspace: true }]
      }, "*"));
      await page.waitForTimeout(100);
    }
  }))
];
