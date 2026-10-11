#!/usr/bin/env python3
"""Center-crop to 4:3 and write master 1200x900 + card 640x480 WebP RGB.

Usage, from the repo root:
  python3 factory/tools/export_meal_webps.py <source-image> factory/waves/<wave>/candidates/<slug> <slug>

Writes <slug>.webp (1200x900) and <slug>-640.webp (640x480) into the candidate
directory. Spec catalog paths, applied later by the integrator, are
/images/meals/<slug>.webp and /images/meals/<slug>-640.webp.
House-quality reference (quality only, not a composition template):
factory/tools/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
"""
import sys
from pathlib import Path
from PIL import Image

def center_crop_43(im: Image.Image) -> Image.Image:
    w, h = im.size
    target = 4 / 3
    if w / h > target:
        nw = int(h * target)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    else:
        nh = int(w / target)
        top = (h - nh) // 2
        return im.crop((0, top, w, top + nh))

def export(src: Path, dest_dir: Path, slug: str) -> None:
    im = Image.open(src).convert('RGB')
    cropped = center_crop_43(im)
    master = cropped.resize((1200, 900), Image.Resampling.LANCZOS)
    card = cropped.resize((640, 480), Image.Resampling.LANCZOS)
    dest_dir.mkdir(parents=True, exist_ok=True)
    master_path = dest_dir / f'{slug}.webp'
    card_path = dest_dir / f'{slug}-640.webp'
    master.save(master_path, 'WEBP', quality=90, method=6)
    card.save(card_path, 'WEBP', quality=88, method=6)
    print(f'OK {master_path} {master.size} {master_path.stat().st_size}')
    print(f'OK {card_path} {card.size} {card_path.stat().st_size}')

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print('usage: export_meal_webps.py <src_image> <dest_dir> <slug>')
        sys.exit(2)
    export(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
