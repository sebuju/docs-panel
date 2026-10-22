// Takes every scene in a scenes file (scenes.js unless told otherwise) of one checkout.
//
//   node shots.js [--repo <checkout>] [--out <dir>] [--only <part of a name>] [--dpr 2]
//                 [--scenes <file>]
//
// The checkout defaults to this repository, the scenes to scenes.js and the shots go to
// out/shots.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { build, FONT } = require("./build");

const HERE = __dirname;
const VIEWPORT = { width: 1000, height: 640 };

// Playwright is not a dependency of the extension: it is taken from wherever it is
// installed, the project or the global modules.
function playwright() {
  try {
    return require("playwright");
  } catch {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(root, "playwright"));
  }
}

function args(argv) {
  const out = { repo: path.join(HERE, "../.."), out: path.join(HERE, "out/shots"), only: "", dpr: 2, scenes: path.join(HERE, "scenes.js") };
  for (let i = 0; i < argv.length; i += 2) {
    out[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  return out;
}

async function shoot({ repo, out, only = "", dpr = 2, scenes = path.join(HERE, "scenes.js") }) {
  const { chromium } = playwright();
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const taken = [];
  for (const scene of require(path.resolve(scenes))) {
    if (only && !only.split(",").some((part) => scene.name.includes(part))) {
      continue;
    }
    const html = path.join(HERE, "out", ".pages", path.basename(out) + "-" + scene.name + ".html");
    await build(repo, html, scene.theme || "dark-modern", FONT, scene.state || {});
    const viewport = scene.viewport || VIEWPORT;
    const context = await browser.newContext({ viewport, deviceScaleFactor: +dpr });
    context.setDefaultTimeout(2000);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("file://" + html);
    await page.waitForTimeout(300);
    try {
      if (scene.act) {
        await scene.act(page);
      }
    } catch (error) {
      errors.push("act: " + error.message.split("\n")[0]);
    }
    await page.waitForTimeout(150);
    // Out of the way, so no hover is left lit, unless the hover is what the scene shows.
    if (!scene.hover) {
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
    }
    const file = path.join(out, scene.name + ".png");
    await page.screenshot({ path: file, clip: scene.clip });
    console.log(scene.name.padEnd(28), errors.length ? "ERRORS " + errors.join(" | ") : "ok");
    taken.push({ name: scene.name, file, errors });
    await context.close();
  }
  await browser.close();
  return taken;
}

module.exports = { shoot, playwright };

if (require.main === module) {
  shoot(args(process.argv.slice(2))).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
