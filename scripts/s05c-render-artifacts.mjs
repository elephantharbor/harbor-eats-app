/**
 * Render the S-05C synthetic list with the real app formatter and the real
 * canvas painter. Writes text and PNG next to the process cwd argument,
 * default /opt/cursor/artifacts/s05c.
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { renderAppExport } from "../src/lib/shop-app-export.js";

const outDir = process.argv[2] || "/opt/cursor/artifacts/s05c";
mkdirSync(outDir, { recursive: true });

const lines = [
  ["yellow onions", "lb", "produce", 2],
  ["bananas", "count", "produce", 3],
  ["flat-leaf parsley", "bunch", "produce", 1],
  ["cilantro", "cup", "produce", 0.5],
  ["Yukon Gold potatoes", "lb", "produce", 1.5],
  ["limes", "count", "produce", 2],
  ["fresh ramps", "oz", "produce", 4],
  ["boneless chicken thighs", "lb", "meat", 1.25],
  ["oat milk (64 fl oz)", "carton", "dairy", 1],
  ["large eggs", "dozen", "dairy", 1],
  ["black beans (15 oz each)", "can", "pantry", 2],
  ["Rao's marinara sauce (24 oz)", "jar", "pantry", 1],
  ["rolled oats", "cup", "pantry", 0.667],
  ["smoked paprika", "tbsp", "pantry", 1],
  ["kosher salt", "tsp", "pantry", 0.125],
  ["paper towels", "pack", "household", 1],
].map(([display_name, unit, category, quantity_required]) => ({
  line_id: display_name,
  display_name,
  unit,
  category,
  quantity_required,
  list_state: "open",
  still_needed: true,
}));

const payload = renderAppExport({ lines });
writeFileSync(`${outDir}/synthetic-app.txt`, `${payload.parts.join("\n\n")}\n`);

const publicDir = new URL("../public/", import.meta.url).pathname;
const server = createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  try {
    const body = readFileSync(join(publicDir, relative));
    const type = relative.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("missing");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.FlavorWeaveShopImage, null, { timeout: 10000 });
const pngs = await page.evaluate(async (rows) => {
  const canvases = window.FlavorWeaveShopImage.renderShoppingListCanvases(rows, { dpr: 2 });
  return canvases.map((canvas) => canvas.toDataURL("image/png"));
}, payload.rows.map((row) => ({ quantity: row.quantity_unicode, name: row.name })));
pngs.forEach((url, index) => {
  const name = pngs.length === 1 ? "synthetic-app.png" : `synthetic-app-${index + 1}.png`;
  writeFileSync(`${outDir}/${name}`, Buffer.from(url.split(",")[1], "base64"));
});
await browser.close();
server.close();
console.log(JSON.stringify({ outDir, parts: payload.part_count, images: pngs.length, text: payload.parts[0] }, null, 2));
