# Roadmap

## Regional Generation and World Explorer

- Implemented: versioned Classic/Island/Flat/Regional generators, bounded map and exact tile previews, shared district and countryside plans, authoritative Play here arrivals, persistent building interiors, and generated inhabitants. See the [regional plan](tactical/004-world-explorer-and-regional-generation-plan.md) and [generator plan](tactical/005-generator-profiles-and-shared-tile-preview-plan.md) for implementation evidence.
- Next: visual review of seed 2026 and other seeds, followed by density/composition tuning. Use the [checkpoint guide](world-explorer.md).
- Still outstanding: profiling on a representative physical phone; automated phone layouts and desktop CPU throttling are separate evidence.
- Future extensions: additional floors, room layouts, inhabitants' schedules, traffic, and economies.

## Asset Protection
- Obfuscate purchased asset files (Modern Exteriors, Modern Interiors, Sprout Lands) so they aren't directly browsable/downloadable from the public GitHub repo
- Approach: store XOR-encoded `.enc` files in git, decode to `.png` at build time into a gitignored folder
- Not real DRM — just "don't be the lowest-hanging fruit"

## Gameplay
- Enterable structures: custom collision shapes so player can walk inside playground tubes
- Entity polish: more behaviors, mass-spawn UX, entity persistence improvements
- Build on the existing terrain/prop/furniture editors with more curated placeable objects
- Specialized natural brushes: tree formation brush, garden plot prefab, forest cluster stamp

## World Management

- Implemented: world creation with pinned generator settings, saved-world switching, naming, deletion with confirmation, and multiplayer realm browsing.
- Remaining: a safety net for destructive terrain/world-clearing actions, beyond the existing world-deletion confirmation.

## Terrain
- Beach chain: deep water → shallow → sand → sand_light → grass via 4-sheet chain
- Water animation: animated water autotile overlay

## Multiplayer

- Implemented: collaborative editing and co-op through browser-hosted P2P or a dedicated server, WebSocket transport, and optional dedicated WebRTC with reliable sync and an unreliable entity channel. See the [network architecture](NETWORK-ARCHITECTURE.md).
- Next: validate dedicated dual-channel WebRTC under more real-world network conditions and improve connection/reconnection UX.
- Future public-server work: authentication and access controls; existing player profile identity is separate from authentication.
- Revisit native WebRTC dependency/deployment tradeoffs when choosing supported hosting targets.

## UX / Accessibility
- Implemented: touch joystick/buttons and gamepad input.
- Next: simplify the interaction flow for young children, including single-finger input where appropriate.
