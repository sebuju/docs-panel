# Screenshots

Renders the panel's page in Chromium without VS Code, so a change can be looked at, and
compared with an earlier version, from the command line.

`build.js` builds the page the way the extension does, from a checkout's own
`src/panel.ts`, `media/main.js` and `media/main.css`, and puts in a stand-in for the
extension host that answers the page's messages from `fixture/`: the docs folder in
`fixture/docs`, and the tags, colours and data files in `fixture/marks.json`. The theme
colours VS Code hands a webview are in `themes.js`.

Needs Playwright with Chromium, from the project or installed globally
(`npm i -g playwright`), and the project's own `npm install` for esbuild.

```sh
# Every scene of the working tree, into tools/screenshots/out/shots
node tools/screenshots/shots.js

# Only some of them
node tools/screenshots/shots.js --only tree,menu

# Before and after: HEAD (or any --ref) against the working tree, laid side by side
# in tools/screenshots/out/compare
node tools/screenshots/compare.js
node tools/screenshots/compare.js --ref v0.7.0 --only options
```

The scenes are in `scenes.js`: the state the panel starts in, what is done to the page,
and the part of it kept. Add the ones a change needs.

The project README's images are the scenes in `readme.js`, taken into `.github/readme`:

```sh
node tools/screenshots/shots.js --scenes tools/screenshots/readme.js --out .github/readme
```

`out/` is not committed.
