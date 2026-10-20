# Distinct animal behaviors and interactions

Topic: wildlife-behaviors
Status: five behavior batches implemented. Seventeen entries have targeted automation
verification: fifteen distinct signatures and two inherited cat coats. Broad and
focused automation results are recorded in166; exact human review remains pending.
Updated: 2026-10-20.

Owner wants every animal to have recognizable behavior, with suitable animation
where needed, starting with land and air animals. The completed 196-entry art
roster is the starting inventory, not a completed behavior campaign. Additional
game-active animals and fantasy creatures must also appear in the scope audit.
The [wildlife topic](wildlife.md) owns existing art/ecology contracts; this topic
owns the proposed behavior campaign, completion criteria and delivery sequence.

## What counts

Each animal needs a signature mechanic: an observable trigger, a decision or
action, and a meaningful outcome. New colors, idle clips, speeds or diet settings
alone do not constitute a new behavior. Shared engine systems are encouraged;
recognizable differences should come from actual choices and interactions rather
than duplicating simulation code per species. Closely related animals may share
a foundation while differing in a documented, observable way.

The first batch implements squirrel food caching/retrieval, dog ball fetching and
crow material carrying/nesting. The second adds plant feeding, perch foraging and
meerkat lookout alarms. The third adds capuchin fruit climbing, raccoon cache raids and cat toy play/tree rests.
Owner also requested appropriate birds making visible nests and visible foraging,
including fruit. Resource seeking, taking, carrying, eating and nest construction
must have observable outcomes rather than disconnected action loops. Nesting does
not automatically add breeding. Required resources, habitat geometry and player
affordances belong in each plan.

Coat variants and upright companions must be explicitly accounted for. A variant
may inherit its base behavior, but inheritance is not counted as another unique
mechanic. If distinct variant behavior is required, record an observable override.
Report animal coverage separately from the number of distinct mechanics.

## One source of progress

The tracked [behavior ledger](../../art-source/wildlife-v2/behavior-campaign.json)
is the canonical per-animal audit and plan. It contains all 206 current browser
entries: all 196 original roster entries plus four pet variants, panther and five
fantasy creatures. Mallard and brown-bear runtime IDs explicitly map to the
original mallard-duck and bear roster IDs. Preserve completed art ledgers as history.

The [generated progress report](../wildlife-behavior-status.md) derives its counts
and animal table from this ledger. The same generator writes compact Animal
Browser progress data. Filter **Behavior progress → Demonstrations** and select
**Demonstrate behavior** to open a shared authority scene. The other 189 animals
still need detailed audits and phase assignment. Existing behavior has not been
removed or declared absent. Verified stages require recorded evidence.

Regenerate with `npx tsx scripts/wildlife/behavior-status.mjs`; append `--check` to
verify current runtime/roster coverage and report freshness. The tool rejects
missing identities, invalid states, evidence-free verified stages and unexplained
not-required exemptions. Its one-time `--seed` option refuses to overwrite a
ledger, protecting subsequent audits. Update the ledger first, then regenerate.

Each animal entry should contain:

| Field | Purpose |
| --- | --- |
| Stable animal ID, runtime IDs, base/variant relationship | Prevent missing animals, duplicate counts and identities inferred from display names |
| Phase and habitat | Land/air first; aquatic deferred; explicitly assign amphibious animals |
| Current behavior and gaps | Evidence-backed baseline, including shared systems already used |
| Signature behavior and acceptance scenario | Trigger, action, outcome and how someone can observe the difference |
| Interactions and dependencies | Player, other animals, food, objects and required habitat or engine support |
| Animation requirements | Reuse verified clips, or specify new actions, transitions, body motion and source revisions |
| Independent progress states | Design, AI, animation, world/lab integration, validation and human review |
| Evidence and delivery | Tests, deterministic lab case, exact animation review, commit and deployment verification |
| Next action and impediment | Concrete next step; name a real missing dependency or recorded review request |

Use explicit states per work area: not audited, planned, in progress, verified,
or not required with a reason. Design can be specified before implementation.
Animation reuse needs verification; it must not silently mean missing animation.
Human review remains separate: not requested, pending, needs changes, approved.
Only actual human feedback may set review outcomes. Changes to an existing
signature mechanic or its animation reopen affected verification/review states.

The summary should show land/air and later aquatic totals separately, with counts
for audited, designed, AI implemented, animation ready, game/lab verified and
human-reviewed animals. Show missing evidence and real dependencies alongside
those counts. Do not label an animal complete because its plan exists or its
sprite animates. Do not convert historical art holds into current work blockers.

