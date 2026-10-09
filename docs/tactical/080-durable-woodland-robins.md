# Durable woodland robins

Owner: [wildlife](../topics/wildlife.md). Started 2026-10-09.
Status: complete; provisional gameplay delivered for owner playtest.

The owner authorized robins next, explicitly including tree perching. Reuse the
unchanged robin draft-v2 drawing-03/motion-02 (native 32px, anchor 16,25). Existing
idle, hop, flap and perched-song action cycles supply ground activity, physical
short flights, crown rests and calls. No pixels or art approvals change.

Sparse seeded individuals use eligible existing oaks with dry open ground beside
them, stable world/tree/member IDs and ordinary durable records. Oak and palm
crown surfaces are queried from actual resident props, so editor trees work too;
moving/deleting a tree removes its old perch. AI alternates bounded ground hops,
flights, rest and songs. Approach, landing and balls trigger a short escape and
recovery. Wildlife never automatically launches a player. Timelines, RNG and
mid-air pose survive saves/residency. No respawns or old-chunk backfill.

Shared authority, prediction, physical collision, actor persistence, editor and
Canvas/GPU lab consumers implement this slice. The native grove inspection
arrival validates routine/escape flight, actual crown support, tree edits,
closed habitat, no player bounce and durable deletion/manual creation.

Headless validation passes: 213 files / 1,795 tests, typechecks and lint (existing
118 warnings / 34 infos). Build passes with the existing chunk-size warning.
The crown test initially exposed a mistaken centered rectangle assumption; all
colliders use bottom anchors, so perch feet now sit inside the actual near edge.
A population distributed across many chunks exposed the residency harness's
limited save-drain turns; it now drains all bounded save batches, matching normal
per-tick reconciliation. Targets retain an 8px margin inside the home range for
ordinary separation. No player or train physics was altered to bypass checks.

All 18 focused wildlife browser checks pass in bundled full Chromium. Canvas/GPU
captures show elevated robins visible above crowns, and physical wings/ground
hops; pause/save-reload preserves physical phase. Ordinary balls startle a living
bird into a short flight, editor individuals persist and deletions stay gone.
Catalog: 219 sheets / 1,064 uses; manifest: 653 normal-Chromium-verified candidates.
All 27 exact wildlife candidate records are unchanged. Isolated streaming
readiness exits 0: cold, standing, walk, sprint, reverse and zoom-out finish with
zero missing/incomplete/stale caches, errors and failures. Functional Canvas
readiness evidence only, not a GPU frame-pacing claim.
[Slice streaming report](/tmp/tilefun-robin-streaming/report.json).
Full browser suite: **403/405 pass** (13.5 minutes). All 18 wildlife gameplay
checks pass, including the robin's main-game chirp. Both Canvas/GPU complete
city-train journeys pass (including saved-world reopening and alighting); the
previous intermittent train failure did not recur. The two previously recorded
wildlife-review failures still depend on absent archived fox pilot preview files.
They block review readiness/the expected changed-playback message; no historical
art was regenerated and the full suite is not claimed green.
[Full browser log](/tmp/tilefun-robin-browser-full.log).

Git diff --check passes. No new diagnostics (existing lint 118 warnings/34 infos).
Typechecks cover client, server and Worker. All required checks were run; no
unrelated test was changed to bypass a failure. Campaign-table refresh attempts
followed persisted implementation/validation/completion checkpoints, but ignored
progress.json is still absent, so preserve the last validated production table.
Gameplay completion is separate from art production or human approval.

Next: owner playtest of the grove, then consider the existing deer draft for a
larger woodland animal with grounded movement and small durable groups.

Inspection: [Robin grove](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-robins&landscape=thicket#/tool/world-geometry).
[Canvas perch](/tmp/tilefun-robin-perch-canvas.png),
[GPU perch](/tmp/tilefun-robin-perch-gpu.png),
[focused browser log](/tmp/tilefun-robin-browser-focused.log),
[unit log](/tmp/tilefun-robin-unit.log).

Art-table refresh remains unavailable without the ignored campaign state; no
production receipt or approval was fabricated.
