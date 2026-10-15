# Wave-15 selection rationale

1. **No duplicates.** Each candidate is a distinct dish from the 135 live meals and legacy-24. Where a live meal is close (e.g. egyptian-koshari against egyptian-ful-medames, grilled-mackerel-fennel-orange against korean-braised-mackerel-radish, korean-soft-tofu-stew against the Korean picks), the package's README says how they differ, and the guard verifies the referenced slug exists.
2. **Keep the HH001 share.** 20/50 HH001, so the household-safe share stays at about 38%. Fish and legumes carry most of it, and the 3 egg meals add variety. Every HH001 meal has nut policy none and contains no meat, poultry, shellfish or dairy.
3. **Breadth over clusters.** It adds 12 cuisine regions with no live meal and keeps the large clusters (American, Italian, Mexican) to 2–3 meals each.
4. **Fill the long-cook gap.** The live catalog is weighted toward 30–45-minute moderate meals. This wave adds braises, roasts and marinated grills (galbi-jjim, rouladen, carne adovada, Irish stew, bigos, char siu) that people ask for at weekends.
5. **Familiar anchors.** Crowd-pleasers (Cobb, Cuban sandwich, chicken cacciatore, smothered pork chops, turkey breast) sit next to the less familiar picks.
6. **Avoiding Wave-14 failure classes.** These were fixed by construction and checked with guards:
   - Timing: the sum of stated step minutes is ≤ clock + 2.
   - Pot and pan sizes are stated.
   - Every label-dependent item carries an allergen label contract ("whose label lists …").
   - Rennet: halloumi and raclette require microbial or vegetable rennet. The paneer is acid-set.
   - Barley, rye and spelt gluten: Irish stew (stout) and bigos (rye bread) declare a runtime enum gap plus a "Contains gluten" note.
   - Stale wording, revision labels and unit or plural doubling are each checked by a scan.
