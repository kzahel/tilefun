# Dog fetching, crow nesting and squirrel food caches

Status: implemented and automation verified; human review pending (2026-10-20).
Topic: [distinct animal behaviors](../topics/wildlife-behaviors.md).

Deliver all three animals end to end, with appropriate visible action animation,
ordinary natural/player-created actors, shared game/lab authority, durable state,
reproducible demonstrations and final commit/push. This explicit batch authorizes
new dog/crow/red-squirrel animation revisions; preserved art banks remain immutable.
No human approval is inferred. Existing historical campaign holds do not expand
this bounded authorization into other animal/art production.

## Acceptance

- Dog: notice a player's thrown ball, reach it after it settles, pick up the same
  ball, visibly carry it back and release it within reach of that player. Preserve
  ownership, prevent two dogs claiming one ball, and allow another real throw.
- Crow: pick up suitable loose materials, fly to a real suitable nest site,
  visibly deposit material and construct a persistent nest in stages. Carry and
  building actions must reflect actual resource consumption. Respect held items.
- Red squirrel: find actual nuts/fruit, pick them up, carry food to a visible
  cache, bury it, revisit after a rest, retrieve stored food and visibly eat it.
  Cache counts and food identity must survive restart without duplication.

## Shared implementation

Animal tasks and resource/site state belong to durable actors. Held items use
ordinary replicated actor parenting and socket offsets. No client-only resource
simulation or test-only completion hook. Bounded goal/path work reuses shared
Fauna motion and occupancy. Stop or release safely for alarms, riding/following,
deleted owners/items, unavailable loaded regions and blocked paths. Resource
ownership uses durable identities; runtime numeric IDs never persist as claims.
Natural resource placements have stable generated identities and finite supply;
manual resources use ordinary placement/deletion. Completed art and meal-return
contracts remain separate from the new behavior progress ledger.

New clips use retained editable Blender sources and new pending review revisions.
Carry actual ball/material/food entities, without painting fake carried objects
into the animal sheet. Reuse verified locomotion where suitable. Qualify pickup,
release, nesting, digging and eating at native scale and in four directions.

## Delivery sequence

1. Audit and record all three designs; introduce resources, claims, shared task
   motion, parenting and persistence. Complete the real ball-fetch cycle first.
2. Add crow material collection, supported elevated flight/nest placement and
   visible finite construction. Add squirrel caches, retrieval and eating.
3. Retain/register animation revisions, expose shared lab demonstrations and
   progress in Animal Browser, seed natural materials and editor resources.
4. Verify acquisition, interruption, resource accounting, save/reload at each
   important stage, deletion/unloading, multiple competing animals and binary
   client observations. Exercise both rendering paths in bundled Chromium.
5. Run type/unit/lint, inventories/build, scoped browser and streaming readiness
   checks. Refresh both progress reports. Commit/push the coherent batch, rebasing
   if necessary while preserving concurrent vehicle work.

## Delivered

- Dogs and dog coats fetch actual player-owned thrown balls. Settled balls last
  35 seconds; bounded active fetches retain their target. Pickup, carrying and
  release preserve the same actor through save/reload and another throw.
- Crows consume four actual loose twigs to build an elevated nest in five visible
  stages. Natural clearings gain ordinary editable oak trees with stable IDs;
  manually placed crows use nearby oak/palm canopy surfaces. Removing/moving the
  support leaves a fallen nest and cancels its task.
- Red squirrels forage actual nuts/fruit, bury their exact kinds in a saved
  cache, rest, retrieve one stored item and visibly eat it once. Depleted supply
  returns the animal to ordinary movement. Editor materials allow replenishment.
- Realm owns task decisions, claims and durable resource counts. Existing Fauna
  motion, planning budgets, collision and readiness own travel. Ordinary binary
  parenting, height, socket offsets and sprite phases expose the action to clients.
  Alarms, following/riding, removal and unavailable regions release/cancel safely.
- Three new `behavior-v1` Blender banks add pickup/release/build/dig/eat clips.
  Actual carried actors follow per-frame projected mouth/paw sockets. The squirrel
  no longer needs a fake nut painted into its new bank. Old revisions stay exact.
