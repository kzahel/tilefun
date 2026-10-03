# Ideas and backlog

Uncommitted possibilities, not an ordered implementation plan. The
[roadmap](ROADMAP.md) owns near-term direction; [topics](topics/README.md) own
current decisions and [tacticals](tactical/README.md) own accepted slices.
Keep original feedback and detailed catalogs at their linked source instead of
copying every item into multiple checklists.

## Gameplay and creation

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
- City follow-ons: farmers markets, connected large parks, more frontage
  orientations and additional room layouts. See the living-world ideas below and
  [city generation](topics/city-generation.md) for dependencies and review gates.

## Living world and inhabitants

Ideas requested by the project owner on 2026-10-03; uncommitted and unordered.

- Moving cars that travel along roads. [Source audit and proposed approach](research/road-vehicles.md)
  records four-direction car/bus art and a suggested first slice; driving is not implemented.
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
- Simpler child-friendly interaction, including single-finger input where useful.
- Safety nets for destructive terrain/world-clearing actions beyond the existing
  saved-world deletion confirmation.

## Engine, hosting and distribution

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
