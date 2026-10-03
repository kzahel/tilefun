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
  orientations, additional floors/room layouts, schedules and moving traffic. See
  [city generation](topics/city-generation.md) for dependencies and review gates.

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
- Broader dedicated dual-channel WebRTC testing and better reconnect UX;
  public-server authentication/access controls and hosting dependency tradeoffs.
  See [networking status](topics/multiplayer-networking.md) and
  [server security](SERVER-SECURITY.md).
- Asset obfuscation proposal: store purchased art as XOR-encoded `.enc` files
  and decode to ignored PNGs during builds. This was a backlog idea, offers no
  real DRM, and is not the current committed-assets build workflow.
- P2P Worker hosting or WASM only when justified by measured needs; see
  [performance](topics/performance.md).

When choosing an idea, verify its current state, state the intended outcome in
the relevant topic, and create a bounded tactical if the work needs a plan.
Preserve attribution and mark the original item with a link when it is delivered
or rejected; don't let an old idea silently become an agent instruction.
