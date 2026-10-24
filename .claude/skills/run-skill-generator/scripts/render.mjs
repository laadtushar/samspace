// node render.mjs <project_dir> <reel> [t1,t2,...]
// Renders the motion layer as transparent PNGs (frames/<reel>/), and audits
// every 15th frame: text must stay inside the area the platform UI leaves clear.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const [pdir, name, stills] = process.argv.slice(2);
const here0 = path.dirname(new URL(import.meta.url).pathname);
// Playwright from the repo this skill lives in (.claude/skills/<name>/scripts -> repo root), unless told otherwise.
const require = createRequire(process.env.PLAYWRIGHT_FROM || path.resolve(here0, "../../../../package.json"));
const { chromium } = require("playwright");
const here = path.dirname(new URL(import.meta.url).pathname);
const tl = JSON.parse(fs.readFileSync(path.join(pdir, `${name}.timeline.json`), "utf8"));
const out = path.join(pdir, "frames", name);
if (!stills) { fs.rmSync(out, { recursive: true, force: true }); }
fs.mkdirSync(out, { recursive: true });
// Instagram/TikTok/Shorts: top bar, right-hand buttons, bottom caption block.
const SAFE = { x0: 40, y0: 210, x1: 950, y1: 1560 };
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.addInitScript(t => { window.TIMELINE = t; }, tl);
await page.goto(`file://${path.join(here, "..", "templates", "overlay.html")}`);
await page.evaluate(() => document.fonts.ready);
const n = Math.round(tl.duration * tl.fps);
const only = stills ? stills.split(",").map(Number) : null;
const issues = [];
for (let i = 0; i < n; i++) {
  const t = i / tl.fps;
  if (only && !only.some(x => Math.abs(x - t) < 0.5 / tl.fps)) continue;
  await page.evaluate(t => window.render(t), t);
  await page.evaluate(() => Promise.all([...document.images].map(im => im.decode().catch(() => {}))));
  if (only || i % 15 === 0) {
    for (const b of await page.evaluate(() => window.textBoxes())) {
      if (t > tl.speechEnd) continue;
      if (b.x0 < SAFE.x0 || b.y0 < SAFE.y0 || b.x1 > SAFE.x1 || b.y1 > SAFE.y1)
        issues.push({ t: +t.toFixed(2), ...b, x0: Math.round(b.x0), y0: Math.round(b.y0), x1: Math.round(b.x1), y1: Math.round(b.y1) });
    }
  }
  await page.screenshot({ path: path.join(out, `${String(i).padStart(5, "0")}.png`), omitBackground: true });
}
await browser.close();
if (!only) fs.writeFileSync(path.join(pdir, `${name}.safezone.json`), JSON.stringify(issues, null, 1));
console.log(`${name}: ${only ? only.length + " stills" : n + " frames"}, safe-area issues ${issues.length}`);
for (const x of issues.slice(0, 8)) console.log("  ", JSON.stringify(x));
