#!/usr/bin/env python3
"""
Derive FlavorWeave production brand assets from the approved v2 artwork.

Inputs (approved, do not redraw):
  design/flavorweave-v2/approved-wordmark.png   custom wordmark with woven W
  design/flavorweave-v2/approved-emblem.png     interwoven-ribbon emblem lockup

Outputs (public/brand/):
  flavorweave-wordmark.svg            Ink + Coral wordmark (light surfaces)
  flavorweave-wordmark-reversed.svg   Light ink + Coral wordmark (Dark Mode only)
  flavorweave-emblem.svg              emblem only (favicon / app icon / micro header)
  flavorweave-lockup-horizontal.svg   emblem + wordmark, side by side
  flavorweave-lockup-stacked.svg      emblem above wordmark
  favicon-*.png, favicon.ico, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png
  ../favicon.svg                      canvas-framed emblem

Requires: python3, numpy, pillow, cairosvg, potrace (CLI).
Run from the repo root:  python3 scripts/brand/build-brand-assets.py
"""
import os
import re
import subprocess
import tempfile

import cairosvg
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "design", "flavorweave-v2")
OUT = os.path.join(ROOT, "public", "brand")

INK = "#17393A"
CORAL = "#F15D3C"
INK_REVERSED = "#E9F2EF"
CANVAS = "#FFFDF8"
SCALE = 4


def color_masks(img):
    a = np.asarray(img.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    coral = np.clip((r - b - 40) / 80.0, 0, 1) * np.clip((r - 90) / 60.0, 0, 1)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    ink = np.clip((200 - luma) / 120.0, 0, 1) * (1 - coral)
    return ink, coral


def trace(mask, workdir, name):
    img = Image.fromarray((mask * 255).astype("uint8"))
    img = img.resize((img.width * SCALE, img.height * SCALE), Image.BICUBIC)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    bw = img.point(lambda v: 0 if v > 128 else 255).convert("1")
    pbm = os.path.join(workdir, name + ".pbm")
    svg = os.path.join(workdir, name + ".svg")
    bw.save(pbm)
    subprocess.run(
        ["potrace", pbm, "-s", "-o", svg, "--turdsize", "60", "--alphamax", "1.0",
         "--opttolerance", "0.4", "-u", "10", "--flat"],
        check=True,
    )
    src = open(svg).read()
    m = re.search(r'<g transform="([^"]+)"\s*fill="#000000" stroke="none">(.*?)</g>', src, re.S)
    ys, xs = np.where(np.asarray(img) > 128)
    return m.group(1), re.sub(r"\s+", " ", m.group(2)).strip(), (xs.min(), ys.min(), xs.max(), ys.max())


def union(a, b):
    return min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])


def layers(ink, coral, ink_fill, coral_fill, group_id):
    return (
        f'<g id="{group_id}">'
        f'<g transform="{ink[0]}" fill="{ink_fill}">{ink[1]}</g>'
        f'<g transform="{coral[0]}" fill="{coral_fill}">{coral[1]}</g>'
        "</g>"
    )


def write(path, content):
    with open(path, "w") as f:
        f.write(content)