## Delivery and verification

Work in small batches of roughly three to five related animals. Use a bounded
[tactical](../tactical/README.md) for each batch; link it from ledger entries.
Implement a representative end-to-end animal before expanding a new foundation
such as climbing or burrowing. Completed specialist behavior can be retained
after an audit against these same requirements; it need not be rewritten.

Behavior-complete requires the signature mechanic to work through shared game
authority in both natural and manually placed animals. It must survive save,
reload and residency changes, respect collision and heights, retain food-web
and companion/player protections, and have appropriate bounded execution cost.
Multiplayer clients must observe the same authoritative action. Preserve the
natural-only, delayed distant meal-replacement contract.

Animation-complete requires suitable existing or new clips and transitions,
connected limbs, body weight/motion, ground contact and no unexplained sliding.
Changed art uses a new retained source/review identity; old banks stay immutable.
Follow [art review](art-review.md) and existing wildlife motion instructions.
Human approval is an independent recorded outcome, not an inferred test result.

Every signature mechanic needs a reproducible lab scenario that exposes its
trigger and outcome, plus appropriate automated evidence. Animal Browser should
offer behavior descriptions, behavior/animation/review filters, next-action and
date sorting, and a direct demonstration link. Scenario controls should trigger
ordinary gameplay inputs or conditions; they must exercise shared production AI.
Use the existing embedded engine hosts, not a separate showcase implementation.

## Proposed order

1. Audit all current animal IDs; classify land, air, amphibious and aquatic scope.
   Specify the first small batch and build the ledger/status/browser views.
2. Prove ground interactions with a small pet/foraging batch, then expand resource
   seeking, carrying, caching and distinct social reactions where appropriate.
3. Improve air animals through real flight/perch/navigation and observable
   feeding or object interactions. Distinguish flight from looping wing animation.
4. Add climbing, burrowing and other habitat foundations through single-animal
   pilots, then related species; schedule independent batches around dependencies.
5. Deepen land hunters and herd/sentinel behavior, retaining existing specialist
   mechanics. Continue until every in-scope animal satisfies its recorded plan.
6. Address aquatic specialties in a later phase. Amphibious animals need explicit
   land/air-phase boundaries rather than disappearing between the two queues.

These are proposed capability groups, not a requirement to finish one entire
group before starting another. Prefer complete, demonstrable slices. The initial
inventory/report and first implementation batch are established. Next step:
review the seventeen implemented demonstrations, then audit the next small land/air
batch against these completion rules. Continue classifying the remaining 189
entries and record proposed mechanics before expanding production.

## First batch contracts

[155](../tactical/155-fetch-nests-and-caches.md) owns the bounded implementation.
AnimalWork lives on the saved animal; material/site state lives on saved entities.
Claims use durable identities. Existing binary fields carry clip phase, socket
parenting and world height; gameplay decisions and resource counts remain server
authority. Dog coats inherit fetching, without being counted as extra unique
mechanics or receiving unverified new coat art.

Thrown owned balls remain available for 35 seconds after settling; a bounded
active fetch extends that timer. Another throw reuses a returned ball within
reach. Crows consume four real loose twigs to build a nest on an actual oak/palm
canopy. A removed or moved supporting tree leaves a fallen nest and cancels its
active task. Squirrels store the exact nut/fruit kinds in a cache, rest, retrieve
one saved item and consume it once. Resource supplies are finite and can also
be placed/deleted with the editor. Nesting adds no breeding.

Travel and site selection respect loaded actor readiness, collision, heights and
the existing planning budget. Alarm, following/riding, owner loss and item/site
deletion interrupt tasks safely. New `behavior-v1` banks retain native Blender
sources, projected mouth/paw sockets, independent audits and replay evidence.
The separate native-pixel material bank supplies five nest and two cache stages.
All four art identities remain pending human review.

Every admitted task movement leg applies the shared Fauna pose update immediately:
facing, sprite row and locomotion clip follow the new target, including return
trips. The same pose crosses replication and mid-carry reload. The heading fix
changes simulation pose selection and leaves the retained art banks untouched.


## Plant feeding, perch foraging and lookout groups

[157](../tactical/159-foraging-and-lookouts.md) implements the owner-authorized
second batch through the same Realm AnimalWork service. Rabbits use native short
hops to edible plants, nibble three saved portions and pause with an ear alert
between bites. Plant sprite stages reflect actual remaining portions, then the
entity is removed. Robins fly down from native tree canopies, peck real seed or
fruit, consume it once and return to their saved supported perch. Tree removal
prevents a return and collision-resolved landing uses the actual ground.

