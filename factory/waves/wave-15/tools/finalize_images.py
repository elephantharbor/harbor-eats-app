#!/usr/bin/env python3
"""Wave-15 image finalizer. Run ONLY after an original Grok Bot GenerateImage hero has been
saved in candidates/<slug>/ and visually approved against image-plating-brief.md
(appetizing, matches the recipe, hero quality).

  python3 tools/finalize_images.py <slug> [<slug> ...] --generator "<who> via Grok Bot GenerateImage" [--date YYYY-MM-DD] [--source <file>]

Source file: --source <name> in the candidate dir, or else the highest-numbered img_vN.(jpg|jpeg|png|webp)
there (img_v2.jpg beats img_v1.jpg). For a replacement hero save it as the NEXT number (img_v2.jpg)
so the current source stays intact until it is moved to rejected/.

For each slug it:
  1. refuses if the chosen source is the already-finalized active source (same sha256) and both WebPs exist;
  2. moves the current active master, card, and (if it is a different file) source into rejected/
     under new names <stem>-replaced-<timestamp><ext>, and records them under image.superseded;
  3. exports the 1200x900 master and 640x480 card WebPs with export_meal_webps.py;
  4. writes the finished image block (package_revision common.REV, recipe_fidelity_state awaiting_audit,
     true method_detail from the real source size), catalog_confidence, and image-state.json;
  5. re-runs build_packages.py --force <slug> so README, prompt, brief, and v1.json text use the
     post-image wording (build_packages verifies the recorded sha256 and never touches image files);
  6. runs freeze_integrity.py on the package.
Then run the structural preflight (command printed at the end).
It never fetches images, never calls an external API, never imports, certifies, or touches D1.
"""
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402

WAVE = HERE.parent
CAND = WAVE / "candidates"
FACTORY = WAVE.parent
EXPORT = FACTORY / "export_meal_webps.py"
FREEZE = FACTORY / "freeze_integrity.py"
REV = common.REV
SRC_RE = re.compile(r"^img_v(\d+)\.(?:jpg|jpeg|png|webp)$", re.I)


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def arg(flag, default=None):
    if flag in sys.argv:
        return sys.argv[sys.argv.index(flag) + 1]
    return default


def pick_source(d, name=None):
    if name:
        p = d / name
        if not p.is_file():
            raise SystemExit(f"{d.name}: --source {name} not found in {d}")
        return p
    found = sorted(((int(m.group(1)), p) for p in d.iterdir() if p.is_file() and (m := SRC_RE.match(p.name))), key=lambda x: x[0])
    if not found:
        raise SystemExit(f"{d.name}: no img_vN.jpg/png in {d}; generate the hero first")
    return found[-1][1]


