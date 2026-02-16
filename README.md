# Tilefun

**Mario Maker meets Zelda, for little kids, extensible with AI.**

A creative-mode-first 2D tile game — paint terrain, place entities, hit play, and live in the world you built. Seamless edit/play toggle, no scripting required. Designed for young children and parent co-op.

**Play it live:** https://kyle.graehl.org/tilefun | **Dev log:** https://kyle.graehl.org/tilefun-devlog/

<video src="https://github.com/user-attachments/assets/038140dd-e987-4f71-8ec4-8fa5425dba1d" controls muted playsinline width="400"></video>

## Features

- **Multiplayer** — Peer-to-peer via WebRTC (one browser hosts, others connect via URL — no server needed) or run a zero-dependency dedicated Node server. Parent crafts the world while the kid plays in it
- **Collaborative editing** — See other players' editor cursors in real time, paint terrain together
- **Configurable physics** — QuakeWorld-style friction and acceleration system. Tune CVars per-surface for ice skating, bouncy floors, or set friction/accel to 100 for traditional RPG movement. Mario-style stomp and bunny hopping built in
- **2.5D height system** — 3D AABB collisions, walkable surfaces, cliff-edge falling, stair-step props, and a debug 3D renderer for visualizing collision volumes
- **Client-side prediction** — Input replay reconciliation for responsive movement even over high-latency connections, including mount prediction
- **Interactive entities** — Birds, fish, chickens, cows, campfire, ball, and more — ride mounts, stomp enemies, befriend animals that follow you, collect gems
- **Full terrain editor** — 26 terrain types with blob autotile (47-variant bitmask) on a dual-grid system, roads, sidewalks, elevation tiles, and procedural road network generation
- **Props** — Placeable objects on terrain (trees, playground structures, stairs) with 3D collision
- **Quake-style debug console** — CVars, commands, tab completion, and RCON protocol for remote server control
- **Audio and particles** — Sound effects and visual particle system
- **Touch and gamepad** — On-screen touch controls and optional gamepad support for mobile and controllers
- **Roblox-inspired experience API** — Streamlined server-side scripting with tags, events, tick hooks, and overlap detection. Core sample experiences demonstrate the API; creative sandbox is the base gameplay mode. See the [vision doc](docs/VISION.md) for the full roadmap (creature collector, farming sim, tycoon, and more)
- **Player profiles & persistence** — Worlds and player data saved to IndexedDB in the browser, or to disk when running the dedicated Node server

## Asset Credits

- **Modern Exteriors** by LimeZu — [itch.io](https://limezu.itch.io/modernexteriors)
- **Modern Interiors** by LimeZu — [itch.io](https://limezu.itch.io/moderninteriors)
- **Sprout Lands** by Cup Nooble — [itch.io](https://cupnooble.itch.io/sprout-lands-asset-pack)