Nearby meerkats rotate lookout duty, visibly rise, scan in four directions and
lower again. The active sentinel can spot a predator within 128 pixels, provided
the directed food web permits that predator to eat it and their heights are
compatible. Its visible alarm interrupts nearby group activity and starts ordinary
escapes away from the threat. Natural group IDs isolate groups; nearby ungrouped
manual meerkats can cooperate. Following/ridden animals retain their protections.
Calm group members may forage nearby fruit while a sentinel watches.

Natural rabbit and meerkat homes receive one finite food patch per animal.
Robin groves share one finite seed patch per occupied chunk, retaining every
bird and keeping dense forest previews within the existing 128-actor limit.
Resource identities remain cell-owned; crow/squirrel supplies are unchanged.
Manually placed animals seek nearby player-placed resources
without creating food automatically. The editor exposes **Edible plant** and
**Bird seed** alongside existing fruit/nuts/twigs. Resource claims prevent duplicate
bites, release on interruption/destruction and survive saves. Loose-food claims
are provisional: a ready resource whose claimant unloaded or cancelled its task
can be claimed again. Returning animals revalidate ownership before consuming;
carried/parented inventory keeps its existing group ownership. Native motion owns
travel, facing, heights and collision; work clips and stationary facing hydrate
through saved records and ordinary replicated sprite fields. Natural meal
replacement remains delayed, distant and restricted to naturally spawned prey.

New `behavior-v1` action banks append rabbit/robin feeding and meerkat
rear/scan/alarm/lower poses; all prior native travel cells stay pixel-identical.
Resource `behavior-v2` appends three plant stages and bird seed, preserving the
previous ten material cells. Exact sources, isolated replays and pending review
identities are retained. The six behavior demonstrations appear in the Animal
Browser filter; activity scenes open at a readable zoom and the meerkat scene
can place an ordinary tiger through the production editor command.
Demonstration framing is species-specific: the robin view includes both the
tree crown and ground food; rabbit feeding and the initial meerkat group fit
fully in frame. Existing dog/crow/squirrel framing is retained.

## Climbing, cache raids and play (161)

[161](../tactical/161-climbing-raids-and-play.md) adds three signatures, with cat
coats inheriting one mechanic and retaining their own original travel pixels.
The capuchin approaches an actual oak/palm trunk, grips and climbs continuously,
picks one fruit from its finite crop, eats while supported on the crown, rests
and descends. Removing/moving support cancels the task; unavailable support scopes
freeze the committed grip. Alarms interrupt feeding and reverse a partial ascent
from the actual attained height. Following/ridden animals keep their protections.

The raccoon reserves a real squirrel cache, takes one actual stored item, carries
it to a nearby tree and eats. No food is created by theft or by the cache itself.
The squirrel can replenish its cache by harvesting real nuts. Natural raccoon
clearings add one ordinary foraging squirrel per group, plus supported tree/nut
supplies, so this interaction can occur in the world. Existing owners, roster
slots, actor identities and RNG ordering remain unchanged; additions are cell-owned.
Manually placing an animal still creates no supplies or neighbours.

Cats stalk a settled/rolling ball in short crouched approaches, physically pounce,
bat it with an actual impulse and pursue again. After three plays they can climb
to a real tree rest. Slow deliberate toy contact is play; unrelated fast ball hits
retain their ordinary startle response. Ginger/black coats share the same saved
behavior with separately retained action atlases. All three have lab demonstrations.

### Food renewal and toys

The editor exposes a tree fruit crop, tree nut supply, seed-bearing plant and
growing edible plant. Place tree crops beside ordinary trees; fruit is supported
on the canopy and nuts become available beside the trunk. Sources hold at most
three portions. Fruit renews one portion per 240 seconds, nuts per 300 seconds,
plants/seeds per 180 seconds of admitted ready simulation. Full sources discard
surplus growth time. Sources do not accrue offline stock or scatter unlimited
loose items. Remaining stock and timers survive saves. Deleted trees remove their
associated source. Loose player-placed food and caches remain finite.

Fresh natural rabbit/robin supplies are growing plants; robin groves retain their
one-patch-per-chunk bound. Capuchin homes have real supported fruit crops, and
squirrel homes have nut supplies alongside their original loose food. Existing
saves can receive these features through ordinary editor placements; no world
migration or old-bank regeneration occurs.

