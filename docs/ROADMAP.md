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

## UX / Accessibility
- Simplified controls for young children (single-finger input, touch, gamepad)
