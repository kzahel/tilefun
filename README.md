# Tilefun

**Mario Maker meets Zelda, for little kids, extensible with AI.**

A creative-mode-first 2D tile game — paint terrain, place entities, hit play, and live in the world you built. Seamless edit/play toggle, no scripting required. Designed for young children and parent co-op.

**Play it live:** https://kyle.graehl.org/tilefun

## Features

- **Multiplayer** — Dedicated server with LAN support, or peer-to-peer via WebRTC (no infrastructure needed — one browser hosts, others connect). Parent crafts the world while the kid plays in it
- **Collaborative editing** — See other players' editor cursors in real time, paint terrain together
- **Player profiles & persistence** — Worlds and player data saved to IndexedDB in the browser, or to disk when running the dedicated Node server
- **Full terrain editor** — 26 terrain types with blob autotile (47-variant bitmask) on a dual-grid system, roads, sidewalks, elevation tiles
- **2.5D** — Elevated terrain and entity heights with depth-aware rendering
- **Gameplay** — Gem collection, hostile ghosts, jumping, running
- **Entities** — Birds, fish, chickens, cows, campfire, worms, and more — spawn them, follow them, interact with them
- **Roblox-inspired mod API** — Server-side scripting with tags, events, tick hooks, and overlap detection. Write mods as plain TypeScript modules

## Asset Credits

- **Modern Exteriors** by LimeZu — [itch.io](https://limezu.itch.io/modernexteriors)
- **Modern Interiors** by LimeZu — [itch.io](https://limezu.itch.io/moderninteriors)
- **Sprout Lands** by Cup Nooble — [itch.io](https://cupnooble.itch.io/sprout-lands-asset-pack)
