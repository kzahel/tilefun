# Durable pond frogs

Owner: [wildlife](../topics/wildlife.md). Started 2026-10-09.
Status: complete; provisional gameplay delivered for owner playtest.

## Authorized slice

The owner selected frogs after mallards, and requested proceeding with the existing
art: real hops, swimming, bank rests/blinks, occasional croaks, player/ball reactions,
seeded durable populations and manual creation. No new animal art or approval is
part of this slice. The unchanged frog drawing-02 sheet supplies idle (1 frame),
hop (8), swim (8) and blink/action (6), all at its native 48px cell size.

## Shared behavior and habitats

NaturalLandscape seeds 2–4 candidates per admitted pond on a separate grassy outer
bank arc; crowded candidates rotate around the open ring to avoid other animals.
Stable world/pond/member IDs,
independent per-animal RNG and chunk ownership make queries order-independent.
The existing open pond-bank reservation excludes tree/forest footprints and gives
frogs accessible shallow water and clear landing spaces. New chunks receive frogs
once; existing seeded saved chunks are not backfilled. Edit → Entities → Common
frog creates saved individuals. Distant animals freeze; deletion remains a tombstone,
with no timed replacement or elapsed-time catch-up.

Realm owns short bounded moves, rests and blink cycles. Dry movement uses a 1.12s
physical hop: two crouch/push frames, a short 8px arc and fore-first landing/recovery.
Water movement uses kick/glide swimming, with a hop when leaving the water. Local
path samples reject solids, occupied landing points and abrupt height changes.
Collision owns actual XY landing; a new obstacle never causes a target teleport.
Nearby players, landing contact or balls startle the frog into a short escape,
preferably toward water, followed by a two-second recovery. Mid-hop hits preserve
that hop instead of restarting its trajectory. A closed habitat settles in place.
The solid 6×4px body has a 4px physical height. Shared prediction/authority landing
physics gives a smaller player bounce than a duck; balls ricochet without killing
frogs. The generic wildlife contact outcome now covers both species.

Home, target, RNG, state/timer, alarm and hop elapsed/height persist through ordinary
actor records and residency. An optional two-byte sprite clip phase travels in
binary baselines/deltas, so a client joining or reloading mid-hop restores its pose.
Other animations retain their local clocks. PlayScene synthesizes spatial two-pulse
croaks on resting blink cycles and alarm transitions. Labs retain their existing
lack of game audio.

The in-memory pond lab has a frog-bank arrival (**Pond · frogs & shallows**) and
**Hop onto frog** next to **Hop onto duck**;
both use the ordinary authority teleport/fall command. It exposes frog poses for
Canvas/GPU verification without a second simulation loop.

Inspection: https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-frogs&landscape=thicket#/tool/world-geometry

## Checkpoints and evidence

- Headless frog checks cover native art/clip bounds, seeded open-bank placement,
  physical jump phases, exact mid-hop continuation, binary phase add/removal,
  predicted bounce, ball hit/vertical miss, enclosed/changed obstacles, every cycle,
  land/water transitions and moved/manual/deleted actors through save/reload.
- The shared residency test now covers frogs and ducks. It performs the follow-up
  reconciliation production performs every tick: concurrent cross-chunk origin
  receipts may become dirty during the first release pass.
- Typecheck, lint (existing 118 warnings/34 infos), build and all 1,771 unit tests
  pass. The new frog arrival also passes the eight existing scenario checks.
- Ten focused frog/duck browser checks pass on bundled full Chromium, Canvas/GPU:
  physical hop, landing bounce, mid-hop pause/reload pose, game ball/croak/escape,
  ordinary seeded populations and editor creation/deletion across world reopening.
- Browser tests compare poses after hydration, since numeric network IDs may be
  reassigned. Headless records/residency checks verify persistent identities.
  Ordinary-world checks bound counts to the inspected pond rather than transient
  distant populations entering/leaving the streamed view.
- Catalog: 217 sheets / 1,062 uses. Manifest: 645 verified candidates; four new
  frog-bank geometry/profile previews. All 27 exact wildlife candidate records
  remain unchanged; landscape/runtime fingerprints correctly reopen changed views.
- Full browser suite: **395/397 pass** (12.9 minutes), including all four frog
  checks, all six duck checks and affected game/Canvas/GPU engine/lab checks.
  The two existing wildlife-review failures both stop at the absent archived fox
  pilot-v1 `preview.gif`; unchanged exact-art evidence is preserved, not regenerated.
- Isolated `streaming:bench -- --assert-ready` exits 0: cold, standing, walk,
  sprint, reverse and zoom-out all finish with missing/incomplete/stale counts 0.
  This is functional Canvas/headless readiness evidence, not a GPU performance claim.
- `git diff --check` passes. No native art, review approval or historical snapshot
  changed. Production art-table refresh was attempted at checkpoints and completion;
  the missing ignored campaign state still prevents regeneration.

Local evidence (not committed): [full browser log](/tmp/tilefun-frog-browser-full.log),
[unit log](/tmp/tilefun-frog-unit-final.log),
[streaming report](/tmp/tilefun-frog-streaming/report.json),
[Canvas pond capture](/tmp/tilefun-frog-pond-canvas.png),
[GPU pond capture](/tmp/tilefun-frog-pond-gpu.png),
[ordinary ball escape](/tmp/tilefun-frog-ball-hop.png).
Native captures show the unchanged frog clearly above its bank shadow during a
hop, and the frog-bank arrival frames the smaller animal beside accessible water.

The production art status helper still requires ignored
`data/wildlife-campaign-v2/progress.json`, absent in this checkout. Preserve the last
validated art table; do not invent art receipts for gameplay integration. Refresh attempts followed persisted gameplay checkpoints and completion; the
last validated art table remains untouched.

Next: owner playtest of mixed ponds, then rabbits for meadow/woodland-edge habitats.
