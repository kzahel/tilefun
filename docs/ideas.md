# Ideas and backlog

Uncommitted possibilities, not an ordered implementation plan. The
[roadmap](ROADMAP.md) owns near-term direction; [topics](topics/README.md) own
current decisions and [tacticals](tactical/README.md) own accepted slices.
Keep original feedback and detailed catalogs at their linked source instead of
copying every item into multiple checklists.

## Gameplay and creation

- [Player-driven cars and trains](tactical/087-player-driven-cars-and-trains.md):
  inside driving, persistent parked cars and tap controls delivered. Follow
  [vehicles](topics/vehicles.md) and [trains](topics/trains.md); visible NPC driver
  exchange and parked-car adoption remain future work.
- [Voice agents and child-directed development](topics/voice-agents.md): proposed
  companion NPC and voice-driven builder sessions; the first direction to explore
  is turning a child's request into development, clarification and playable changes.
- [In-game play ideas / voice feedback](topics/play-ideas.md): original STT or
  typed submissions and game screenshots live in the private
  [Workshop → Play ideas inbox](https://tilefun.graehlarts.com/tilefun/workshop.html#/play-ideas),
  backed by `data/workshop/play-ideas/*.json` by default. Read that inbox for
  new child/playtester feedback; keep private submissions out of Git.
- [Playtester feedback](todo-from-playtesters.md): flower picking, bouquets and
  trading; autonomous mounts; riding cars; mount protection; ghost limits and
  safe streets. These are recorded requests, not verified implementation status.
- [Vision](VISION.md): creature collection, farming, tycoon and other experiences;
  economy, world ownership, AI-assisted creation and longer-term federation.
- [Sprite inventory](SPRITE-INVENTORY.md): animals, vehicles, characters and props
  available for future integration. Inventory does not imply playable behavior.
- Enterable playground tubes, richer entity behavior, mass-spawn UX and entity
  persistence improvements.
- More curated furniture/props and natural brushes: gardens, forest clusters
  and further tree families. Current drawing work lives in
  [patterns and interiors](topics/patterns-and-interiors.md).
- [Natural overworld landscapes](topics/natural-landscapes.md): forests, scattered
  wild trees, solid patterned thickets and small ponds throughout eligible land,
  including inter-town train scenery; explorer/lab preview is ready for composition
  review, with cliffs and mesas later.
- City follow-ons: farmers markets, connected large parks, more frontage
  orientations and additional room layouts. See the living-world ideas below and
  [city generation](topics/city-generation.md) for dependencies and review gates.

## Living world and inhabitants

Owner direction, 2026-10-10: prioritize familiar animals now that the existing
wildlife roster lives in the world. Cats and dogs are accepted work in
[084](tactical/084-common-pets-and-variations.md); other expansion stays backlog.

- Pets: ginger/gray tabby, black and calico cats; golden and black Labradors or
  retrievers, pointed-ear shepherds and short-legged corgis/dachshunds. Coat
  variations first, distinct body shapes next; puppies/kittens and long-haired
  cats need their own proportions rather than scaled adult sprites.
- Neighborhood birds: sparrow, pigeon and crow first; pigeon colors, blackbird,
  blue tit and great tit later.
- Garden insects: bumblebee, honeybee, ladybug, butterfly wing patterns and
  dragonfly. Bee already exists in the historical roster, without a ready draft.
- Familiar small animals: hedgehog, field mouse, squirrel and snail; rabbit coats
  and gray squirrel alongside red squirrel.
- Farm/pond variety: chicken, donkey and pond turtle; hen/rooster/chick, female
  mallard/duckling and goose.
- Missing named roster entries: goose, swan, blackbird, blue/great tit, budgie,
  cockatiel, ferret and distinct bumblebee; explicit coat/breed/age variants.

Suggested order after pets: neighborhood birds, garden insects, familiar small
animals, then farm/pond variety. The old 196-entry exotic-animal backlog is not
an active production target.

Ideas requested by the project owner on 2026-10-03; uncommitted and unordered.

- Moving cars that travel along roads. [Source audit and proposed approach](research/road-vehicles.md)
  records four-direction car/bus art; inside driving is delivered in 087.
- Generated railways connecting town stations, with two-way local service,
  longer regional trunks, high-speed lines, forks, bridges and tunnels.
  [Trains](topics/trains.md) routes the source findings and parent plan. The owner
  clarified that generated infrastructure is the target, rather than player-built
  routes; layout and structure feasibility precede runtime implementation.
- People inside buildings, as well as out on the streets.
- Families that live in houses, potentially with Sims-style household behavior.
  Explore `~/code/playbox` as a reference before choosing a design.
- Multi-floor buildings with steps/stairs and elevators connecting floors.
- Weather patterns and day/night cycles; possibly seasons as a later extension.
- Naturally spawning wildlife, taking inspiration from the ecology in
  `~/code/mclone`.
- More art and wildlife characters, aiming for breadth comparable to mclone's
  Blender-made roster. Use `~/code/mclone` as a reference for both variety and
  the Blender workflow; new Tilefun art still follows the existing
  [art review](topics/art-review.md) process.

## Local multiplayer and controllers

Ideas requested by the project owner on 2026-10-03; the play mode and camera
choices remain open.

- Local multiplayer with split-screen or a shared screen.
- For shared-screen play, explore automatic following and rubber-banding to
  keep players together.
- Controller support suitable for local co-op. Optional gamepad support already
  exists according to the [README](../README.md); assess and extend it for these
  play modes rather than treating controller input as wholly new work.

## Presentation and usability

- [Visual polish catalog](VISUAL-POLISH.md): proposed effects by cost/impact;
  older implementation labels need verification before selecting work.
- Beach chain (deep water → shallow → sand → light sand → grass) and animated
  water autotiles.
- [Tap to move and accessible Options](tactical/086-tap-to-move-and-options.md):
  owner request, 2026-10-10, for children around two or three. First slice
  implemented: tap a destination, walk straight toward it, stop at obstacles, and
  choose Tap to move or Joystick in a simple mobile-friendly Options panel.
  Pathfinding and a broader settings redesign are deferred.
- Safety nets for destructive terrain/world-clearing actions beyond the existing
  saved-world deletion confirmation.

## Engine, hosting and distribution

- [Terrain heights and stacked spaces](topics/world-geometry.md): 2026-10-04
  requests for tile-based mountain slopes, ramps into underground and above-ground
  parking garages, bridges and tunnels. Explore constrained surfaces/sectors;
  no voxel engine or mandatory solid-volume authoring is requested.
- [Entity activation, AI and unloading](topics/entity-activation.md): known
  technical debt around distant simulation, placed-entity residency and physics
  passes that bypass AI tick tiers; measurement and improvement backlog.
- [Engine capability map](ENGINE-ARCHITECTURE-CHECKLIST.md): current foundations
  and remaining infrastructure candidates, with the original checklist archived.
- Better multiplayer reconnect UX;
  public-server authentication/access controls and hosting dependency tradeoffs.
  See [networking status](topics/multiplayer-networking.md) and
  [server security](SERVER-SECURITY.md).
- Asset obfuscation proposal: store purchased art as XOR-encoded `.enc` files
  and decode to ignored PNGs during builds. This was a backlog idea, offers no
  real DRM, and is not the current committed-assets build workflow.
- P2P Worker hosting or WASM only when justified by measured needs; see
  [performance](topics/performance.md).

## Deferred networking investigation

Explicitly deferred after the [ordered-delivery fix](tactical/015-webrtc-ordered-delivery.md).
Current gameplay uses reliable ordered sync; this investigation is not a release
condition for the bounded bug fix. [Networking](topics/multiplayer-networking.md)
owns the current contract and evidence.

- Measure latency, congestion and large-transfer blocking before considering a
  return to unreliable entity traffic. Reopen when real play shows a problem.
- If justified, design recoverable baselines, entity lifecycle/field repair,
  ordering rules and realm/session epochs together. Tick filtering alone cannot
  repair missing state; maintain the existing regression cases as acceptance gates.
- Broaden testing to OS-level UDP impairment, WAN/NAT/TURN paths, mobile devices
  and supported browsers. The current loopback and channel-model tests do not
  establish those results.
- Evaluate bandwidth scheduling and unreliable input with resend windows only
  against measured needs; keep them out of the current correctness patch.

When choosing an idea, verify its current state, state the intended outcome in
the relevant topic, and create a bounded tactical if the work needs a plan.
Preserve attribution and mark the original item with a link when it is delivered
or rejected; don't let an old idea silently become an agent instruction.
