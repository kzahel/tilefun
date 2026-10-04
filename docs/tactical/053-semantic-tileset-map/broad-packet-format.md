# Broad first-pass packets

The owner requested larger, roughly 90%-plausible review sheets on 2026-10-04.
That is a workflow preference, not a measured accuracy claim. Keep exact pixels
and source identity strict; use concise uncertainty for semantic hypotheses.
Investigate unusual boundaries/joins deeply only where needed. These packets
receive a visual overview and targeted audit, not the earlier exhaustive
candidate-by-candidate review. They remain Proposed and earn no approval.

## Compact JSON contract (version 1)

```json
{
  "schemaVersion": 1,
  "packetId": "B01",
  "familyId": "kitchens",
  "title": "Kitchens and appliances",
  "description": "Plain-language scope.",
  "sourcePins": [{"sheetId":"modern-interiors","path":"public/assets/tilesets/modern-interiors-atlas.png","sha256":"..."}],
  "sourceIndexPins": [{"path":"public/data/modern-interiors-atlas.json","sha256":"..."}],
  "scope": {"included": [], "excluded": [], "method": "Visual first pass; selected exact committed crops; no exhaustive absence search."},
  "facts": [{"label":"Use","value":"Complete objects and pieces to combine are distinguished."}],
  "groups": [{"id":"appliances","title":"Appliances"}],
  "records": [{
    "id":"B01-001", "label":"Refrigerator", "kind":"whole",
    "source": {"sheetId":"modern-interiors","rect":[0,0,32,48],"frameSize":[32,48],"offsetXY":[0,0],"pixelSha256":"...","packedKey":"exact index key","originalPath":"exact index sourcePath"},
    "topology":{"standalone":"allowed","requiredNeighbors":[],"limits":"Visual object proposal; game geometry unknown."},
    "uncertainty": null
  }],
  "cards": [{"id":"fridge-1","groupId":"appliances","label":"Refrigerator","kind":"whole","facts":[],"variants":[{"id":"original","label":"Original","recordId":"B01-001"}]}]
}
```

All rectangles are `[x,y,width,height]` in the committed sheet. `frameSize` and
`offsetXY` preserve native transparent padding using replacement-copy, never an
alpha mask. Pixel hashes use normalized RGBA (zero RGB only when alpha is zero).
Packed sources require their exact `packedKey` and `originalPath`; Exteriors
may use `originalPath`, `legacyTheme` and `legacyKey` when verified. Original
master correspondence is not inferred from packed presence. Each selected record
appears in exactly one card variant. Per-card `variantLabel` and `question` are
optional. Group genuine source variants where useful, but keep different forms
visible. No global variant control is required.

Kinds: `whole`, `component`, `unknown`. Topology standalone: `allowed`, `forbidden`,
`unknown`. For components, concise required-neighbor/underlay descriptions must
survive into the card facts; unknown joins never imply free placement. Do not
invent gameplay geometry or animation from neighboring frames. Avoid source IDs,
research acronyms and technical hash/provenance fields in the browsing UI.

Optional examples require prior agreement on a compact record-placement recipe;
source cards need not wait on unresolved assemblies. Packet Markdown should be
short: scope, visual observations, uncertain clusters, excluded exceptions and
reproduction. No new shared normalized-model adapter is required before first-pass
owner discussion; registry state remains proposal-ready until targeted review and
explicit normalization support stronger credit.
