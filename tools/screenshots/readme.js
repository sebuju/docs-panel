// The screenshots in the project's README, written to .github/readme:
//
//   node tools/screenshots/shots.js --scenes tools/screenshots/readme.js --out .github/readme
//
// Same fields as scenes.js, plus viewport, { width, height } in CSS pixels.

const window = { width: 1200, height: 720 };
const side = { x: 0, y: 0, width: 360, height: 330 };
const plan = "plans/migration-plan-for-the-new-storage-layer.md";

const press = (id) => async (page) => {
  await page.evaluate((el) => document.getElementById(el).click(), id);
  await page.waitForTimeout(120);
};

const toBottom = async (page) => {
  await page.evaluate(() => {
    const box = document.getElementById("optionsBody");
    box.scrollTop = box.scrollHeight;
  });
  await page.waitForTimeout(100);
};

// Lines from Claude Code sessions that named the plan, as the host would send them, some
// hours before the shot is taken.
const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const mentions = {
  [plan]: [
    { token: plan, at: ago(150), session: "a", role: "user", excerpt: `Read ${plan} and list what step 2 still needs.` },
    { token: plan, at: ago(52), session: "b", role: "assistant", excerpt: `Step 2 in ${plan} is waiting on the hash check; I added it to the table.` },
    { token: plan, at: ago(3), session: "c", role: "user", excerpt: `Mark step 3 of ${plan} as blocked until the review is in.` }
  ]
};
const mention = async (page) => {
  await page.evaluate((m) => window.postMessage({ type: "mentions", mentions: m }, "*"), mentions);
  await page.waitForTimeout(150);
};

module.exports = [
  {
    name: "overview",
    viewport: window,
    state: { selected: plan, split: 340 },
    act: mention
  },
  {
    name: "overview-light",
    theme: "light-modern",
    viewport: window,
    state: { selected: plan, split: 340 },
    act: mention
  },
  { name: "tree-tags", clip: side },
  { name: "tree-letters", state: { split: 230 }, clip: { x: 0, y: 0, width: 240, height: 330 } },
  {
    name: "tree-menu",
    clip: { x: 0, y: 0, width: 560, height: 640 },
    act: async (page) => page.click('.row[data-path="guide.md"] .label', { button: "right" })
  },
  {
    name: "tag-picker",
    clip: { x: 0, y: 0, width: 560, height: 640 },
    act: async (page) => page.click('.row[data-path="guide.md"] .label', { modifiers: ["Control"] })
  },
  {
    name: "page-menu",
    state: { selected: plan },
    clip: { x: 300, y: 0, width: 700, height: 420 },
    act: async (page) => page.click(".markdown-body table td >> nth=6", { button: "right" })
  },
  {
    name: "search",
    clip: { x: 0, y: 0, width: 1000, height: 460 },
    act: async (page) => {
      await press("findAll")(page);
      await page.fill("#finderText", "tag:plan, draft review");
      await page.waitForTimeout(150);
    }
  },
  {
    name: "buckets",
    state: { pinned: ["plans/roadmap.md"], buckets: { plans: { tags: ["q3", "blocked"], perRow: 2 } }, expanded: ["plans"] },
    clip: side
  },
  {
    name: "buckets-picker",
    state: { buckets: { plans: { tags: ["plan", "blocked"], perRow: 2, spans: { blocked: 2 }, ordered: true } } },
    clip: { x: 0, y: 0, width: 560, height: 470 },
    act: async (page) => {
      await page.click('.row[data-path="plans"] .label', { button: "right" });
      await page.click("#menu button:has-text('Tag buckets')");
    }
  },
  { name: "options", act: press("openOptions") },
  {
    name: "options-tags",
    act: async (page) => {
      await press("openOptions")(page);
      await toBottom(page);
    }
  }
];
