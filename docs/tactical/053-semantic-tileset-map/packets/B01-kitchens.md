# B01 — Kitchens and appliances

Broad first-pass proposal: **166 cards / 408 normal source drawings**, grouped
by finishes and alternate drawings. This covers every normal named Kitchen
export in the existing committed Interiors atlas. It is a plausible visual map,
not a measured accuracy claim or human approval. Previous sheets are unchanged.

The sheet includes counter/table surfaces, cabinet fronts and cupboards, shelves,
sinks, ranges, refrigerators, small appliances, food preparation, chairs, wooden
tables, tablecloths, rugs, drinks, pictures, cookware and meals. All selected
native frames and their transparent padding survive unchanged. Indexed original
export paths remain separate from committed packed coordinates; packed presence
does not establish original-master correspondence.

**242 drawings are components.** Cut counter/cabinet/table/rug forms require
matching pieces. Sinks require a supporting counter/cabinet; cloth covers need a
table underlay. Matching sections and most joins remain unresolved. Complete
small props do not gain artificial assembly requirements simply because they
normally sit on furniture. Two finite examples reproduce the existing complete
32×32 mustard and blue patterned rugs exactly from four corners. They establish
those examples only, not arbitrary rug size or repetition.

Uncertainty stays visible on table versus counter surfaces, glass-topped table
versus low display cupboard, cabinet/appliance functions, a few drink/lighting
fixtures, compact chair front/back naming and specific small foods. Finish names
are visual descriptions, not material claims. Depicted oven/fridge states do
not establish animation, appliance behavior, collision or game placement rules.

Excluded: shadow variants, other themes, loose/unindexed art at the bottom of the
native theme sheet and exhaustive master/origin/alias searches. No broad absence
or whole-pack semantic-completeness claim is made.

Reproduce exact selected-source checks and representative captures with:

```sh
python3 scripts/semantic-map-broad-kitchens.py --check --capture-dir /tmp/tilefun-B01-kitchens
```

The helper checks committed source/index pins, every packed alias and normalized
RGBA hash, 408 available original-export crops, one-card membership, component
facts and both finite recipes. It can replay committed checks without originals.
Visual inspection covered all six numbered export pages, the native theme
context and four representative card pages. Root's targeted audit prompted the
sink/cloth underlay corrections; remaining labels stay first-pass proposals.
