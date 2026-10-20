# Tipping dump bed

Owner-authorized continuation of 165, 2026-10-20. Implemented and validated.
New appearance poses await human inspection.

The normal Construction dump truck now offers Tip bed / Lower bed to a nearby
unmounted operator or its cab driver while stopped. The tub rises to 48 degrees
in 3.2 seconds; its upper-hinged tailgate opens and both hydraulic rams extend.
Driving, loading and climbing require level equipment. Other people cannot
operate an occupied cab's controls. Pause, distance, storage and stopped guards
remain authoritative. External prop/ceiling or rider clearance blocks an angular
step atomically and allows it to resume after clearing.

Real balls and loose food retain identity as they drift downhill and fall out.
People stay upright independent players and can walk diagonally uphill or jump.
Inclined support height, grounded step-up/headroom, carry and downhill drift are
shared by authority and prediction. The narrower underframe avoids the former
false rear shelf; six fixed conservative tire clips preserve wheel collision.
Thirteen plain convex parts drive support/contact and debug. Posed query bounds
are separate from the unchanged road-admission box: sparse/crowded indexes and
visual grouping include diagonal floor extents and raised overhang. A native
chunk-seam regression first reproduced lost visual ownership; it now keeps both
the upright rider and real loose food supported. No new crate asset,
enclosed seat or general rigid-body engine is introduced.

Current angle and target save through SavedTraffic and nullable binary fields;
frame tag 0x07 rejects old endpoints. Mid-tip reload resumes the target and retains
rider/cargo pose. Food displacement/landing explicitly dirties durable records.
Normal unowned ball cleanup resumes after discharge, as elsewhere in the game.

## Retained source and presentation

V1 model, atlas, source and historical catalogs/receipts remain byte-identical.
The new [v2 bundle](../../art-source/vehicle-bake/dump-truck/v2/) retains all
3,720 triangles, six wheel rigs, rest vertices and UV ownership. The actual GLB
is 259,684 bytes, SHA256
`237be10a2c5e63b9e7b226d4d6e4acd84f623e703386a2b43b43f3e0baecc719`.
Normal builds consume committed assets, without Blender. The constructor refuses
an existing retained recipe; fresh staged-input-only replay reproduces exact GLB,
atlas and software-fallback geometry bytes. Packed Blender saves retain workspace
metadata, so exact blend-file byte replay is not claimed.

Shared CarMeshAsset applies absolute bed/gate/ram transforms per draw; the cached
resource cannot leak another truck's pose. V2 has eleven meshes and two embedded
copies of the same atlas/material, versus v1's seven meshes/one atlas. A 128px
render target radius fits sampled 0–48-degree poses through sixteen headings.

Canvas/disabled/pending/failed GLBs retain the cardinal sprite at level rest;
nonzero tilt uses a software depth raster of the same retained triangles, UVs and
atlas, with one-degree quantization and a bounded twelve-image cache. Upright
contents use the existing physical-ray fallback clip; this is approximate visual
occlusion, not exact mesh pixel parity. Other-world-prop whole-group ordering
retains tactical 162's limit. No mobile performance budget is claimed.

The existing shared game panel is also used by the real Worker playground.
Pause/step/reload and renderer replacement preserve authority. The playground
camera fits the fully raised tub. `geometry:truck-bed-v2` registers the current
interactive engine review with rig/runtime/source identity; it creates no human
art approval. Old immutable v1 review candidates stay unchanged.

## Validation

- Typecheck (all three targets), Biome check and production build pass. Biome
  retains 121 existing warnings/41 infos, with no errors.
- 30 affected native files / **773 tests pass**, including all 33 original
  families, generated-road journeys, authority, prediction, codec/hydration,
  all four discharge headings, mid-tip and discharged-food reload, diagonal
  incline walking/jump, obstruction/resume, drive lock and all six tire clips.
- Actual GLB qualification compares every rest vertex/UV pair against v1,
  verifies both hinges and ram endpoints, all six wheels, absolute reset and
  target extent across the tipping arc/heading set.
- Full native run: **6,498 pass, 5 fail, 10 skip** out of 6,513 cases. Remaining
  failures are the five existing Windows symlink/process-death cases; static-file
  symlink setup/cleanup also reports errors. No platform tests were weakened.
  Stale active dump-registration expectations now use v2. An isolated diagnostic
  proved the orca return queue's complete records unchanged with reversed
  enumeration order. Its assertion now sorts this key-addressed collection by
  persistent actor ID before exact equality; all 48 predator recipes pass.
  A final default-body-height compatibility correction passes 41 affected tests.
- Focused full Chromium boundary passes: actual Worker, normal cargo/bed
  controls, pause fence, mid-tip reload, GPU/Canvas/disabled meshes, forced GLB
  failure, actual discharge and lowering. A pause assertion initially sampled
  an in-flight tick; awaiting the existing clock fence fixes the test race.
- Node comparator passes. Catalog has 700 sheets / 1,394 source uses. Workshop
  verifies all 1,915 identities in normal retina Chromium.
- Normal game capture places the truck through Edit → Vehicles, loads real food,
  boards/walks independently, and exercises Tip/Lower by touch at 390px width.
- GPU-mesh streaming readiness passes with empty fixture failures. This measures
  ordinary world readiness, not a loaded tipping truck's mobile frame budget.
- Broad browser regression: **822 pass / 4 fail** across 826 cases. Two stale v1
  expectations were corrected; a pinch-menu timeout passes unchanged on rerun.
  Standalone review correctly rejected a manifest after source edits during the
  broad run. Regenerated inventories and a frozen final build pass all five
  focused cases (41.2s), including the tipping boundary and those four failures.
- Final source typechecks, lint, catalog/manifest and production build pass.
  Source hashes in the final capture match the files shipped here.

Local ignored review gallery: `data/3d-investigation/truck-bed-tipping-complete/index.html`.
It includes loaded tipping, physical debug, Canvas/GPU fallbacks, discharge,
lowering and normal desktop/phone game captures. Repeat with:

```
npx tsx scripts/instrumentation/truck-bed-playground.ts --tipping --game --output=data/3d-investigation/truck-bed-tipping-NEW
```

The [bed workflow](../vehicle-bed-prototype.md) and
[authoring pipeline](../vehicle-authoring-pipeline.md#articulated-equipment) own
reusable instructions. Next: crates/pallets and forklift loads, or explicitly
qualify another open-bed profile. Enclosed passenger seats remain separate work.
