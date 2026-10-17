# Synthetic list — text, image, and the S-05B reference

The 16-line list is `test-list.txt`. The runtime formatter and the canvas painter produced `synthetic-app.txt` and `synthetic-app.png` from those same items, with categories set explicitly so heuristics would not mis-file ramps or paprika.

`test-list.png`, the S-05B reference image named in the unit brief, was not present on disk in this workspace (the upload path did not resolve). The comparison below uses the reference image that was attached to the request: a white card titled “Shopping list,” uppercase group labels, hairline rules, two columns, and Unicode fractions.

## Clipboard text

`synthetic-app.txt` is the exact `format=app` payload:

```
3 bananas
1/2 cup cilantro
1 bunch flat-leaf parsley
4 oz fresh ramps
2 limes
2 lb yellow onions
1 1/2 lb Yukon Gold potatoes
1 dozen large eggs
1 carton oat milk (64 fl oz)
1 1/4 lb boneless chicken thighs
2 cans black beans (15 oz each)
1/8 tsp kosher salt
1 jar Rao's marinara sauce (24 oz)
2/3 cup rolled oats
1 tbsp smoked paprika
1 pack paper towels
```

Against `test-list.txt`:

- Same 16 items, same quantities, same package notes (`64 fl oz`, `15 oz each`, `24 oz`).
- No category headings. The reference text has Produce, Meat & seafood, Dairy & eggs, Pantry, and Household.
- ASCII fractions in the clipboard (`1/2`, `1 1/2`, `1 1/4`, `2/3`, `1/8`). The reference text uses the same ASCII forms.
- Order follows category, then name. Dairy (eggs, oat milk) comes before meat. The reference lists meat before dairy, and it lists onions before bananas.

## Image

`synthetic-app.png` is one 1080-wide canvas at device-pixel ratio 2.

- White background, title “Shopping list,” quantities in bold, names in regular weight, ink `#17393A`.
- Unicode fractions render: ½, 1 ½, 1 ¼, ⅔, ⅛. Rao's apostrophe is intact.
- No group headings and no hairline rules. The reference image has both.
- “Rao's marinara sauce (24 oz)” wraps, with “oz)” on the second line. The reference kept that line on one row. Nothing is clipped.
- The FlavorWeave word sits at the bottom right, outside the item rows.
- One image. The list does not exceed the page cap.

Sheet screenshots at 375, 390, 414, and desktop are in `screens/`.
