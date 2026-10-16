#!/usr/bin/env python3
"""Wave-17 image finalizer. Run ONLY after an original Grok Bot GenerateImage hero has been
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
        _om = SRC_RE.match(old.get("active_source_jpeg") or "")
        _ov = int(_om.group(1)) if _om else None
        _aud = common.audit_rej(common.SELFREVIEW.get(slug))
        entry = {"image_id": old.get("image_id"), "active_source_jpeg": old.get("active_source_jpeg"),
                 "file_hashes": old_hashes, "generation_date": (old.get("generation") or {}).get("generation_date"),
                 "moved_to_rejected": moved, "replaced_on": date,
                 "reason": "Replaced by a newer approved hero."}
        if _ov in _aud:
            if common.audit_reasons().get((slug, f"v{_ov}")) != _aud[_ov]:
                raise SystemExit(f"{slug}: audit rejection reason for v{_ov} differs from notes/image-gen-map.txt")
            _rnd, _why = _aud[_ov]
            if old.get("package_revision") != common.AUDIT_FINALIZED_AT[_rnd]:
                raise SystemExit(f"{slug}: v{_ov} was finalized at {old.get('package_revision')}, not {common.AUDIT_FINALIZED_AT[_rnd]} as audit {_rnd} implies")
            entry.update({"reason": f"Rejected by independent audit {_rnd} gate K: {_why}", "rejected_by": f"independent audit {_rnd} (gate K)",
                          "finalized_at": old.get("package_revision"), "rejected_on": date})
        superseded.append(entry)
    # Creator self-review regenerations (before any audit): rejected versions were never finalized, so the
    # replaced-master logic above does not see them. Each must be in rejected/ as img_vK-selfreview-rejected.<ext>
    # (moved there now if it is still in the candidate dir); record each one honestly.
    sr = common.SELFREVIEW.get(slug)
    if sr and n_new != sr["final"]:
        raise SystemExit(f"{slug}: SELFREVIEW says v{sr['final']} is the accepted hero but the source picked is {src.name}")
    if not sr and n_new != 1:
        raise SystemExit(f"{slug}: {src.name} is past v1 but the slug has no SELFREVIEW record")
    gm = common.gen_map().get(slug, {})
    if gm.get(f"v{n_new}") != src_sha:
        raise SystemExit(f"{slug}: {src.name} sha256 does not match notes/image-gen-map.txt v{n_new}")
    for v in sorted((sr or {}).get("rejected", {})):
        rej = d / "rejected"
        rej.mkdir(exist_ok=True)
        here = next((d / f"img_v{v}{e}" for e in (".jpg", ".jpeg", ".png") if (d / f"img_v{v}{e}").exists()), None)
        dest = rej / f"img_v{v}-selfreview-rejected{here.suffix if here else '.jpg'}"
        if here:
            if dest.exists():
                raise SystemExit(f"{slug}: {dest} already exists; not overwriting")
            shutil.move(str(here), str(dest))
        elif not dest.exists():
            raise SystemExit(f"{slug}: rejected v{v} source not found in {d} or rejected/")
        v_sha = sha(dest)
        if gm.get(f"v{v}") != v_sha:
            raise SystemExit(f"{slug}: rejected v{v} sha256 does not match notes/image-gen-map.txt")
        entry = {
            "image_id": f"img_{slug}_v{v}", "source_file": f"img_v{v}.jpg", "sha256": v_sha,
            "generate_image_attachment_hash": gm.get(f"v{v}"),
            "moved_to_rejected": f"rejected/{dest.name}", "never_finalized": True,
            "generation_date": date, "rejected_on": date,
            "rejected_by": "Cora (creator self-review against image-plating-brief.md, before any audit)",
            "reason": sr["rejected"][v],
        }
        if not any(e.get("image_id") == entry["image_id"] and e.get("never_finalized") for e in superseded):
            superseded.append(entry)
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
        fin = sr["final"]
        aud = common.audit_rej(sr)
        _rounds = sorted({rnd for rnd, _ in aud.values()})
        image["regeneration"] = {
            "version": fin, "basis": (f"audit_{'_'.join(_rounds)}_gate_K_after_creator_self_review" if aud else "creator_self_review_before_audit"),
            "summary": ((f"Active hero is the v{fin} regeneration ({REV}). Earlier versions: "
                         + "; ".join((f"v{v}: rejected by independent audit {aud[v][0]} gate K after being finalized at {common.AUDIT_FINALIZED_AT[aud[v][0]]} ({aud[v][1]})" if v in aud
                                      else f"v{v}: rejected in Cora's creator self-review ({sr['rejected'][v]})") for v in range(1, fin)) + ".")
                        if aud else
                        (f"Active hero is the v{fin} regeneration. Versions v1 to v{fin - 1} were rejected in Cora's creator self-review: "
                         + "; ".join(f"v{v}: {sr['rejected'][v]}" for v in sorted(sr["rejected"])) + ".")),
            "prompt_change": (f"Each regeneration prompt is the author-r1 v1 prompt plus one appended 'Correction for this version:' sentence, recorded verbatim in "
                              "image-prompt.md 'Version history' (source notes/prompts-regen-selfreview.txt, a copy of /workspace/wave17-v2-prompts.txt); "
                              f"image-plating-brief.md was rebuilt to match the accepted v{fin} prompt."),
            "prompt_sha256": {f"v{v}": hashlib.sha256(common.regen_prompt(slug, v).encode()).hexdigest() for v in range(2, fin + 1)},
            "rejected_versions": sorted(set(sr["rejected"]) | set(aud)),
            **({"audit_rejected_versions": sorted(aud)} if aud else {}),
        }
    history = [h for h in (old.get("regeneration_history") or ([old["regeneration"]] if old.get("regeneration") else []))
               if h.get("version") != (sr or {}).get("final")]
    if sr:
        history.append(image["regeneration"])
    if history:
        image["regeneration_history"] = history
    if superseded:
        image["superseded"] = superseded
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
    print("Next: cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-17/candidates")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
