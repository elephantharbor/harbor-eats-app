/**
 * Capture the S-03 order-online sheet at a phone size.
 * Uses the committed CSS and shop-handoff.js. Does not start Wrangler.
 *
 *   node scripts/s03-screens.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "docs/shopping/s03-screens");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const pageHtml = `<!doctype html>
<html lang="en" data-theme="signature">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    body { margin: 0; background: #17393A; min-height: 100dvh; }
    .shot-stage { min-height: 100dvh; }
    .shot-list { background: var(--color-bg); min-height: 100dvh; }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script src="/shop-handoff.js"></script>
</body>
</html>`;

const review = {
  transferable_count: 2,
  launch_enabled: false,
  can_prepare: true,
  usual_store_note: "You usually shop at Market Street. You’ll confirm the store on Instacart.",
  included: [
    { display_text: "Yellow onion", quantity_label: "5 each" },
    { display_text: "Paper towels", quantity_label: "2 package" },
  ],
  staying: [
    {
      line_id: "hl_garlic",
      display_text: "Garlic",
      reason: "invalid_qty_unit",
      message: "Garlic needs a unit Instacart accepts. Edit it, or grab it in the store.",
      action: "edit",
    },
  ],
};

function sheetShell() {
  return `<dialog class="sheet" id="shopOrderSheet" aria-labelledby="shopOrderTitle">
    <form method="dialog" class="sheet__inner sheet__inner--split" id="shopOrderForm">
      <div class="sheet__scroll" id="shopOrderBody"></div>
      <div class="sheet__actions">
        <button class="btn btn-primary" type="submit">Shop in store instead</button>
      </div>
    </form>
  </dialog>`;
}

function listShell() {
  return `<section class="view is-active shot-list" data-view="shopList">
    <div class="page page--medium shop-page">
      <header class="page-head shop-head">
        <div>
          <p class="eyebrow">For your plan</p>
          <h1 class="title" id="shopListTitle">The list</h1>
          <p class="meta">3 to get</p>
        </div>
      </header>
      <p class="meta shop-return" id="shopReturnBanner">Your list is still here.</p>
      <section class="shop-aisle"><h2 class="shop-aisle__title">Produce</h2>
        <div class="shop-row">
          <button type="button" class="shop-row__toggle" role="checkbox" aria-checked="false" aria-label="Still need, Yellow onion, 5 each">
            <span class="shop-row__check"></span>
            <span><span class="shop-row__name">Yellow onion</span></span>
          </button>
          <span class="shop-row__qty">5 each</span>
        </div>
      </section>
      <div class="shop-dock">
        <button class="btn btn-primary btn-lg" type="button">Shop in store</button>
        <button class="btn btn-secondary btn-lg" type="button">Order online</button>
      </div>
    </div>
  </section>`;
}

const shots = [
  { name: "phone-review", kind: "review", html: sheetShell() },
  { name: "phone-unavailable", kind: "unavailable", html: sheetShell() },
  { name: "phone-unsupported-unit", kind: "unsupported", html: sheetShell() },
  { name: "phone-stale", kind: "stale", html: sheetShell() },
  { name: "phone-failed", kind: "failed", html: sheetShell() },
  { name: "phone-return", kind: "return", html: listShell() },
];

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/shot.html") {
        res.writeHead(200, { "content-type": types[".html"] });
        res.end(pageHtml);
        return;
      }
      const file = join(root, "public", url.pathname);
      try {
        const body = readFileSync(file);
        res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("missing");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const server = await serve();
const { port } = server.address();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${port}/shot.html`);
for (const shot of shots) {
  await page.evaluate(
    ({ html, kind, review }) => {
      document.getElementById("stage").innerHTML = html;
      const handoff = window.FlavorWeaveShopHandoff;
      const root = document.getElementById("shopOrderBody");
      const sheet = document.getElementById("shopOrderSheet");
      if (kind === "review") handoff.renderReview(root, review);
      if (kind === "unavailable") {
        handoff.renderUnavailable(root, { preferences: { household: { usual_store: "Market Street" } } });
      }
      if (kind === "unsupported") {
        handoff.renderReview(root, {
          ...review,
          included: [{ display_text: "Yellow onion", quantity_label: "2 each" }],
          transferable_count: 1,
        });
      }
      if (kind === "stale") handoff.renderReview(root, { ...review, handoff: { status: "stale" } });
      if (kind === "failed") {
        handoff.renderFailed(root, review, "We couldn’t create the Instacart link. Your list is unchanged.");
      }
      if (sheet) sheet.showModal();
    },
    { html: shot.html, kind: shot.kind, review }
  );
  await page.evaluate(() => {
    document.getAnimations().forEach((anim) => anim.finish());
  });
  await page.screenshot({ path: join(outDir, `${shot.name}.png`) });
}
await browser.close();
server.close();
console.log(`wrote ${shots.length} screens to ${outDir}`);
