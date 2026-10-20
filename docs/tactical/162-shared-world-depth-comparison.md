# Shared world depth with actual vehicle bodies

Date: 2026-10-20. Status: bounded comparison complete; production integration open.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[vehicles](../topics/vehicles.md), [embedded labs](../topics/embedded-engine-labs.md).
Continues [160](160-live-3d-and-shared-depth-investigation.md).

## Result

The owner's observation holds in ordinary poses: local group depth and shared
world depth match in five of six cases, including two vehicles whose silhouettes
overlap. The wall-corner case exposes a genuine whole-object ordering limit:
seven native visibility pixels differ; even the best of all 720 group orders
leaves three wrong. The person must appear in front of the side wall at seven
pixels and behind it at three. Reordering entire bodies cannot satisfy both.

This is a small, deliberately positioned boundary case, not evidence that the
current renderer generally fails. The unchanged player artwork extends beyond
its physical collider; the wall crosses that artwork while the physical bodies
remain separate. Shared depth resolves this **upright sprite plane**, not the
anatomical depth a fully 3D person would have.

| Pose | Different native pixels | Best whole-group error | Ray checks |
| --- | ---: | ---: | ---: |
| Person between vehicles | 0 | 0 | 311 |
| Person behind dump truck | 0 | 0 | 378 |
| Actual held jump behind dump truck | 0 | 0 | 177 |
| Person at wall corner | 7 | 3 | 296 |
| Actual held jump above wall corner | 0 | 0 | 177 |
| Person in front of wall | 0 | 0 | 178 |

Both vehicle silhouettes overlap at 177 pixels in every case. An independent
geometry ray/alpha oracle agrees with shared GPU visibility on all 1,517 tested
overlap pixels across the six poses: zero mismatches and zero ambiguous ties.
These counts are evidence for this fixed camera and placement, not a population
performance or universal visibility claim.

## Executed slice

- `shared-world-depth-fixture.ts` uses normal `ScenarioSession` authority,
  `TrafficSystem.place`, held jump input, binary snapshot decode,
  `RemoteStateView` and `collectScene`. It asserts normal vehicle placement,
  replicated sources and disjoint outside-player/body footprints. It does not
  host a Worker or use the game's `RenderHost`.
- `shared-world-depth-entry.mjs` uses the normal vehicle catalog, actual batched
  `CarMeshAsset` factory and fixed projection with unchanged dump-truck/pickup
  GLBs. Original Explorer and cat sprite frames become alpha-tested planes.
  Two independent low wall boxes use their replicated collider geometry. Walls
  are separate scene groups, so the result does not rely on grouping an entire
  corner into a single object.
- Local mode resets depth per group and composites complete groups in the
  actual collector order. World mode renders the same objects into one depth
  target. Both receive the same end-of-scene outline for viewing. Visibility is
  compared before outlines; this is not production per-vehicle outline parity.
  Isolated targets cover the full native viewport rather than reproducing the
  production body's crop/cache placement. The comparison isolates group depth;
  it is not an exact screenshot comparison against the shipping renderer.
- `shared-world-depth.mjs` captures six GPU poses using owned full Playwright
  Chromium, then evaluates all 720 whole-group permutations in Node from solo
  object masks. The masks must reproduce the GPU's original grouped ordering.
  Both GLBs' material alpha modes are verified opaque. The ray oracle separately
  checks nearest geometry intersections and the original sprites' alpha texels.
- The self-contained local gallery includes enlarged player close-ups, pose
  selection and physical-body/wall/sprite-plane overlays. Debug geometry is
  excluded from visibility measurements. Original models, source sprites and
  production rendering remain unchanged.

No depth-writing terrain is present; the background is a flat color. Contact
shadows, transparency beyond sprite cutouts, a moving/hinged bed, live character
animation, interpolated Worker state, streaming, picking, recovery and device
budgets remain untested. The existing dump-truck bed is not separately hinged in
its compiled model. No cargo or passenger gameplay is implemented by this slice.

## Evidence and replay

Retained portable results and tool/asset hashes:
[comparison.json](../research/shared-world-depth-162/comparison.json).
All fixture snapshots, bundles, PNGs, galleries and local browser configuration
remain ignored under `data/`; no generated production assets are introduced.

```sh
npx tsx scripts/instrumentation/shared-world-depth-fixture.ts
node scripts/instrumentation/shared-world-depth.mjs
node scripts/instrumentation/shared-world-depth.mjs --output=data/3d-investigation/shared-world-replay
```

Open `data/3d-investigation/shared-world/index.html`. Fresh Chromium replays using
both the same and regenerated authority snapshots reproduce the report exactly.
The disposable entity identities in the fixture need not be byte-identical.
Normal builds do not run this experiment.

## Validation

Typechecks and production build pass. All three new scripts pass Biome. The
browser-free node integration case and existing mesh rotation/composition/atomic
fallback browser case pass. The latter used a separate owned port and auth/data
directories because the normal test port was occupied; no existing server was
reused or stopped.

Final broad checkpoint on this shared working tree:

- Bounded full Windows Vitest run: 6,414 passed, six failed and ten skipped
  across 350 files, 628.34s. The five known Windows symlink/process-death failures
  remain in FsSecurity, privateDataPlugin and SqliteRecordStore; staticFiles has
  its symlink setup/dependent cleanup hook failures. An additional unchanged
  orca reload test fails on its respawn-state equality assertion and reproduces
  alone (47 other cases skipped). This diagnostic slice changes no simulation
  source or unit tests.
- Repository Biome: one unrelated formatting error in tactical 161's
  `validation.json`, 121 warnings and 38 informational diagnostics. That
  concurrently owned report was left untouched. All three new tools and the
  retained comparison report pass the focused check without diagnostics.
- All three typechecks, production build, the browser-free integration case and
  existing mesh GPU regression pass. Production recipe/render inputs are
  unchanged, so no asset inventory or Workshop manifest regeneration is needed.
- Fresh authority/Chromium replays match; all retained tool/model/sprite hashes
  match. Scratch files are Git-ignored. Owned comparison browsers/servers and
  the alternate regression server were reaped; the pre-existing server remained
  untouched. Scoped Git whitespace checks pass.

## Next

Follow-up [164](164-playable-truck-bed.md) implements the bounded truck-owned
occupant proof through the real Worker and shared rendering host. It preserves
the broader cross-group limits established here.

Keep local group depth as a credible route for an actor owned by one truck.
Prototype the same read-only mesh/billboard submissions behind the shared
presentation host to test actual game/lab camera, outline and lifecycle behavior.
Use this wall case as the cross-group acceptance fixture. Before choosing broader
world depth, compare moving vehicles, terrain/props, cutouts, fallback behavior
and device pacing. Seat ownership, bed support and tipping remain separate shared
simulation work; visual geometry never silently replaces physical colliders.
