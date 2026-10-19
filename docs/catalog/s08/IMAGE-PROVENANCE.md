# S-08 hero image provenance — salmon, pesto, Moroccan chickpea

Status: **exported and independently audited.** The three public WebPs are on this branch. Salmon r3, pesto, and Moroccan pass. Salmon r1 failed the crop audit and is not the shipped file.

- Source policy: original AI generation only. No web search, stock, restaurant, recipe-site, or scraped images were used.
- Method: `original_ai_generation` (the catalog value for an AI-generated illustration; `image.provenance` is `ai_illustration`).
- Generator: Grok Bot GenerateImage.
- Model: `unknown`. The tool does not report a model.
- Generation date: 2026-10-18.
- Recipe basis: `catalog/<slug>/v3.json`.
- Briefs: `docs/catalog/s08/image-plating-salmon.md`, `image-plating-pesto.md`, `image-plating-moroccan.md`.
- Prompts: `docs/catalog/s08/image-prompt-maple-mustard-glazed-salmon.md`, `image-prompt-cashew-pesto-pasta.md`, `image-prompt-moroccan-chickpea-skillet.md`.
- Exporter: `factory/tools/export_meal_webps.py`. Center crop to 4:3, LANCZOS, master WebP RGB 1200×900 quality 90 method 6, card WebP RGB 640×480 quality 88 method 6. The attached `run_export.sh` still points at the earlier unsynced asset ids and was not run.

## Sources, matched by sha256

The generation note said the tool returned 1024×576. The JPEGs whose sha256 matches the stated chosen files measure **1280×720**. Export used those measured pixels. A 1280×720 frame center-crops to 960×720 (160 px removed from each side), then scales to 1200×900.

| slug | chosen file | sha256 | measured |
|---|---|---|---|
| maple-mustard-glazed-salmon | chosen-r3.jpg | `b99df43ec8ba0a7810ef381ee147d69800290185c232ebb217f176a3b82b15c1` | 1280×720 |
| cashew-pesto-pasta | chosen-r2.jpg | `8658a59c684d5a3a8bcc3585f3b1a18b18533eb481ed121e32130d245fdaa69f` | 1280×720 |
| moroccan-chickpea-skillet | chosen-r2.jpg | `28b9518ab52a69cd89af51f6e17f63a915f937d0f83413b13a7a875ffc170296` | 1280×720 |

## Earlier generation that never synced

An earlier set (salmon `fe36cd71…`, pesto `0b3ef4ed…`, Moroccan `7a439cb0…`) was chosen and then regenerated because those files never became readable to the exporter. The attached prompts record that round and its rejects. The 2026-10-18 8:10 PM CT regeneration is what shipped:

- Salmon r1 (`84867b68…`): same prompt as the earlier c3. Exported, then failed the independent audit. See below.
- Salmon r2 (`7951252f…`): rejected before export for grill-stripe marks. That JPEG was not attached and was not audited here.
- Salmon r3 (`b99df43e…`): the shipped source. The plate sits in the central portion of the 1280×720 frame.
- Pesto r1 (`f6a515be…`) rejected: pale specks could read as grated cheese. Shipped r2 (`8658a59c…`) adds "entirely green, no white specks, no salt crystals."
- Moroccan r1 (`6d16bbb5…`) rejected: preserved lemon rendered as large yellow cubes. Shipped r2 (`28b9518a…`) asks for thin slivers.

The rejected regeneration JPEGs were not attached.

## Exported files

| file | dims | bytes | sha256 |
|---|---|---|---|
| public/images/meals/maple-mustard-glazed-salmon.webp | 1200×900 | 167286 | `0073b40dea7b0325fa9fd559105e5f4e66f1287185edc68df2f973e4dbf33e60` |
| public/images/meals/maple-mustard-glazed-salmon-640.webp | 640×480 | 58590 | `34229d7d199c5fe40fb55e642173be37776d8eb2aa28da5574c6b16cafc1278c` |
| public/images/meals/cashew-pesto-pasta.webp | 1200×900 | 236510 | `fbfa4b712bc4308d83cebfbd258bc9565f0ab155a4e40111dcd2534a0c67749d` |
| public/images/meals/cashew-pesto-pasta-640.webp | 640×480 | 86244 | `d5727b20bf247add3736dff038788afd90b7ec66c7097ceb149ed5f58af08d3c` |
| public/images/meals/moroccan-chickpea-skillet.webp | 1200×900 | 282164 | `0b4aca78927b035dd564e13c92579988514d88339ac22e3cdf1888eea48cfb52` |
| public/images/meals/moroccan-chickpea-skillet-640.webp | 640×480 | 109136 | `d882e7b6e61a9e686888c1f1acecc64e4eadcf021312c11aae83e1033b7ff490` |

The same hashes are on each v3 `image.file_hashes`. Shipped `image.qa_state` is `audit_pass`. Salmon r1's fail is recorded below and is not the file in `public/images/meals`.

## Independent audit

The auditor did not author these images. Each verdict is from the exported 1200×900 WebP, checked against its plating brief and the v3 ingredients. The 640 card is the same frame scaled down.

### maple-mustard-glazed-salmon — PASS

Shipped file is chosen-r3 (`b99df43e…`), exported with the same center crop. The 1200×900 WebP shows one fillet, a glossy amber glaze with darker caramelized edges, fresh dill on the fish, unglazed asparagus, and one lemon wedge. No grill stripes. The muscle lines on the fillet are not grill marks. Table shows on all four sides of the plate. The asparagus tips end on the plate, inside the frame. The 4:3 window on the 1280×720 source is x=160 to x=1120, and both of those edges are empty table.

### maple-mustard-glazed-salmon r1 — FAIL

chosen-r1 (`84867b68…`) was exported and audited first. It had one lemon wedge, dill, unglazed asparagus, and no grill marks. The glaze read more seared than a smooth maple-Dijon coat. The center crop did not keep the plate whole: on that source the line at x=1120 passed through the asparagus tips, and the plate continued past it, so the WebP cut off the spear tips and the right rim. Those WebPs were replaced by r3.

### maple-mustard-glazed-salmon r2 — rejected

chosen-r2 (`7951252f…`) was rejected before export because the glaze carried grill-stripe marks. The brief forbids grill marks. That JPEG was not attached, so this audit did not view it.

### cashew-pesto-pasta — PASS

Near-overhead wide bowl, fully inside the frame, with linen on every side. Ridged penne in a green pesto with an oil sheen, chopped golden cashews, halved cherry tomatoes, and three basil leaves. No white grated topping, no cream, no cheese pull. The cashews read as nuts. The basil leaves match v3 step 5 ("a few basil leaves"); they are not a sprig of an herb the cook did not use. Nothing on the bowl is clipped.

### moroccan-chickpea-skillet — PASS

Near-overhead low plate, rim fully inside the frame, linen visible around it. Couscous is a pale ring under the chickpeas. Whole chickpeas, wilted spinach, and chopped parsley on top. Preserved lemon shows as thin yellow slivers, not cubes and not fresh wedges. No feta, yogurt, olives, or a bare skillet. Nothing on the plate is clipped.