def finalize(slug, generator, date, source_name=None):
    global REV
    REV = common.rev_for(slug)
    d = CAND / slug
    src = pick_source(d, source_name)
    from PIL import Image
    with Image.open(src) as im:
        sw, sh = im.size
    if sw < 960 or sh < 720:
        print(f"WARNING {slug}: source {sw}x{sh} is small; the 1200x900 master is an upscale")
    doc = json.loads((d / "v1.json").read_text())
    old = doc.get("image") or {}
    master, card = d / f"{slug}.webp", d / f"{slug}-640.webp"
    src_sha = sha(src)
    old_hashes = old.get("file_hashes") or {}
    if old.get("asset_generated") and old_hashes.get("source_jpeg_sha256") == src_sha and master.exists() and card.exists():
        raise SystemExit(f"{slug}: {src.name} is already the finalized active source (same sha256). Save the new hero as the next img_vN.jpg.")
    superseded = list(old.get("superseded") or [])
    _m = SRC_RE.match(src.name)
    n_new = int(_m.group(1)) if _m else None
    if master.exists() or card.exists():
        rej = d / "rejected"
        rej.mkdir(exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        moved = {}
        old_src = d / old["active_source_jpeg"] if old.get("active_source_jpeg") else None
        targets = [master, card] + ([old_src] if old_src and old_src.exists() and old_src.resolve() != src.resolve() else [])
        for p in targets:
            dest = rej / f"{p.stem}-replaced-{stamp}{p.suffix}"
            moved[p.name] = {"rejected_path": f"rejected/{dest.name}", "sha256": sha(p)}
            shutil.move(str(p), str(dest))
        if old_src and old_src.resolve() == src.resolve():
            print(f"WARNING {slug}: the new hero overwrote {src.name}; the previous source survives only in the backup tarball "
                  f"(recorded sha256 {old_hashes.get('source_jpeg_sha256')}).")
        superseded.append({"image_id": old.get("image_id"), "active_source_jpeg": old.get("active_source_jpeg"),
                           "file_hashes": old_hashes, "generation_date": (old.get("generation") or {}).get("generation_date"),
                           "moved_to_rejected": moved, "replaced_on": date,
                           "reason": (common.FINAL_EDITS[slug]["superseded_reason"] if slug in common.FINAL_EDITS and n_new == common.FINAL_EDITS[slug]["version"]
                                     else f"Audit r1 gate K FAIL ({common.AUDIT_R1_REGEN[slug]})" if slug in common.AUDIT_R1_REGEN else "Replaced by a newer approved hero.")})
    # Creator self-review regeneration (before any audit): the rejected v1 was never finalized, so the
    # replaced-master logic above does not see it. Move it to rejected/ and record it honestly.
    sr = common.SELFREVIEW_V2.get(slug) if src.name.lower().startswith("img_v2") else None  # later versions keep the v2 record via superseded
    selfreview = None
    if common.SELFREVIEW_V2.get(slug) and not sr and not any(e.get("image_id") == f"img_{slug}_v1" for e in superseded):
        raise SystemExit(f"{slug}: SELFREVIEW_V2 slug finalized past v2 without the v1 superseded record")
    if sr:
        rej = d / "rejected"
        rej.mkdir(exist_ok=True)
        v1 = next((d / n for n in ("img_v1.jpg", "img_v1.jpeg", "img_v1.png") if (d / n).exists()), None)
        dest = rej / f"img_v1-selfreview-rejected{v1.suffix if v1 else '.jpg'}"
        if v1:
            if dest.exists():
                raise SystemExit(f"{slug}: {dest} already exists; not overwriting")
            v1_sha = sha(v1)
            shutil.move(str(v1), str(dest))
        elif dest.exists():
            v1_sha = sha(dest)
        else:
            raise SystemExit(f"{slug}: rejected v1 source not found in {d} or rejected/")
        gm = common.gen_map().get(slug, {})
        selfreview = {
            "image_id": f"img_{slug}_v1", "source_file": "img_v1.jpg", "sha256": v1_sha,
            "generate_image_attachment_hash": gm.get("v1"),
            "moved_to_rejected": f"rejected/{dest.name}", "never_finalized": True,
            "generation_date": date, "rejected_on": date,
            "rejected_by": "Cora (creator self-review against image-plating-brief.md, before any audit)",
            "reason": sr["v1_rejection"],
        }
        if not any(e.get("image_id") == selfreview["image_id"] and e.get("never_finalized") for e in superseded):
            superseded.append(selfreview)
    # A self-review-rejected audit-r1 attempt (never finalized), already saved in rejected/ by Cora.
    s1 = common.SELFREVIEW_R1.get(slug)
    if s1 and not any(e.get("image_id") == f"img_{slug}_v{s1['version']}" for e in superseded):
        f1 = d / s1["file"]
        if not f1.exists():
            raise SystemExit(f"{slug}: {s1['file']} not found")
        h1 = sha(f1)
        if not h1.startswith(s1["map_hash_prefix"]):
            raise SystemExit(f"{slug}: {s1['file']} sha256 does not match the image-gen-map prefix")
        superseded.append({"image_id": f"img_{slug}_v{s1['version']}", "source_file": f"img_v{s1['version']}.jpg", "sha256": h1,
                           "generate_image_attachment_hash": s1["map_hash_prefix"] + " (truncated in notes/image-gen-map.txt)",
                           "moved_to_rejected": s1["file"], "never_finalized": True, "generation_date": date, "rejected_on": date,
                           "rejected_by": "Cora (creator self-review, after audit r1)", "reason": s1["reason"]})
    subprocess.run([sys.executable, str(EXPORT), str(src), str(d), slug], check=True)
    rv = doc["recipe_version"].get("recipe_version_id", f"rv_{slug}_v1")
    deriv = lambda role, w, h, name: {"role": role, "format": "webp", "width": w, "height": h, "aspect": "4:3", "path": name,
                                      "spec_catalog_path": f"/images/meals/{name}", "status": "frozen_for_audit"}
    hashes = {src.name: src_sha, master.name: sha(master), card.name: sha(card)}
    cw, ch = common.crop_43(sw, sh)
    n = SRC_RE.match(src.name)
    image = {
        "image_id": f"img_{slug}_v{n.group(1)}" if n else f"img_{slug}_v1", "dish_id": slug, "recipe_version_id": rv, "asset_generated": True,
        "slot_status": "frozen_for_audit",
        "master_ref": master.name, "card_ref": card.name, "master_filename": master.name, "card_filename": card.name,
        "active_source_jpeg": src.name,
        "dimensions_target": {"width": 1200, "height": 900, "aspect": "4:3"},
        "dimensions": {"master_width": 1200, "master_height": 900, "card_width": 640, "card_height": 480},
        "derivatives": [deriv("master", 1200, 900, master.name), deriv("thumb", 640, 480, card.name)],
        "dimensions_basis": f"Center-crop the {sw}x{sh} GenerateImage source ({src.name}) to 4:3 ({cw}x{ch}), then LANCZOS-resize to the 1200x900 master and 640x480 card WebPs with export_meal_webps.py.",
        "source_dimensions": {"width": sw, "height": sh},
        "generation": {"method": "grok_bot_GenerateImage_then_format_size_conversion",
                       "method_detail": common.method_detail(sw, sh),
                       "generator": generator, "model": "unknown",
                       "model_note": "GenerateImage model slug not independently verified from tool metadata.",
                       "prompt_authored_on": doc.get("authored_on"), "generation_date": date,
                       "prompt_file": "image-prompt.md", "plating_brief_file": "image-plating-brief.md",
                       "external_image_api_called": False, "stock_or_web_photo_used": False,
                       "house_quality_reference": "image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png"},
        "qa_state": "frozen_for_audit", "recipe_fidelity_state": "awaiting_audit",
        "rights": "not_cleared_for_external_release", "provenance": "ai_illustration",
        "provenance_note": f"Original AI illustration generated with Grok Bot GenerateImage from this package's recipe and plating brief. Master and card WebPs are present and frozen for audit at {REV}. asset_generated is true.",
        "package_revision": REV, "rejected_dir": "rejected/",
        "regeneration_count": len(superseded),
        "file_hashes": {"source_jpeg_sha256": hashes[src.name], "master_sha256": hashes[master.name], "card_sha256": hashes[card.name]},
        "asset_sha256": hashes,
    }
    gm = common.gen_map().get(slug, {})
    tag = f"v{n.group(1)}" if n else "v1"
    image["generation"]["generate_image_attachment_hash"] = gm.get(tag)
    image["generation"]["generate_image_attachment_hash_note"] = "From notes/image-gen-map.txt; equals the sha256 of the active source file."
    if sr:
        image["regeneration"] = {
            "version": 2, "basis": "creator_self_review_before_audit",
            "summary": f"Active hero is a v2 regeneration. The v1 hero ({selfreview['moved_to_rejected']}) was rejected in Cora's self-review: {sr['v1_rejection']}",
            "prompt_change": "v2 prompt = v1 prompt verbatim plus one 'Regeneration clarifier:' sentence inserted before the quality-reference sentence"
                             + ("; the Styling line was also changed" if sr.get("styling_change") else "") + ". See the 'Regeneration v2 prompt addition' section of image-prompt.md.",
            "clarifier_sentence": f"Regeneration clarifier: {sr['clarifier']}",
        }
        if sr.get("styling_change"):
            image["regeneration"]["styling_change"] = {"v1": sr["styling_change"][0], "v2": sr["styling_change"][1]}
    history = list(old.get("regeneration_history") or ([old["regeneration"]] if old.get("regeneration") else []))
    if sr:
        history.append(image["regeneration"])
    if slug in common.AUDIT_R1_REGEN:
        image["regeneration"] = {
            "version": int(n.group(1)) if n else None, "basis": "audit_r1_gate_K",
            "summary": (f"Active hero is an audit r1 regeneration ({src.name}). Audit r1 gate K FAIL on the previous hero: {common.AUDIT_R1_REGEN[slug]}."
                        + (f" {s1['reason']}" if s1 else "")),
            "prompt_change": ("Brief and prompt revised to Cora's audit r1 prompt (notes/r1-regen-prompts.txt; image-prompt.md 'Regeneration (audit r1) prompt')"
                              + (f" with the v{common.FINAL_EDITS[slug]['version']} changes in image-prompt.md 'Final prompt (v{common.FINAL_EDITS[slug]['version']})' (no side bowl or sauce dish)" if slug in common.FINAL_EDITS and n_new == common.FINAL_EDITS[slug]["version"] else "")
                              + (f" plus the v{s1['version'] + 1} addendum: \"{s1['v3_addendum']}\"" if s1 else "") + "."),
        }
        history.append(image["regeneration"])
    if history:
        image["regeneration_history"] = history
    if superseded:
        image["superseded"] = superseded
        if slug in common.AUDIT_R1_REGEN:
            image["regenerated_for_audit"] = "audit-r1"
    doc["image"] = image
    doc["catalog_confidence"].update({"image_fidelity": "PENDING_AUDIT", "provenance": "KNOWN_TEXT_AND_IMAGE",
                                      "image_rights_provenance": "KNOWN_NOT_CLEARED_FOR_EXTERNAL", "image_provenance": "PRESENT_AI"})
    (d / "v1.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    (d / "image-state.json").write_text(json.dumps({"slot_status": "frozen_for_audit", "asset_generated": True,
        "expected_files": [master.name, card.name], "present_files": [master.name, card.name],
        "source": src.name, "generator": generator, "generation_date": date, "sha256": hashes,
        "regeneration_count": len(superseded), **({"regeneration": image["regeneration"]} if image.get("regeneration") else {})}, indent=2) + "\n")
    # Text in post-image wording at REV (build_packages verifies hashes and never touches image files).
    b = subprocess.run([sys.executable, str(HERE / "build_packages.py"), "--force", slug], capture_output=True, text=True)
    if b.returncode != 0:
        print(b.stdout, b.stderr)
        raise SystemExit(f"{slug}: build_packages.py failed after export; the image files are in place, fix and re-run build_packages.py --force {slug}")
    r = subprocess.run([sys.executable, str(FREEZE), str(d)], capture_output=True, text=True)
    out = r.stdout.strip().splitlines() or ["(no output)"]
    print(f"{slug}: " + "\n  ".join(out))
    return r.returncode == 0


def main():
    flags = {"--generator", "--date", "--source"}
    vals = {arg(f) for f in flags if arg(f)}
    slugs = [a for a in sys.argv[1:] if not a.startswith("--") and a not in vals]
    gen = arg("--generator")
    if not slugs or not gen:
        raise SystemExit(__doc__)
    if arg("--source") and len(slugs) != 1:
        raise SystemExit("--source works with one slug at a time")
    date = arg("--date", datetime.date.today().isoformat())
    bad = [s for s in slugs if not finalize(s, gen, date, arg("--source"))]
    print("ALL PASS" if not bad else f"FAIL: {bad}")
    print("Next: cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-15/candidates")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
