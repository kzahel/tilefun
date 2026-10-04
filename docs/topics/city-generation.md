# City generation and promotion

Topic: city-generation
Status: one evolving regional generator; same-seed recreation for retired saves.
Updated: 2026-10-04.

## Current generation policy

The user approved dropping historical playable generator compatibility during active
development. `CURRENT_REGIONAL_VERSION` in `GenerationDescriptor.ts` is the single
regional creation/runtime version, currently **regional-v13**. It composes connected dense neighborhoods, gentle road
traffic and the [first generated two-town railway](trains.md).
It does not automatically promote the v7–v10 review candidates. Classic, Island and
Flat remain distinct simple presets, not historical regional revisions.

Build new features by composing the current planners, terrain, placements and actors.
When output changes, bump the current version and update the current behavior tests.
Keep deterministic replay, query-order independence, seam/geometry checks and stable
IDs *within that version*. Do not retain runtime branches or old world-output hashes
to reproduce retired versions. The version in a save detects incompatibility; it is
not a promise that the old algorithm remains available.

Old worlds remain listed with a compatibility reason. **Recreate with same seed**
creates a new save ID using the current generator; it copies no edits, characters,
interiors or player positions. The original stays available for explicit deletion.
The server rejects entering incompatible worlds and skips them during automatic
resume. Both browser and dedicated-server paths use the shared compatibility policy.
The same seed identifies the input, not an identical landscape across revisions.

See [Tactical 035](../tactical/035-current-world-generation.md) for implementation
and validation; [world explorer](../world-explorer.md) for navigation and handoff.

## Exact review scenes and asset banks

Review approval remains tied to exact candidate identities. The twenty existing city
views (3 dense, 4 commercial, 3 parking, 4 parks, 3 architecture, 3 pedestrians) are
finite snapshots in `src/art/city-review-snapshots-v1.json`: plans, props, initial actor
poses and bounded terrain with a neighbor halo. `CityReviewArchive.ts` reads them
without invoking historical generators. The old descriptors are provenance labels.
The lab uses the normal renderer; the explorer can inspect the archived area, but
its handoff explicitly creates a **current world with this seed**, without carrying
an archived arrival. Outside the finite area, it asks for Current regional.
The coarse geographic background uses current geography, not a historical emulator.

Never regenerate these snapshots during builds or silently replace their pixels.
New review output needs a new candidate identity and human review. Commercial and
city-place composition experiments live in `src/art/studies/`; their geometry tests
support future authoring, without preserving historical saved-world output.

The promoted `dense-city-assets-v1.json` and `commercial-city-assets-v1.json` banks
remain immutable, with bank hash checks. The architecture bank is a candidate bank,
not an approval promotion. Builds consume committed assets. Candidate approval,
asset promotion and inclusion in the current generator are separate decisions.

## Recorded review checkpoints

- Street starter: six furniture scenes, `run=streets`; road foundations: nine approved
  source-backed scenes, `run=surfaces`. The divider is reviewed art for future use.
- Road geometry: four approved scenes, `run=road-geometry`; their commercial surface
  bank pins source cells and road IDs. Commercial streets: four approved scenes,
  `run=commercial`, originally regional-v6 seed 2026 near tile 300,519.
- Dense neighborhood: three approved views, `run=districts`, originally regional-v5
  seed 2026 near tile 300,519. Door thresholds, including secondary entrances, connect
  to the sidewalk. [Tactical 007](../tactical/007-dense-city-districts-and-street-life-plan.md)
  records the checkpoint.
- Thirteen city-place views await recorded human review: parking (v7), parks (v8),
  varied architecture (v9), people and destinations (v10). Preview people are initial
  poses; historical prompts about live movement are provenance, not a promise of
  playable old revisions. [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
  preserves their delivery history. Consult the live Workshop inbox for later decisions.

## Next work

[Generated railways](trains.md) have isolated previews, not overworld integration.
The next authorized railway slice would reserve stations, corridors, structure
approaches and street/walking access together, then implement a two-town local
service in the current generator with a version bump. No railway integration is
part of the generation-policy cleanup.

Continue reviewing the thirteen city-place views before promotion. Later city work
includes farmers markets, connected parks, frontage variety and richer schedules.
Performance evidence lives under [performance](performance.md); feedback rules live
under [art review](art-review.md).
