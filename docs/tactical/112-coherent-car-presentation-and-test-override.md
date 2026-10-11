# Coherent car presentation and test override

Date: 2026-10-11. Owner: [rendering architecture](../topics/rendering-architecture.md),
[3D assets](../topics/3d-assets.md), [embedded labs](../topics/embedded-engine-labs.md).

## Trigger and scope

Diagonal down/right motion was physically 45°, but 109's heading-dependent body
lens displayed 38.2°. Cosmetic yaw easing lagged movement; cardinal sprite facing
then turned a stopped diagonal car to 90°. Replace those presentation rules and
provide an opt-in all-road-vehicle blue appearance for easier gameplay testing.
Simulation, controls, physics, authored source bytes and actor identity stay intact.

## Implementation

- Fixed mesh `x, y-z` projection matches `projectWorld` after local pose rotation,
  including pitch/roll, elevated anchors and zoom. No heading-dependent lens.
- Static game-local lateral asset registration of 1.3× before yaw widens the
  narrow front view without changing forward length, 24-pixel roof height,
  tire radius/circular rolling geometry or ground contact. Source GLB unchanged.
  Directional sprites use different cameras, so exact height matching at every
  heading is incompatible with this coherent world projection.
- View-owned ID poses follow valid displayed motion immediately and retain their
  heading at rest. Teleport/visibility gaps fence travel; moving initial/rebound
  poses use velocity. Signed wheel travel remains distance-driven. Fresh loading
  of a stationary actor still starts from its persisted cardinal facing.
- `?renderer=gpu&meshes&allcars3d` selects the retained blue mesh for every
  `vehicle-v1:` road vehicle in game/Traffic; trains/other actors are excluded.
  Original types, colliders, roof support, sprites and saved data are unchanged.
  Buses/vans keep their original physical footprint despite compact appearance.
  Sprite fallback is atomic. The URL flag survives renderer switches and resets.

## Validation

Typecheck passes (client/server/Worker). All 2,417 unit tests in 248 files pass.
Lint passes with the existing 118 warnings/34 infos; the build passes. Catalog
generation retains 245 sheets/1,086 uses, with one updated consumer line reference.
All 761 Workshop candidate identities verify in normal Chromium at retina scale.
The manifest refresh includes 170 interactive geometry/character identities
because they hash the shared presentation host source; this does not change
authored asset pixels or record human approval.

All 27 focused full-Chromium renderer/driving checks pass. The full browser run
passes 546 checks with one opt-in source-atlas capture skipped in 22.4 minutes. Tests cover projected vertices and screen heading, asset axes,
rest hold, ID-cache reuse/eviction, original actor/fallback preservation, Traffic
reset, and real driving of both compact-1 and another vehicle under the override.

Fixed-camera blue-paint bounds at 3× native enlargement (same measurement as 109):

| Heading | Sprite W × H | Model W × H |
| --- | --- | --- |
| Right/left | 183 × 105 | 168 × 126 |
| Down | 90 × 168 | 84 × 180 |
| Up | 90 × 165 | 84 × 168 |

Width is within 12% across tested headings/zooms. Model side height is 20% above
the sprite; this is an explicit silhouette difference, not an exact sprite match.
Any future fitting should change the asset registration/geometry rather than
rotate the body camera away from world motion. The 24-pixel roof registration
remains consistent with compact-1 support height.
[Diagonal comparison](/tmp/tilefun-112-diagonal-comparison.png).

[Actual game override capture](/tmp/tilefun-112-world-override.png): a non-blue
road vehicle renders the blue body while retaining its original type.

The isolated regression run covers this slice without concurrent renderer-default/XR
changes in the shared checkout. Those changes are not included in this commit.
A separate fresh-context full-Chromium live smoke also passes at the human review
origin: compact-1, bus-1, bus-2 and car-21 keep their original types, all select the
blue asset, and visible bodies draw with zero page errors.
[Live override capture](/tmp/tilefun-112-live-override.png).

## Next work

Owner playtest diagonal turns and stop/restart in the world. Wheel steering and
physical continuous yaw/rotated collision remain separate steps; no performance
claim follows from this visual override.
