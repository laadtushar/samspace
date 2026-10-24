// node render_cards.mjs <project_dir>
// Renders every card in <project_dir>/cards.json to <project_dir>/out/cards/<id>.png,
// and fails if any text spills past its card.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const [pdir] = process.argv.slice(2);
const here0 = path.dirname(new URL(import.meta.url).pathname);
// Playwright from the repo this skill lives in (.claude/skills/<name>/scripts -> repo root), unless told otherwise.
const require = createRequire(process.env.PLAYWRIGHT_FROM || path.resolve(here0, "../../../../package.json"));
const { chromium } = require("playwright");
const here = path.dirname(new URL(import.meta.url).pathname);
const brand = JSON.parse(fs.readFileSync(path.join(pdir, "project.json"), "utf8")).brand;
const cards = JSON.parse(fs.readFileSync(path.join(pdir, "cards.json"), "utf8"));
const out = path.join(pdir, "out", "cards");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ["--allow-file-access-from-files"] });
const bad = [];
for (const card of cards) {
  const page = await browser.newPage({ viewport: { width: card.w, height: card.h }, deviceScaleFactor: 1 });
  await page.addInitScript(([b, c]) => { window.BRAND = b; window.CARD = c; }, [brand, card]);
  await page.goto(`file://${path.join(here, "..", "templates", "card.html")}`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(im => im.decode().catch(() => {}))));
  if (await page.evaluate(() => window.overflow())) bad.push(card.id);
  await page.screenshot({ path: path.join(out, `${card.id}.png`) });
  await page.close();
}
await browser.close();
console.log(`${cards.length} cards, overflow: ${bad.length ? bad.join(", ") : "none"}`);
if (bad.length) process.exit(1);
