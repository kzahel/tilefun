# Renderer unification

Topic: renderer-unification
Status: committed direction, 2026-11-14; slice 1 in progress (phases 1a and 1b of three delivered). The
fixed 2D view is the default top-down renderer and stays so until the
[retirement gate](#retirement-gate) is met.
Updated: 2026-11-14.

Owns the move to one world renderer: its status, parity checklist, device
scorecard and decision gates. [Rendering architecture](rendering-architecture.md)
still owns backend boundaries and resource lifetimes. The plan and its slices are
in [248](../tactical/248-renderer-unification.md).

## Decision

Owner, 2026-11-14: unify the renderers, accepting that it takes time. WebXR is
wanted as well, and a third renderer is not.

- The first-person 3D scene ([229](../tactical/229-first-person-view.md),
  [247](../tactical/247-first-person-shadows-and-walls.md)) becomes the one world
  renderer. Top-down, first person, chase, orbit and XR are cameras on it.
- Unification runs in that direction only. The first-person view is not merged
  into the fixed 2D backend.
- The fixed 2D view stays the default for top-down play until the unified one is
  good enough. Until then it is not deleted, not degraded and not left unmaintained.

## Why this direction

- A spike on 2026-11-14 put the fixed view's `x, y − z` projection on the
  first-person scene. Buildings, props, actors and vehicles landed where the fixed
  view draws them. On the M4 Pro its main-thread render time was equal to or below
  the fixed view's in eight of nine cells, with lower GPU time in eight of nine.
  Numbers and limits: [248](../tactical/248-renderer-unification.md#spike).
- The fixed view builds depth inside a 2D pipeline: painter-ordered quads with
  per-quad depth equations, an offscreen colour and depth image per vehicle, and
  a deferred shadow pass. A 3D scene gets these from its depth buffer.
- WebXR needs a scene drawn with a different view matrix per eye. The
  first-person scene can do that. The fixed view's screen-space quads cannot.

## Guardrails

- **Default.** Top-down play, labs, the explorer and probes draw through the
  fixed GPU backend until the retirement gate. New top-down features keep working
  there.
- **Review raster.** `ReviewRasterBackend` and fingerprinted review images are
  outside this work and stay.
- **No cost to the default.** A slice must not slow the fixed view. Check the
  affected `render:bench` cells when shared code changes.
- **One presentation evaluation.** Both renderers keep reading the shared
  collector, mesh poses and shadow shapes. Nothing here changes simulation,
  prediction or replication.
- **Opt-in until gated.** The unified top-down camera is a debug or Options
  choice. It becomes the default only by owner decision.
- **Device claims need device runs.** The Mac alone does not show that a change
  is safe on the phone, the Deck or the headset.
- **Labs.** Shared changes account for embedded labs
  ([embedded engine labs](embedded-engine-labs.md)).

## Target shape

```text
Worker authority / prediction (unchanged)
        ↓ read-only replicated and predicted state
shared presentation (collector, mesh poses, shadow shapes)
        ↓
one WebGL2 context: one page atlas, one set of vehicle assets
        ↓
one 3D scene (ground, props, cards, vehicles, shadows)
        ↓ cameras                         ↓ outputs
top-down (oblique) · eye · chase       page regions (split screen)
orbit · tabletop · XR head pose        stereo page · headset screen · immersive
```

A camera is a bundle of settings, not only a matrix. Top-down needs the oblique
projection, cards that do not turn, sprite rows chosen from the south, no fog,
the player's own body shown, residency from the visible rectangle and pixel
snapping.

## Slice tracker

One row per slice of [248](../tactical/248-renderer-unification.md). Update the
row when a slice starts, delivers or is blocked.

| Slice | State | Record |
| --- | --- | --- |
| 0 — Spike and plan | Done 2026-11-14 | [248](../tactical/248-renderer-unification.md) |
| 1 — One renderer host | In progress: 1a (one WebGL context) and 1b (shared vehicle assets) done 2026-11-14; 1c (view kind, mixed split screen) next | [249](../tactical/249-one-renderer-host.md) |
| 2 — Ground artwork, shared page atlas | Not started | — |
| 3 — Top-down camera, parity probe, draw calls, device scorecard | Not started | — |
| 4 — XR on the shared scene | Not started (needs slice 1) | [230](../tactical/230-3d-cameras-stereo-and-webxr.md) slices 5–8 |
| 5 — Top-down parity | Not started (needs slices 2 and 3) | checklist below |
| 6 — Opt-in, default, retirement | Not started (owner decisions) | gate below |

## Top-down parity checklist

What the unified top-down camera needs before it can replace the fixed view.
States: missing, partial, done. Add rows as differences are found.

| Item | State | Notes |
| --- | --- | --- |
| Framing and registration of props, actors and vehicles | Partial | Matches in the spike by eye; no pixel probe yet |
| Ground artwork (terrain pages, road markings, paths) | Missing | Flat colour per tile today; slice 2 |
| Grass blades | Missing | |
| Particles and contact effects | Missing | |
| Surface decals | Missing | |
| Sprite edges | Missing | 3D cards are hard cutouts (`alphaTest`); the fixed view blends filtered edges at fractional zoom |
| Pixel snapping and stable sampling at fractional zoom | Missing | Fixed-view rules from 213 and 215 |
| Body shadows | Partial | 3D has sun shadows and contact shadows; the fixed view has the deferred depth pass. Choose one look for top-down |
| Cutaways, slab fades, roof visibility | Missing | `SurfacePresentation` |
| Rooms shown roofless | Missing | First person draws rooms with full walls (230 slice 2) |
| Tow and bed groups posed together | Missing | 229 limit: members draw at their own poses |
| Emergency lights and flashing sprites | Missing | |
| Excavations (garage ramps below ground) | Missing | 229 limit |
| Editor overlays | Missing | The editor falls back to the fixed view |
| Picking, tap and hold destinations | Missing | Needs a ray against the 3D ground |
| Split-screen regions and diagonal masks | Missing | Slice 1 gives regions |
| Door overlays and realm transitions | Missing | |
| Labs, explorer and renderer probes | Missing | They pin the fixed backend's pixels |
| Context loss recovery | Done | 249 phase 1a |

Known disagreement to settle: in the `crowd` scene, cars parked north of the
shop row draw over the roofs in the fixed view and behind the buildings in the
3D scene.

## Device scorecard

`npm run render:bench` is the common measure
([236](../tactical/236-render-scorecard-and-gpu-shadows.md) owns commands and
limits). `--query=` selects the renderer under test.

| Device | Access | Fixed view baseline | Unified top-down |
| --- | --- | --- | --- |
| M4 Pro Mac, 120 Hz | local | [236](../tactical/236-render-scorecard-and-gpu-shadows.md), [248 spike](../benchmarks/248-oblique-camera-spike.json) | Spike only: [248](../tactical/248-renderer-unification.md#spike) |
| Pixel 7a, 60 Hz | adb, bench `--cdp` | 236 | Not measured |
| Steam Deck, 90 Hz | `npm run deck:*`, bench `--attach-page` | 236 | Not measured |
| Quest 3 | adb, Quest Browser | None | Not measured; XR frame pacing is slice 4 |

All four were reachable on 2026-11-14. Concrete device selection comes from
`~/code/machine-control` and private inventory at run time; none of it is
recorded here.

Open device question: the 3D scene makes 4 to 60 times more draw calls than the
fixed view (one mesh per chunk's ground and per chunk's props). The Mac does not
notice. The Deck's fixed view already spends up to 7.7 ms in submits, so the
phone and Deck must be measured before and after chunk meshes are merged.

## Retirement gate

Three owner decisions, in order. Each needs the evidence listed.

1. **Opt-in.** An Options choice for the unified top-down view. Needs ground
   artwork, registration within the probe's recorded tolerance, and no missed
   frames in `city` and `woods` on the Mac, the Pixel 7a and the Deck.
2. **Default.** The unified view becomes the default, with the fixed view still
   selectable. Needs every checklist row done or explicitly waived by the owner,
   scorecard cells no worse than the fixed view on all three devices at zooms 1,
   0.25 and 0.1, labs running on it, and an owner and child play review.
3. **Retirement.** The fixed GPU backend's world drawing is deleted. Needs a
   period as default without reported regressions, and probes and labs moved or
   retired. The review raster stays.

## Open questions

- Whether top-down in the unified view keeps its own shadow look or takes the
  sun shadows.
- Whether stereo and headset "flat" modes use the oblique camera or the orbit
  overhead preset (230). An oblique shear is exact on a page but is not a
  physically viewable camera in a headset.
- How much of the fixed view's CPU terrain rasteriser stays. The 3D ground needs
  the same pages either way.
- WebGPU is not part of this work
  ([renderer options](../research/sprite-to-3d-and-renderer-options.md#renderer-choices)).

## Next

Slice 1, phase 1c ([249](../tactical/249-one-renderer-host.md)): first person
as a per-seat view kind so split screen can mix views. Sharing the page atlas moved to slice 2, where ground artwork
needs the same atlas-sampling materials.
