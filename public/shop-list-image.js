/**
 * Shopping-list image. Layout is pure and DOM-free.
 * Paint runs in the browser from that layout. Nothing is uploaded.
 */
const SHOP_IMAGE = Object.freeze({
  width: 1080,
  maxHeight: 4000,
  padX: 72,
  padTop: 88,
  padBottom: 108,
  title: "Shopping list",
  titleSize: 64,
  titleWeight: 700,
  titleGap: 40,
  itemSize: 44,
  qtyWeight: 700,
  nameWeight: 400,
  lineHeight: 66,
  /** A quantity wider than this share of the row wraps the name under the quantity instead. */
  maxIndentRatio: 0.5,
  rowGap: 20,
  ink: "#17393A",
  brand: "FlavorWeave",
  brandSize: 22,
  brandColor: "#8A8178",
  background: "#FFFFFF",
  /** Plus Jakarta Sans is the UI face. Inter is the fallback if it does not load. */
  fontFamily: '"Plus Jakarta Sans", Inter, "DejaVu Sans", "Noto Sans", sans-serif',
  fontTimeoutMs: 1500,
});

/**
 * Wait for the brand face before painting. A timeout or a failed load keeps the
 * fallback stack so the image still renders.
 * @param {{ fonts?: { load?: Function }, timeoutMs?: number, family?: string }} [options]
 */
export async function ensureShopImageFont(options = {}) {
  const family = options.family || "Plus Jakarta Sans";
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : SHOP_IMAGE.fontTimeoutMs;
  const fallback = SHOP_IMAGE.fontFamily;
  const fonts = options.fonts || (typeof document !== "undefined" ? document.fonts : null);
  if (!fonts || typeof fonts.load !== "function") return { loaded: false, fontFamily: fallback };
  let timer;
  try {
    await Promise.race([
      Promise.all([
        fonts.load(`700 64px "${family}"`),
        fonts.load(`400 44px "${family}"`),
        fonts.load(`500 22px "${family}"`),
      ]),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("font timeout"), { name: "TimeoutError" })), timeoutMs);
      }),
    ]);
    if (typeof fonts.check === "function" && !fonts.check(`400 44px "${family}"`)) {
      return { loaded: false, fontFamily: fallback };
    }
    return { loaded: true, fontFamily: `"${family}", Inter, "DejaVu Sans", "Noto Sans", sans-serif` };
  } catch {
    return { loaded: false, fontFamily: fallback };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function defaultMeasure(text, fontSize, weight) {
  const factor = Number(weight) >= 600 ? 0.62 : 0.56;
  return Math.ceil(String(text || "").length * Number(fontSize) * factor);
}

/**
 * Wrap units: words, except that a parenthetical group such as "(24 oz)"
 * stays one unit when it fits on a line by itself. The line then breaks
 * before the "(" instead of inside it.
 */
function wrapUnits(text, width, fontSize, weight, measure) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const units = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith("(") && !words[i].includes(")")) {
      let j = i;
      while (j < words.length - 1 && !words[j].includes(")")) j++;
      const group = words.slice(i, j + 1).join(" ");
      if (words[j].includes(")") && measure(group, fontSize, weight) <= width) {
        units.push(group);
        i = j;
        continue;
      }
    }
    units.push(words[i]);
  }
  return units;
}

