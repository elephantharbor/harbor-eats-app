# S-08 hero image provenance — salmon, pesto, Moroccan chickpea

Status: **exported and independently audited.** The three public WebPs are on this branch. The salmon export fails the crop check. Pesto and Moroccan pass.

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
| maple-mustard-glazed-salmon | chosen-r1.jpg | `84867b68cb2e9a7d8abcf8be8b3d1ad120e8b784fe4ee4d983269944e7f73ccc` | 1280×720 |
| cashew-pesto-pasta | chosen-r2.jpg | `8658a59c684d5a3a8bcc3585f3b1a18b18533eb481ed121e32130d245fdaa69f` | 1280×720 |
| moroccan-chickpea-skillet | chosen-r2.jpg | `28b9518ab52a69cd89af51f6e17f63a915f937d0f83413b13a7a875ffc170296` | 1280×720 |

## Earlier generation that never synced

An earlier set (salmon `fe36cd71…`, pesto `0b3ef4ed…`, Moroccan `7a439cb0…`) was chosen and then regenerated because those files never became readable to the exporter. The attached prompts record that round and its rejects. The 2026-10-18 8:10 PM CT regeneration is what shipped:

- Salmon r1 (`84867b68…`): same prompt as the earlier c3. One lemon wedge, dill on the fish, unglazed asparagus, no grill marks. Author note: the glaze reads more seared than glossy.
- Pesto r1 (`f6a515be…`) rejected: pale specks could read as grated cheese. Shipped r2 (`8658a59c…`) adds "entirely green, no white specks, no salt crystals."
- Moroccan r1 (`6d16bbb5…`) rejected: preserved lemon rendered as large yellow cubes. Shipped r2 (`28b9518a…`) asks for thin slivers.

The rejected regeneration JPEGs were not attached.

## Exported files

| file | dims | bytes | sha256 |
|---|---|---|---|
| public/images/meals/maple-mustard-glazed-salmon.webp | 1200×900 | 207412 | `1081308097bb04a918b06fc57bd57262fd9c85a1c97954f2c771fd4cfb33ad4f` |
| public/images/meals/maple-mustard-glazed-salmon-640.webp | 640×480 | 79072 | `a8cb3984ca071074ff7e867d0719471ce394fad83582d978385e9801f2f42519` |
| public/images/meals/cashew-pesto-pasta.webp | 1200×900 | 236510 | `fbfa4b712bc4308d83cebfbd258bc9565f0ab155a4e40111dcd2534a0c67749d` |
| public/images/meals/cashew-pesto-pasta-640.webp | 640×480 | 86244 | `d5727b20bf247add3736dff038788afd90b7ec66c7097ceb149ed5f58af08d3c` |
| public/images/meals/moroccan-chickpea-skillet.webp | 1200×900 | 282164 | `0b4aca78927b035dd564e13c92579988514d88339ac22e3cdf1888eea48cfb52` |
| public/images/meals/moroccan-chickpea-skillet-640.webp | 640×480 | 109136 | `d882e7b6e61a9e686888c1f1acecc64e4eadcf021312c11aae83e1033b7ff490` |

The same hashes are on each v3 `image.file_hashes`. `image.qa_state` is `audit_fail` or `audit_pass` from the audit below.

## Independent audit

The auditor did not author these images. Each verdict is from the exported 1200×900 WebP, checked against its plating brief and the v3 ingredients. The 640 card is the same frame scaled down.

### maple-mustard-glazed-salmon — FAIL

The plate shows one salmon fillet, fresh dill on the fish, unglazed asparagus beside it, and one lemon wedge. No grill marks. The glaze is glossy in places and darker at the edges; it reads more seared than a smooth maple-Dijon coat. That would be a note.

The center crop does not keep the plate or the garnish whole. On the 1280×720 source the 4:3 window is x=160 to x=1120. That line passes through the asparagus tips, and the plate surface continues past it, so the exported WebP cuts off the spear tips and the right rim. Left, top, and bottom rims still have table around them. v3 plates the asparagus as a side, and the brief requires the spears inside the frame.

### cashew-pesto-pasta — PASS

Near-overhead wide bowl, fully inside the frame, with linen on every side. Ridged penne in a green pesto with an oil sheen, chopped golden cashews, halved cherry tomatoes, and three basil leaves. No white grated topping, no cream, no cheese pull. The cashews read as nuts. The basil leaves match v3 step 5 ("a few basil leaves"); they are not a sprig of an herb the cook did not use. Nothing on the bowl is clipped.

### moroccan-chickpea-skillet — PASS

Near-overhead low plate, rim fully inside the frame, linen visible around it. Couscous is a pale ring under the chickpeas. Whole chickpeas, wilted spinach, and chopped parsley on top. Preserved lemon shows as thin yellow slivers, not cubes and not fresh wedges. No feta, yogurt, olives, or a bare skillet. Nothing on the plate is clipped.
