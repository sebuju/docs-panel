// Before and after: shoots a committed version and the working tree with the same
// scenes, and lays each pair side by side.
//
//   node compare.js [--ref HEAD] [--only <part of a name>] [--dpr 2]
//
// Writes out/before, out/after and out/compare, one PNG per scene in each.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const { shoot, playwright } = require("./shots");

const HERE = __dirname;
const REPO = path.join(HERE, "../..");

function args(argv) {
  const out = { ref: "HEAD", only: "", dpr: 2 };
  for (let i = 0; i < argv.length; i += 2) {
    out[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  return out;
}

const git = (...rest) => execFileSync("git", ["-C", REPO, ...rest], { encoding: "utf8" }).trim();

async function sideBySide(pairs, out) {
  const { chromium } = playwright();
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 2100, height: 800 } });
  for (const { name, before, after } of pairs) {
    const cell = (label, file) =>
      `<figure><figcaption>${label}</figcaption>${
        file && fs.existsSync(file)
          ? `<img src="data:image/png;base64,${fs.readFileSync(file).toString("base64")}">`
          : "<p>no shot</p>"
      }</figure>`;
    await page.setContent(
      `<html><body style="margin:0;background:#888;font:600 14px sans-serif">
      <div id="pair" style="display:inline-flex;gap:12px;padding:12px;align-items:flex-start">
      ${cell("before", before)}${cell("after", after)}</div>
      <style>figure{margin:0}figcaption{margin:0 0 6px;color:#fff}img{display:block;zoom:0.5}</style>
      </body></html>`,
      { waitUntil: "load" }
    );
    await page.locator("#pair").screenshot({ path: path.join(out, name + ".png") });
  }
  await browser.close();
}

async function main() {
  const { ref, only, dpr } = args(process.argv.slice(2));
  const sha = git("rev-parse", "--short", ref);
  const tree = path.join(os.tmpdir(), "docs-panel-" + sha);
  if (!fs.existsSync(tree)) {
    git("worktree", "add", "--detach", tree, sha);
  }
  try {
    console.log("before:", ref, sha);
    const before = await shoot({ repo: tree, out: path.join(HERE, "out/before"), only, dpr });
    console.log("after: working tree");
    const after = await shoot({ repo: REPO, out: path.join(HERE, "out/after"), only, dpr });
    const pairs = after.map((shot) => ({
      name: shot.name,
      after: shot.file,
      before: (before.find((other) => other.name === shot.name) || {}).file
    }));
    await sideBySide(pairs, path.join(HERE, "out/compare"));
    console.log("side by side in", path.join(HERE, "out/compare"));
  } finally {
    git("worktree", "remove", "--force", tree);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
