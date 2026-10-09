# Durable meadow rabbits

Owner: [wildlife](../topics/wildlife.md). Started 2026-10-09.
Status: complete; provisional gameplay delivered for owner playtest.

## Authorized slice

The owner accepted rabbits after ducks/frogs: reuse the existing rabbit pilot for
idle, native hops and quiet action cycles; populate meadow/woodland edges with
seeded durable small groups, suitable habitat, player/ball reactions and manual
creation. No art production, changed pixels or approval is part of this work.

## Shared behavior and habitat

Rabbit registration, shared authority/prediction contact, ball reactions, saved
behavior/physical hop phase and manual editor creation are implemented. A bounded
64-tile owner lattice admits dry grassy glades facing denser woodland; it leaves
forest collision bands intact and reserves scattered-tree clearance. Initial groups
contain 2–3 rabbits with seed/glade/member identities and independent RNG.
The normal generator and memory-backed lab share these populations and behavior.
The new rabbit arrival is seed 2026 at -151,-529 tiles, beside glade:-3:-9.

Native 32px cells and unchanged clips supply gather/push, a 10px physical hop arc,
fore-first landing and recovery. Hops reject water, solid paths, occupied landings
and abrupt height changes. Escapes must gain distance from a threat and prefer
accessible woodland-facing cover. A mid-hop alarm finishes that hop before one
escape, followed by recovery; repeated hits never restart it. Closed habitat
recovers in place. Durable ordinary records freeze outside active residency; no
catch-up, respawns or backfills of previously seeded chunks. Manual animals and
deletions remain saved. The lab adds Hop onto rabbit and phase diagnostics.

Initial focused checks found and corrected a closed-habitat alarm retry loop.
Typechecks, lint (existing 118 warnings/34 infos), build and all 1,784 unit tests
pass. Four new rabbit browser checks plus ten frog/duck checks pass in bundled
full Chromium: Canvas/GPU physical hop and pause/reload pose, landing bounce,
ordinary ball escape and editor creation/deletion across world reopening.
Captures show rabbits above their shadows with open ground and trees at the glade
edge. Catalog: 218 sheets/1,063 source uses. Manifest: 649 verified candidates,
including four rabbit geometry/profile scenes; all 27 exact wildlife review records
are unchanged.

Full browser suite: **398/401 pass** (12.6 minutes). All 14 wildlife
checks pass.
Two existing wildlife-review failures depend on absent archived fox preview
artifacts. A GPU city-train test lost the player roof height after reopening;
its isolated rerun passes the complete journey, mid-bend reopening and alighting
(1.5 minutes). Both results are retained; the full suite is not claimed green.
No train test or roof behavior was changed to bypass this failure.

Isolated streaming:bench -- --assert-ready exits 0. Cold, standing, walk, sprint,
reverse and zoom-out finish with final missing/incomplete/stale counts all zero.
This is functional Canvas/headless readiness evidence, not a GPU performance claim.
Git diff --check passes. No art pixels, approvals or historical snapshots changed.
The art-table helper cannot regenerate
without ignored data/wildlife-campaign-v2/progress.json; preserve the last validated
art table rather than invent production receipts.

Inspection: [Rabbit meadow](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-rabbits&landscape=thicket#/tool/world-geometry).
Use **Hop onto rabbit**, Pause and Save / reload scene. Older saved chunks can use
**Edit → Entities → Rabbit**; new countryside seeds groups once.

Local evidence (not committed): [unit log](/tmp/tilefun-rabbit-unit-full.log),
[focused browser log](/tmp/tilefun-rabbit-browser-focused.log),
[full browser log](/tmp/tilefun-rabbit-browser-full.log),
[train rerun log](/tmp/tilefun-rabbit-train-rerun.log),
[streaming report](/tmp/tilefun-rabbit-streaming/report.json),
[Canvas meadow](/tmp/tilefun-rabbit-meadow-canvas.png),
[GPU meadow](/tmp/tilefun-rabbit-meadow-gpu.png),
[ordinary saved world](/tmp/tilefun-rabbits-game.png).

Art status refresh attempts followed persisted checkpoints and completion. The
ignored campaign state is still absent, so the last validated production table
remains untouched. Gameplay completion is distinct from production art receipts.

Next: owner playtest of meadow rabbits, then robins for short flights, perching and
ground foraging using the existing draft. Track the non-reproduced GPU train
roof-reopen failure in the owning train work if it recurs.