- Animal Browser has behavior progress filters/descriptions and **Demonstrate
  behavior** links. The dedicated scenes use shared production authority; the dog
  button sends a real throw command. Updated-date sorting includes recorded behavior
  delivery dates. No separate lab AI or resource simulator was introduced.

The [206-entry ledger](../../art-source/wildlife-v2/behavior-campaign.json) and its
generated status/browser data track the same three verified implementations.
The other 203 entries need their detailed audits. Review is a separate pending
state, including all four new art identities (three animals plus native-pixel
materials/nest/cache). No approval is inferred from tests or prior animal approval.

## Verification

[Retained validation summary](155-fetch-nests-and-caches/validation.json) records
counts, source receipts, source replay and limitations. Automated evidence:

- 11 behavior tests cover real repeat throws, competing dogs, blocked/unready
  approaches, interruptions, deletion, tree support, natural supplies, persistent
  resource accounting, mid-carry/mid-eat reload and ordinary binary parenting.
  A final cold run of the affected behavior/scenario/rendering tests passes 413;
  focused natural dog/crow/squirrel authority checks pass 26.
- Nine bundled full-Chromium browser cases pass across Canvas2D/GPU: three activity
  demonstrations with carried-object reload, ordinary game fetch in both renderers
  and the browser filter/link. Five affected cases pass again on the final build.
  Native/3x crop checks cover all 716 animal poses. Captures were visually inspected.
- All three animal banks and the resource sheet replay byte-identically from an
  isolated minimal source checkout. The shared camera and person scale reference
  are explicitly pinned in the validation summary alongside per-bank receipts.
- Typecheck, lint (existing warnings), production build and streaming readiness
  pass. Art catalog has 667 sheets/1,378 uses. Normal retina Chromium verifies all
  1,840 Workshop candidates. 912 existing candidate records remain exact;
  912 live geometry/character studies refresh only their code fingerprints. The
  16 additions are 12 behavior-scene entries and four art-review identities.
- Full units: 6,020 pass, 10 skip. Five failures are the known Windows symlink and
  SIGKILL limitations. A sixth tree-support case was added while the run was active
  and read the earlier cached task module; its final cold 413-test run passes.
  The full run completed in 744.13 seconds without extra load-timeout failures.

Reproduce with the standard checks, `npx vitest run src/wildlife/AnimalWork.test.ts`,
`npx playwright test tests/animal-work.spec.ts`, the per-bank replay/capture helpers,
`node scripts/wildlife/behavior-art.mjs --check` and the behavior status `--check`.
Normal builds consume committed art. Replay frozen sources only in an isolated
checkout without the receipt guard; never regenerate preserved banks in place.

Next: review these demonstrations and action banks, then audit/design the next
small land/air batch before expanding implementation.

## Rebase integration

Rebased onto `00a47116` (car controls/contact/hybrid input), preserving the local
vehicle paint-study commit as `50014c58`. Regenerated both shared inventories
against the combined source. Typecheck, lint and 325 focused animal/scenario,
binary protocol, input and driving/contact tests pass; normal retina Chromium
again verifies 1,840 candidates. Final combined browser/streaming results are
recorded in the validation summary.

## Target-facing correction (2026-10-20)

Owner observed animals travelling toward task targets without turning to face
them. `AnimalWorkSystem.go` committed target/motion state but omitted the shared
`restoreFaunaPose` call used by ordinary roaming. It now applies that same update
when starting each accepted leg, synchronizing facing, directional sprite row,
moving state and locomotion phase before the first movement frame. Return trips
also replace the preceding pickup/action clip with locomotion. Existing shared
attachment synchronization uses the newly selected mouth/paw socket.

Three production Realm regressions failed before the correction and pass after
it. All 14 animal-work tests pass, including heading checks throughout approach
and return, replicated pose and mid-carry reload for dog, crow and squirrel.
Retained animal/resource art and source receipts are unchanged.

Verification: 6,051 full-unit passes, five known Windows symlink/SIGKILL failures
and ten skips. All nine existing browser cases pass; two additional runs explicitly
check the displayed client heading and locomotion on approach/return in Canvas2D
and GPU. Typecheck, lint, build and streaming readiness pass. All 109 retained
source/review hashes and all 1,840 existing candidate identities remain exact;
only inventory source references/input digest are refreshed.
