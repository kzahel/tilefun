# Exposed vehicle riders

Topic: vehicle-riders
Status: three identity pilots and actual classic/sidecar fits retained; two shared-loader reviews pass; normal motorcycle activation deferred.
Updated: 2026-10-20.

Owns seated player and automatic-driver presentation for motorcycles, scooters
and other exposed seats. [Original vehicles](original-vehicles.md) owns vehicle
art/catalog expansion; [characters](characters.md) owns avatar identity/source.

## Current state

The player picker offers 27 appearances: Classic, twenty people and six promoted
characters. Their runtime representations are directional standing/walking
sprites. Only Tiger has a retained corresponding Blender rig; the other five
promoted appearances use authored pixel-part masters, not complete avatar rigs.
There is no production seated-avatar mesh inventory or seated sprite clip.

Ordinary non-boat vehicle drivers are hidden by `collectScene`. VehicleControl
and PlayerPredictor attach the actual player and disable its separate collider.
The boat's visible sprite/seat-height exception demonstrates attachment, but
does not provide seated knees, hands, foot contacts or mesh depth interleaving.
Existing open cars keep ordinary hidden-driver behavior; their model deliveries
do not qualify visible occupants.

## Source proofs and next gate

The retained static Explorer roadster pilot is under
`art-source/vehicle-riders/explorer/v1/`, with a network-free viewer under
`public/demos/vehicle-riders/explorer/v1/offline.html`. Its 1,864-triangle mesh
uses one opaque 256px unlit atlas. Independent minimal-input replay reproduces
the exact model, atlas and recipe. Actual hip/seat, palms/rim and soles/floor
contacts, real same-target occlusion, inappropriate-intersection rejection and
a translated-into-hood negative/reset control pass. All 32 rider-hidden views
preserve the frozen roadster RGBA pixels exactly. Agent inspection remains
separate from human approval.

An explicit component assembly retains the unchanged vehicle and rider buffers
under `art-source/vehicle-bake/rider-explorer-roadster/v1/assembly.json`.
Its exact 4,956-triangle GLB has six meshes and two opaque atlases. Fresh
declared-input replay passes; all 32 combined views match the original two-asset
composition exactly, while hiding the rider restores all 32 frozen car views.
This is an isolated review prototype, not ordinary occupied-vehicle behavior.

`explorer-upright/v1/` adds a 1,956-triangle straddled pose and explicit five-contact
`profiles/upright-v1.json`. It passes independent replay and native view inspection
against a synthetic contact fixture. Its actual classic and sidecar fits now pass
the independent controls described below. The stockier
Brown Bear pilot retains an actual failed fit of that unchanged profile with
its inferred short-limb template. This does not rule out other anatomical or
leaning interpretations. Its separately named measured Bear profile now passes
five actual synthetic-fixture contacts, local self-intersection/straddle controls
and independent exact source replay. The 2,112-triangle source retains its eight
identity colors, round ears, muzzle and stocky paws. Agent inspection of all
native headings and wire views passes. Its separate mechanically fitted classic
bike source now passes actual contacts and body/wheel envelopes; parent shared
review remains pending for that variant.
Do not stretch anatomy to manufacture a universal fit.

Person7 retains a distinct 1,984-triangle capped legacy-human identity with its
own measured profile and source palette. Its short-limb anatomy fails the
unchanged Explorer profile and unchanged classic bike. A separate classic fit
changes six bar/grip/peg components while preserving 49 of 55 components, including
the saddle, wheels and body. Brown Bear's fit likewise changes controls instead
of avatar scale. These are source pilots, not all-character production coverage.

Explorer's exact classic and sidecar assemblies are now frozen isolated reviews
under `public/demos/original-vehicles/rider-explorer-{classic,sidecar}-motorcycle-v1/`.
They contain 4,390/5,374 triangles, four/five meshes and two opaque atlases. The
strict shared loader accepts real F/R or F/R/SC rigs without dummy wheels. Every
wheel passes independent signed travel, reverse/reset and whole-body cylinder
negative controls. All 32 combined RGBA views match the independent two-asset
reference; hiding the rider restores all 32 bare-bike views. Decoded vertex
attributes and declared mount positions remain exact. Both pass desktop/mobile,
offline and independent minimal-input source replay. These do not change normal
game visibility, occupancy, physics or fallback behavior.

The read-only appearance inventory also establishes that Classic is a small
cream cat-like character, the twenty legacy people have distinct headwear,
hair/skin/clothes, and the six promoted characters include tails, muzzles and
different proportions. They require identity-specific templates and measured
fit profiles. Recoloring Explorer is not coverage of all 27 appearances.

Prefer one static seated avatar GLB composed with a vehicle inside the same GPU
depth target. Start with one identifiable avatar and the unchanged open roadster
as a diagnostic control, then one actual two-wheel bike. Author explicit hip,
grip and foot sockets; inspect every native game/study heading. This needs no
runtime skeletal animation. A walking sprite rotated or squashed over the bike
does not establish a seated pose or near/far limb occlusion.

The shared renderer must use the vehicle's same interpolated pose for both assets,
resolve the actual parented player's appearance, include the rider in visual
bounds/outline/culling, and clear pooled state between instances. Canvas and
disabled/failed-mesh paths need an occupied fallback with correct depth. Verify
local/remote identity, two simultaneous riders, selection changes, boarding/exit,
reverse/turn/stopping, save/reload reattachment, deletion and resource teardown.
Game and embedded labs must use the same implementation.

Occupied overhead clearance and moving-roof support need a deliberate authority/
prediction contract: raising a cosmetic avatar's height must not silently change
vehicle physics or turn its head into a standing platform. Automatic traffic
does not create player drivers. It needs a deterministic cosmetic AI occupant
that remains visible while stopped, and an explicit distinction from empty
parked vehicles; velocity alone cannot identify occupancy.

## Gate and next work

The seven motorcycle/sidecar/scooter entries stay deferred until rider presentation
is viable. One avatar/seat proof would establish an interface, not universal
coverage. Qualify all supported appearances (or an owner-accepted identity policy),
an extreme second body/seat profile, automatic traffic and the failure matrix
before making a motorcycle normally available. Keep standing approvals and frozen
vehicle sources unchanged. Run 153 continues ordinary vehicle production while
separate YA work prepares an actual bike fit and a capped legacy-human pilot.
The retained pilots have no normal catalog activation, all-avatar, AI or fallback
claim. They do not change any approved standing character or current car.

The retained [appearance inventory and fitting proposal](../vehicle-rider-coverage.md)
records the remaining 26 identities and the limits of sprite-derived measurements.

Code entry points: `src/characters/PlayerModels.ts`,
`src/characters/CharacterCatalog.ts`, `src/rendering/collectScene.ts`,
`src/rendering/EntityMeshPose.ts`, `src/rendering/GpuMeshBodies.ts`,
`src/server/VehicleControl.ts`, `src/client/PlayerPredictor.ts`,
`src/traffic/TrafficSystem.ts` and `src/traffic/RoofSupport.ts`.
