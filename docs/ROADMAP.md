# Roadmap

## Asset Protection
- Obfuscate purchased asset files (Modern Exteriors, Modern Interiors, Sprout Lands) so they aren't directly browsable/downloadable from the public GitHub repo
- Approach: store XOR-encoded `.enc` files in git, decode to `.png` at build time into a gitignored folder
- Not real DRM — just "don't be the lowest-hanging fruit"

## Gameplay
- Enterable structures: custom collision shapes so player can walk inside playground tubes
- Entity polish: more behaviors, mass-spawn UX, entity persistence improvements
- Props system: placeable static objects (trees, flowers, furniture, fences, signs) — distinct from entities and terrain
- Specialized natural brushes: tree formation brush, garden plot prefab, forest cluster stamp

## World Management
- Create new world, switch between saved worlds (menu UI)
- Safety net for destructive actions (clear world)
- Basic menu system beyond debug panel + play/edit toggle

## Terrain
- Beach chain: deep water → shallow → sand → sand_light → grass via 4-sheet chain
- Water animation: animated water autotile overlay

## Multiplayer
- LAN co-op: parent edits world while kid plays in it
- Internet multiplayer over WebSocket (state sync, conflict resolution, auth, NAT traversal) — prerequisite for below
- WebRTC unreliable data channel for internet play (optional, progressive enhancement)
  - Rust sidecar using [webrtc-unreliable](https://github.com/kyren/webrtc-unreliable) — single static binary, no Node native deps
  - Proxies only UDP-like position/movement packets; all reliable state stays on WebSocket
  - Client connects WebSocket first (always works), optionally negotiates data channel through Rust bridge, falls back gracefully
  - Avoids TCP head-of-line blocking at 30-100ms RTT; not needed for LAN
  - Node WebRTC bindings (node-datachannel etc.) are fragile C++ deps — Rust binary is cleaner

## UX / Accessibility
- Simplified controls for young children (single-finger input, touch, gamepad)
