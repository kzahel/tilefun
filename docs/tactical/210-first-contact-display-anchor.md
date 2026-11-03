# First-contact display anchor

Status: implemented; native checks pass, production qualification in progress.
Updated: 2026-11-03.

Owner reports an unmoving NPC teleports toward/sticks to the approaching player.
The earlier car investigation recorded the same contact-membership problem with
the opposite correction sign. Keep physical pushing and the single shared world.

## Reproduction

Ordinary ScenarioSession, stationary chicken at (80,100), player at (40,100),
rightward movement at 60Hz and authority frames every three ticks. Allow eight
extra authority ticks while the client stalls at local tick 18 or 25. The server
continues held input; this represents a main-thread stall while its Worker runs.
At tick 18's first contact the NPC physically moves +0.467px, but is displayed
3.242px toward the player. Tick 25's acknowledgement produces a 1.200px backward
display step. Steady synchronized pushing is smooth.

`presentEntities` starts applying the player's entire residual correction to the
NPC when it enters the solved contact graph. That visual offset does not belong
to the NPC. Existing pre-contact isolation and connected-group gap tests miss the
transition. New native regressions fail against the old code for both stall times.

## Change and scope

The committed contact component retains one shared display transform. A newly
contacted actor anchors that transform instead of inheriting unrelated local-player
error. Later reconciliation measures the anchor's own before/after displacement.
For a joining anchor, the new interpolation interval begins at its previous pose,
so fractional render samples cannot rewind behind a previously stationary NPC.
When alone, the player remains its own correction anchor. Epoch/reset/recovery
clear anchor membership; render reads the committed set while replay stays private.

The solved contact geometry takes precedence over retaining an incompatible old
player-only visual offset at contact. NPCs are not made kinematic, and no mass,
motor, Rapier contact rule, authority tick or network field changes. The same
PlayerPredictor serves normal play and embedded labs. This does not promise zero
corrections for unknown remote input or a generally monotonic path for moving NPCs.

## Qualification

49 focused native tests across shared prediction, remote presentation, shared
physics and Realm physics pass. New checks cover both stalls at alpha 0/0.5/1,
no inward NPC movement, preserved contact gap and effective continued pushing.
In the tick-18 probe, the first displayed NPC step now matches its +0.467px physical
push. The tick-25 acknowledgement starts with an outward +0.533px step instead of
an inward -1.200px step. The earlier car-stall probe's maximum displayed step drops
from 1.189px to 0.240px, with unchanged maximum physical travel of 0.120px/tick.
Production browser/build/inventory/streaming qualification follows.
