# Original red coupe in gameplay

Status: implemented and validated after rebasing onto current traffic work, 2026-10-19.

The owner accepted the corrected coupe from 142 and explicitly requested editor
spawning, automatic road traffic, then commit/push with rebase if needed.

## Implementation

- Add an original-vehicle catalog beside the unchanged 45-type/180-view source
  bank. The shared vehicle registry combines both for definitions, dimensions,
  placement, replication, saves, traffic and roof support.
- Register `vehicle-v1:rosso-coupe` as **Red sports coupe** in Edit → Vehicles
  and the shared Traffic playground. The 2,299-triangle `rosso-coupe-authored-v3`
  uses the exact owner-reviewed GLB, one atlas, five draw meshes and independent
  wheel rigs. It uses native proportions, with no legacy height/lateral fit.
- Retain four matching cardinal sprite views for Canvas, disabled meshes, load
  latency and failed GLB loading. The sprites use actual frozen shared-game-camera
  captures, padded into the existing 192×224 frame contract at ground origin
  (96,144). No source-bank pixels or metadata are changed.
- Physical bounds conservatively enclose the measured GLB: length 82, width 36,
  height 19 world pixels; direction swaps length/width. Standard road-width
  admission requires 84px lanes and ordinary next-lane clearance. The automatic
  selector treats it as a normal eligible car; it is not guaranteed at each spawn.
- Use existing sporty handling: speed 156px/s, acceleration 300px/s², ordinary
  fast/reverse/braking/pushing. Steering remains visually neutral, as for other
  authored road models.

`python scripts/vehicle-bake/export-runtime.py` explicitly packages the retained
model/cardinal captures and writes the original catalog and provenance receipt.
Normal builds use committed outputs. Drafts, caches and replay runs remain ignored.

## Evidence

Focused unit coverage checks exact model/fallback pixels,
editor placement, driving/reload, generated-road automatic selection and all-model
turns/roof support. Browser checks exercise actual GPU loading and failed-mesh
fallback through the shared lab, plus mobile placement/driving/save/delete in
Canvas and GPU. All 174 focused unit tests pass, including ordinary generated-road
selection and all-model turns/roof support. The six browser scenarios pass across
the successful mobile/game run and the corrected two-test GPU/fallback rerun.
Typecheck, lint, production build and streaming readiness pass. All model bytes
match the owner-reviewed source; the 180 existing source-bank review identities
remain unchanged.

The full unit run reports 4,367 passes, five known Windows symlink/process-signal
failures, ten skips and one Workshop API timeout. The complete 13-test Workshop
service file passes in isolation. The broad browser attempt stops at five aquatic
hunter initial-fish-population assertions (6 expected/5 observed or 3/2), outside
the vehicle integration; five tests passed before that limit. Broader traffic,
GPU and roadkill checks run after rebasing onto the concurrent remote traffic work.

After the first rebase onto roadkill, all 240 focused unit checks and all 43
GPU/traffic/driving/placement/roadkill browser tests passed. The subsequent
rolling-steering update was also rebased and preserved. Its turning-radius table
uses the combined retained views, giving the coupe a 57.4px radius rather than an
unknown-type default. All 219 affected traffic/prediction/presentation/placement
unit tests then passed, as did ten final full-Chromium browser cases: compact and
coupe forward/reverse rolling turns and stopped heading in Canvas/GPU; own-mesh
and failed-mesh lab behavior; ambulance/coupe mobile placement, driving,
save/reload and deletion in Canvas/GPU. Typecheck, lint, rebuilt catalogs and
production build pass; post-rebase streaming readiness passes. Runtime export
replay preserves the reviewed GLB and exact fallback pixels, and keeps other
original catalog entries intact. Drafts and validation logs remain ignored.