def main():
    os.makedirs(OUT, exist_ok=True)
    work = tempfile.mkdtemp(prefix="fw-brand-")

    wm_img = Image.open(os.path.join(SRC, "approved-wordmark.png"))
    wm_ink_mask, wm_coral_mask = color_masks(wm_img)
    wm_ink = trace(wm_ink_mask, work, "wm_ink")
    wm_coral = trace(wm_coral_mask, work, "wm_coral")
    x0, y0, x1, y1 = union(wm_ink[2], wm_coral[2])
    pad = 8
    wm_box = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)

    em_src = Image.open(os.path.join(SRC, "approved-emblem.png")).convert("RGB")
    w, h = em_src.size
    # The approved lockup places the emblem in the upper-center of a square canvas.
    em_crop = em_src.crop((int(w * 0.335), int(h * 0.223), int(w * 0.702), int(h * 0.59)))
    em_ink_mask, em_coral_mask = color_masks(em_crop)
    em_ink = trace(em_ink_mask, work, "em_ink")
    em_coral = trace(em_coral_mask, work, "em_coral")
    ex0, ey0, ex1, ey1 = union(em_ink[2], em_coral[2])
    side = max(ex1 - ex0, ey1 - ey0) + 24
    cx, cy = (ex0 + ex1) / 2, (ey0 + ey1) / 2
    em_box = (int(cx - side / 2), int(cy - side / 2), int(side), int(side))

    def vb(box):
        return " ".join(str(int(v)) for v in box)

    wordmark = layers(wm_ink, wm_coral, INK, CORAL, "fw-wordmark")
    wordmark_rev = layers(wm_ink, wm_coral, INK_REVERSED, CORAL, "fw-wordmark")
    emblem = layers(em_ink, em_coral, INK, CORAL, "fw-emblem")

    def svg(box, body, title):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb(box)}" role="img" aria-label="{title}">'
            f"<title>{title}</title>{body}</svg>\n"
        )

    write(os.path.join(OUT, "flavorweave-wordmark.svg"), svg(wm_box, wordmark, "FlavorWeave"))
    write(os.path.join(OUT, "flavorweave-wordmark-reversed.svg"), svg(wm_box, wordmark_rev, "FlavorWeave"))
    write(os.path.join(OUT, "flavorweave-emblem.svg"), svg(em_box, emblem, "FlavorWeave"))

    # Lockups: nested viewports keep each mark's geometry untouched.
    wm_w, wm_h = wm_box[2], wm_box[3]
    em_side = wm_h * 1.5
    gap = wm_h * 0.35
    hw = em_side + gap + wm_w
    emblem_rev = layers(em_ink, em_coral, INK_REVERSED, CORAL, "fw-emblem")

    def horizontal(em_body, wm_body):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {hw:.0f} {em_side:.0f}" role="img" aria-label="FlavorWeave">'
            "<title>FlavorWeave</title>"
            f'<svg x="0" y="0" width="{em_side:.0f}" height="{em_side:.0f}" viewBox="{vb(em_box)}">{em_body}</svg>'
            f'<svg x="{em_side + gap:.0f}" y="{(em_side - wm_h) / 2:.0f}" width="{wm_w}" height="{wm_h}" viewBox="{vb(wm_box)}">{wm_body}</svg>'
            "</svg>\n"
        )

    write(os.path.join(OUT, "flavorweave-lockup-horizontal.svg"), horizontal(emblem, wordmark))
    write(
        os.path.join(OUT, "flavorweave-lockup-horizontal-reversed.svg"),
        horizontal(emblem_rev, wordmark_rev),
    )
    st_em = wm_w * 0.42
    st_h = st_em + gap + wm_h
    stacked = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {wm_w} {st_h:.0f}" role="img" aria-label="FlavorWeave">'
        "<title>FlavorWeave</title>"
        f'<svg x="{(wm_w - st_em) / 2:.0f}" y="0" width="{st_em:.0f}" height="{st_em:.0f}" viewBox="{vb(em_box)}">{emblem}</svg>'
        f'<svg x="0" y="{st_em + gap:.0f}" width="{wm_w}" height="{wm_h}" viewBox="{vb(wm_box)}">{wordmark}</svg>'
        "</svg>\n"
    )
    write(os.path.join(OUT, "flavorweave-lockup-stacked.svg"), stacked)

    def framed(pad_ratio, radius_ratio):
        size = 512
        inner = size * (1 - 2 * pad_ratio)
        off = size * pad_ratio
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="FlavorWeave">'
            "<title>FlavorWeave</title>"
            f'<rect width="{size}" height="{size}" rx="{size * radius_ratio:.0f}" fill="{CANVAS}"/>'
            f'<svg x="{off:.0f}" y="{off:.0f}" width="{inner:.0f}" height="{inner:.0f}" viewBox="{vb(em_box)}">{emblem}</svg>'
            "</svg>\n"
        )

    favicon_svg = framed(0.1, 0.22)
    write(os.path.join(ROOT, "public", "favicon.svg"), favicon_svg)

    def png(svg_text, size, dest):
        cairosvg.svg2png(bytestring=svg_text.encode(), write_to=dest, output_width=size, output_height=size)

    for s in (16, 32, 48):
        png(favicon_svg, s, os.path.join(OUT, f"favicon-{s}.png"))
    png(framed(0.12, 0.0), 180, os.path.join(OUT, "apple-touch-icon.png"))
    png(framed(0.12, 0.0), 192, os.path.join(OUT, "icon-192.png"))
    png(framed(0.12, 0.0), 512, os.path.join(OUT, "icon-512.png"))
    png(framed(0.22, 0.0), 512, os.path.join(OUT, "icon-maskable-512.png"))
    ico = Image.open(os.path.join(OUT, "favicon-48.png"))
    ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("brand assets written to", OUT)


if __name__ == "__main__":
    main()