Each player keeps at most ten thrown balls per realm, counting unloaded actors.
An eleventh retires that player's oldest loose ball. Held toys are protected;
if all ten are held, another throw is refused. Creation order and ownership
survive fetch, rethrow, unload and reload. Returned balls can be reused only by
their owner. Player toys have no timed expiry and remain on water; ordinary editor
balls keep their previous disposable behavior. Explicit editor deletion still works.
A compact saved owner index prevents travel/reload from bypassing the limit and
rejects a retired toy even if an older scope snapshot arrives late.

## Browsing, rooting and trunks (163)

[163](../tactical/163-browsing-rooting-and-trunks.md) adds finite leafy shrubs and
root patches to the existing food-growth system. Both hold three portions; leaves
renew every 180 admitted ready seconds and roots every 300, with saved timers and
no offline catch-up. Empty root patches remain visible as disturbed soil. Roots
are actual carryable edible actors, separate from the patch stock.

Goats approach a shrub, rear above planted hind hooves, browse one portion and
lower. They can hop onto an ordinary editable **Low rock**, rest on its real
8-pixel top and hop down. Grounded bodies are unchanged. The new Low rock reuses
existing native rock art under an explicit finite walkable geometry identity;
older rock definitions remain intact. Flight follows ordinary collision and
saved motion; unavailable support pauses the committed hop. Removed support
changes the landing to actual ground without a height jump.

Pigs sniff a real stocked patch, work the snout into the soil, uncover one actual
root, lift it and eat. Scares/following/riding and interruptions release claims;
already uncovered roots drop as real items. Competing pigs cannot duplicate stock.

Elephants stand at a collision-safe authored trunk reach point beside a supported
fruit crop. Reaching takes one actual fruit; its attachment follows the trunk tip
through the curl into the mouth and eating. A separate shake transfers at most two
available portions into real ground fruit for other foragers. It never makes food.
Deleting the support cancels the reach/crop; held fruit remains conserved.

Natural goat/pig homes and farm residents receive bounded cell-owned supplies;
elephant homes receive an actual ordinary oak and finite crop. Existing animal
IDs, roster slots and random ordering are unchanged. Manually placed animals
create no supplies. The editor provides Leafy browsing shrub, Rooting patch,
Foraging root and Low rock for existing worlds. Three behavior demonstrations use
the same Realm/Worker implementation, resources, props and clocks as the game.

New behavior-v1 banks append actions for these three existing animals. Resource
behavior-v4 appends nine stock/item cells; all earlier native cells are unchanged.
Editable rigs, fixed mesh geometry, connected fixed-length limbs/trunk, source
projections, retained palette masters and isolated replays are receipt-pinned.
The exact new art remains pending human review.

## Scratching and flower visits (166)

[166](../tactical/166-scratching-and-pollination.md) is the current bounded batch:
chickens scratch finite soil, take one actual seed and eat; bees sip finite nectar
and carry pollen between distinct blooms; hummingbirds hover, sip and briefly
guard the actual flower against nearby unprotected conspecifics. Guardians warn
at most once in a six-second guard and release the flower afterward. Players,
following/attached/ridden animals and ordinary alarm/escape protections remain.

Soil patches and flowers hold three portions, renewing one per 180 admitted ready
simulation seconds with saved timers and no offline catch-up. Empty patches and
flowers remain visible. A pollen-marked destination accepts one transfer per 60
ready seconds and advances at most one nearby depleted plant/seed/fruit crop by
at most 30 seconds, stopping at one second remaining; already nearer-ripe crops
are unchanged. There is no instant stock creation, loose-food scattering or cache
refill. Pollinated blooms use distinct saved visual stages and ordinary clip IDs.

Fresh natural chicken cells share one soil patch; bee/hummingbird cells share at
most two flowers and one growing plant per occupied species/cell. New IDs derive
from existing animal owners and points remain in their actual cells, including
negative boundaries. Original animals/RNG/roster pools remain unchanged. Manual
placement makes no supplies; the editor exposes Chicken scratching patch and
Nectar flower. Three ordinary-authority demonstrations use the same saved actors.
The hummingbird scene can place an ordinary visiting bird through the editor.

New behavior-v1 action banks append connected fixed-volume anatomy without
changing any native travel pixels. Resource behavior-v5 appends 13 cells to the
unchanged prior39. Exact new art remains pending human review; final automation
status and known test caveats belong to tactical166.

Committed scratching, sipping and guarding revalidate current source contact and
height before taking stock or warning rivals. Moving a patch/bloom releases its
claim; a seed already uncovered remains a real held item. Approach points use
actual surface height and reject unsupported differences beyond normal reach.