function wrapText(text, maxWidth, fontSize, weight, measure) {
  const width = Math.max(40, maxWidth);
  const units = wrapUnits(text, width, fontSize, weight, measure);
  const lines = [];
  let current = "";
  function pushUnit(unit) {
    if (measure(unit, fontSize, weight) <= width) {
      current = unit;
      return;
    }
    let chunk = "";
    for (const ch of Array.from(unit)) {
      const next = chunk + ch;
      if (measure(next, fontSize, weight) <= width) chunk = next;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  for (const unit of units) {
    const trial = current ? `${current} ${unit}` : unit;
    if (current && measure(trial, fontSize, weight) <= width) {
      current = trial;
      continue;
    }
    if (current) lines.push(current);
    pushUnit(unit);
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push("");
  return lines;
}

function fontCss(weight, size, family) {
  return `${weight} ${size}px ${family}`;
}

/**
 * @param {{ quantity?: string, name?: string }[]} rows
 * @param {object} [options]
 */
export function layoutShoppingList(rows, options = {}) {
  const spec = { ...SHOP_IMAGE, ...options, fontFamily: options.fontFamily || SHOP_IMAGE.fontFamily };
  const measure = options.measure || defaultMeasure;
  const pages = [];

  function blankPage() {
    return {
      width: spec.width,
      maxHeight: spec.maxHeight,
      background: spec.background,
      ink: spec.ink,
      fontFamily: spec.fontFamily,
      title: spec.title,
      titleSize: spec.titleSize,
      titleWeight: spec.titleWeight,
      titleX: spec.padX,
      titleY: spec.padTop + spec.titleSize,
      itemSize: spec.itemSize,
      qtyWeight: spec.qtyWeight,
      nameWeight: spec.nameWeight,
      lineHeight: spec.lineHeight,
      brand: spec.brand,
      brandSize: spec.brandSize,
      brandColor: spec.brandColor,
      padX: spec.padX,
      padBottom: spec.padBottom,
      rows: [],
      cursor: spec.padTop + spec.titleSize + spec.titleGap,
    };
  }

  let page = blankPage();
  const contentBottom = () => spec.maxHeight - spec.padBottom;

  function finish(current) {
    const last = current.rows.length ? current.rows[current.rows.length - 1] : null;
    const contentEnd = last ? last.y + last.height : current.cursor;
    const fitted = Math.min(spec.maxHeight, Math.max(contentEnd + spec.padBottom, spec.padTop + spec.titleSize + spec.padBottom));
    const brandWidth = measure(spec.brand, spec.brandSize, 500);
    return {
      ...current,
      height: fitted,
      brandX: spec.width - spec.padX - brandWidth,
      brandY: fitted - 36,
    };
  }

  const source = Array.isArray(rows) ? rows : [];
  const contentWidth = spec.width - spec.padX * 2;
  for (const row of source) {
    const quantity = String(row?.quantity || "");
    const name = String(row?.name || "");
    // One inline line: bold quantity, one normal space, then the name.
    // Wrapped name lines hang under the name, not under the quantity.
    const qtyWidth = quantity ? measure(quantity, spec.itemSize, spec.qtyWeight) : 0;
    const spaceWidth = quantity ? measure(" ", spec.itemSize, spec.nameWeight) : 0;
    const inlineIndent = quantity ? Math.ceil(qtyWidth + spaceWidth) : 0;
    const hanging = inlineIndent <= contentWidth * spec.maxIndentRatio;
    const xName = spec.padX + (hanging ? inlineIndent : 0);
    const nameWidth = spec.width - spec.padX - xName;
    const nameLines = hanging
      ? wrapText(name, nameWidth, spec.itemSize, spec.nameWeight, measure)
      : [""].concat(wrapText(name, nameWidth, spec.itemSize, spec.nameWeight, measure));
    const block = Math.max(spec.lineHeight, nameLines.length * spec.lineHeight);
    const height = block + spec.rowGap;
    if (page.rows.length && page.cursor + height > contentBottom()) {
      pages.push(finish(page));
      page = blankPage();
    }
    page.rows.push({
      quantity,
      quantityWidth: qtyWidth,
      spaceWidth,
      nameLines,
      nameWidth,
      xQty: spec.padX,
      xName,
      hanging,
      y: page.cursor,
      height,
    });
    page.cursor += height;
  }
  pages.push(finish(page));
  const count = pages.length;
  return {
    width: spec.width,
    maxHeight: spec.maxHeight,
    pages: pages.map((item, index) => ({ ...item, index: index + 1, count })),
  };
}

function paintPage(ctx, page) {
  ctx.fillStyle = page.background;
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.fillStyle = page.ink;
  ctx.font = fontCss(page.titleWeight, page.titleSize, page.fontFamily);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(page.title, page.titleX, page.titleY);
  for (const row of page.rows) {
    if (row.quantity) {
      ctx.fillStyle = page.ink;
      ctx.font = fontCss(page.qtyWeight, page.itemSize, page.fontFamily);
      ctx.fillText(row.quantity, row.xQty, row.y + page.itemSize);
    }
    ctx.font = fontCss(page.nameWeight, page.itemSize, page.fontFamily);
    ctx.fillStyle = page.ink;
    row.nameLines.forEach((line, i) => {
      ctx.fillText(line, row.xName, row.y + page.itemSize + i * page.lineHeight);
    });
  }
  ctx.fillStyle = page.brandColor;
  ctx.font = fontCss(500, page.brandSize, page.fontFamily);
  const mark = page.count > 1 ? `${page.brand}  ·  ${page.index} / ${page.count}` : page.brand;
  const markWidth = ctx.measureText(mark).width;
  ctx.fillText(mark, page.width - page.padX - markWidth, page.brandY);
}

export function renderShoppingListCanvases(rows, options = {}) {
  const dpr = options.dpr || (typeof window !== "undefined" && window.devicePixelRatio) || 2;
  const probe = document.createElement("canvas").getContext("2d");
  const family = options.fontFamily || SHOP_IMAGE.fontFamily;
  const measure = (text, fontSize, weight) => {
    probe.font = fontCss(weight, fontSize, family);
    return probe.measureText(String(text || "")).width;
  };
  const layout = layoutShoppingList(rows, { ...options, fontFamily: family, measure });
  return layout.pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.width * dpr);
    canvas.height = Math.round(page.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    paintPage(ctx, page);
    return canvas;
  });
}

export function imageHandoffPlan(nav) {
  let canShareFiles = false;
  try {
    const file = typeof File !== "undefined" ? new File(["x"], "shopping-list.png", { type: "image/png" }) : null;
    canShareFiles = !!(
      file &&
      nav &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] }) &&
      typeof nav.share === "function"
    );
  } catch {
    canShareFiles = false;
  }
  if (canShareFiles) return { method: "share" };
  if (!nav || nav.downloadAvailable !== false) return { method: "download" };
  return { method: "open-tab" };
}

export function imageHandoffFeedback(outcome) {
  const method = outcome && outcome.method;
  if (method === "share" && outcome.errorName === "AbortError") {
    return {
      tone: "cancel",
      claimedSaved: false,
      message: "Share cancelled. Your list is still here.",
    };
  }
  if (method === "share" && outcome.completed) {
    return {
      tone: "ready",
      claimedSaved: false,
      message: "Your shopping-list image is ready. Review the matched items in your grocery app.",
    };
  }
  if (method === "download") {
    return {
      tone: "download",
      claimedSaved: false,
      message: "Download started. Check your downloads, then review the items in your grocery app.",
    };
  }
  if (method === "open-tab") {
    return {
      tone: "fallback",
      claimedSaved: false,
      message: "The image is open in a new tab. Press and hold it to save, then review the items in your grocery app.",
    };
  }
  return {
    tone: "error",
    claimedSaved: false,
    message: "Couldn’t prepare the image. Try Copy for my grocery app.",
  };
}

export { SHOP_IMAGE };

if (typeof window !== "undefined") {
  window.FlavorWeaveShopImage = {
    SHOP_IMAGE,
    ensureShopImageFont,
    layoutShoppingList,
    renderShoppingListCanvases,
    imageHandoffPlan,
    imageHandoffFeedback,
  };
}
