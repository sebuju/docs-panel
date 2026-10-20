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
  { name: "header-tags", clip: header },
  { name: "header-tags-light", theme: "light-modern", clip: header }
];
