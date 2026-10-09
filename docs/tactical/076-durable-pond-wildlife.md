# Durable pond wildlife: provisional mallard slice

Status: complete, 2026-10-09; live dev-server arrival verified, owner playtest pending.
Owner: [Wildlife](../topics/wildlife.md).

## Owner direction

Use existing imperfect wildlife art provisionally. Build a deep first slice with
varied animations, appropriate habitat and baseline AI. Seed an initial population
once, persist individual animals and rely on manual creation rather than timed
respawns. Wildlife art quality holds remain separate; no new animal art is produced.

## Implementation

- Mallard drawing-02 stays byte-for-byte unchanged. Native 48px cells, ground anchor
  (24,34), four facing rows and 160ms frames supply idle/waddle/swim/flap/quack.
  The flap is a stationary wing exercise; flight is outside this slice.
- Natural ponds keep an open bank ring against oak canopies and thicket rows.
  A deterministic two-to-four-member flock belongs to each admitted pond, with
  stable seed/pond/member IDs and a single initial owner chunk per animal.
- Ducks rest, alternate local travel with quacks/wing exercises, choose reachable
  land/water destinations, steer apart and briefly retreat from close players.
  Solid terrain and actual prop footprints remain authoritative. No global pathfinder.
- Amphibious movement crosses ordinary banks/water. Small ducks do not block players.
  Dry-land manual ducks roam locally without requiring a generated pond.
- Ordinary RealmRecords persist home, target, timer, activity and per-animal RNG,
  as well as position/velocity. Original feature records prevent regeneration when
  an animal moves away; deletion tombstones prevent replacement. Existing residency
  freezes/evicts/restores them, with no distant-time catch-up or population timer.
- Shared SpriteDef clips and an optional binary clip byte support stationary and
  moving cycles on server/client. Existing legacy animations keep their behavior.
  Frame phase is local/transient, restarting on re-entry or clip changes; semantic
  behavior state is durable. Hosts and clients must deploy together for the expanded
  sorted entity registry and optional sprite wire field.
- Entities palette permits ordinary manual placement. The existing generated pond
  lab exercises the same Worker runtime on Canvas/GPU; no separate animal viewer.
  Previously seeded saved chunks are not backfilled: place ducks manually there,
  or visit an unseeded pond. This preserves existing population decisions.

## Validation and evidence

Typecheck, lint, build and all 1,751 unit tests across 209 files pass. Focused checks
cover source hash/clip bounds, deterministic query order and bank clearance, binary
clip baseline/delta playback, real Realm land/water behavior, persisted
deletion/manual creation and actual residency eviction/re-entry without duplicates.

The three new bundled-Chromium browser tests pass: shared pond behavior on Canvas
and GPU, Worker pause/save/reload, and ordinary seeded-world placement, deletion and
restart. Native screenshots were inspected for swimming, bank placement and scale:
[main game](/tmp/tilefun-mallard-game.png),
[Canvas pond](/tmp/tilefun-mallard-pond-canvas.png),
[GPU pond](/tmp/tilefun-mallard-pond-gpu.png).

The full Playwright run passed 387/390 tests. Two existing wildlife review checks
fail because archived fox pilot-v1 `preview.gif` is absent (including the check
that intended to reach playback-hash validation). A generated-city GPU train
alighting check failed once at a bend; its isolated rerun passed without changes.
Keep these limitations explicit rather than reporting a wholly passing suite.
Logs and failure artifacts are retained under
[/tmp/tilefun-duck-validation](/tmp/tilefun-duck-validation), with the isolated
[train rerun](/tmp/tilefun-duck-train-rerun.log).

`streaming:bench -- --assert-ready` passes; the
[report](/tmp/tilefun-duck-streaming/report.json) is readiness evidence, not an
isolated performance comparison (the final unit run overlapped this benchmark).
Art catalog and Workshop manifest regenerate successfully. All 27 wildlife
candidate records remain identical to HEAD; provisional gameplay has not changed
their pixels, art fingerprints or human approval state. Shared landscape/lab
fingerprints update normally. No deployment or commit was performed.

Follow-up: the live site serves this checkout through Vite. A clean bundled
Chromium context verified ordinary-game `generation` + `arrival` links at seed
2026, tile (227,-183), with `renderer=canvas`: the pre-filled **New World** button
creates a browser-saved world, the player arrives at (3632,-2928), and two ducks
are visible by the bank with no page errors. The launch still requires that button;
there is no automatic fresh-world or memory-only URL mode. The existing memory
playground is separate. [Live arrival capture](/tmp/tilefun-live-duck-arrival.png).

The art status refresh command cannot run because the ignored production
`data/wildlife-campaign-v2/progress.json` is absent. No art receipts/table or human
approval events were fabricated; the last production snapshot is retained.

## Next

Playtest density, motion and shore behavior in ordinary worlds. Then apply the
shared clip/habitat/persistence pattern to another existing animal without requiring
an art production campaign.
