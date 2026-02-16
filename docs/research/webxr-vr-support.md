# WebXR VR Support — Architecture & Pain Points

## Current State (Feb 2025)

We have basic immersive VR working on Meta Quest via the WebXR API:

- Game canvas rendered onto an `XRQuadLayer` (virtual screen floating in 3D space)
- Left controller thumbstick → movement (via `XRInputSource.gamepad` axes)
- Right controller face buttons → sprint/jump, trigger → throw
- Game loop driven by `XRSession.requestAnimationFrame` (replaces page rAF)
- Canvas hidden during VR (`visibility: hidden`); only the QuadLayer is visible in headset

This gives a functional "play on a virtual TV" experience. Movement, entities, physics, audio all work.

## The DOM Problem

**Core issue:** All game UI is DOM-based (HTML elements with CSS positioning), but VR only sees the canvas.

The `texImage2D` blit captures canvas pixels only. DOM elements (`position: fixed` overlays) are composited by the browser on top of the canvas in the normal viewport, but they are **not** part of the canvas bitmap. In VR, they're invisible.

**What's invisible in VR:**
- Hamburger menu button and slide-out panel
- Editor panel (terrain/road/structure/entity tabs, palette, brush controls)
- Main menu / world browser
- Debug panel, console UI
- Chat HUD input (the rendered chat bubbles ARE canvas-drawn and visible)
- Any DOM-based modal or overlay

**What IS visible in VR:**
- Everything drawn via `ctx` on the game canvas: world, entities, particles, gem HUD, chat bubbles
- Touch buttons/joystick (canvas-drawn, though we hide them in VR since controllers replace them)

This is the classic reason games build their own UI systems instead of relying on platform UI: **portability**. DOM works perfectly for browser viewport rendering but breaks the moment the render target changes (VR, video capture, remote streaming, screenshot).

## Controller Pointer (Raycasting)

Even without DOM UI, we want the right controller to act as a mouse pointer on the virtual screen for canvas-based interactions (clicking entities, editor painting).

### How It Works

1. **Get the ray**: `frame.getPose(inputSource.targetRaySpace, refSpace)` gives origin + orientation (quaternion). The ray direction is the -Z axis of the transform.

2. **Ray-plane intersection**: The quad is axis-aligned at `z = -SCREEN_DISTANCE_M`, centered at `(0, SCREEN_HEIGHT_M)`. The intersection simplifies to:
   ```
   t = (-SCREEN_DISTANCE_M - origin.z) / direction.z
   hitX = origin.x + t * direction.x
   hitY = origin.y + t * direction.y
   ```
   Then map `(hitX, hitY)` to quad-local UV → canvas pixel coordinates.

3. **Dispatch synthetic events**: Create `PointerEvent` / `MouseEvent` with the computed canvas coordinates and dispatch on the canvas element. Existing `mousedown`/`mousemove`/`mouseup` handlers in `EditorMode` fire as normal.

4. **Visual feedback**: Draw a laser line from controller to hit point, and a cursor dot on the canvas at the pointer position. Only show when the ray intersects the quad.

5. **Trigger = click**: Use XR `selectstart`/`selectend` events (or poll `buttons[0]`) for pointer down/up.

### Complications

- **Synthetic events are untrusted**: `event.isTrusted === false`. Most game handlers don't check this, but some browser APIs (fullscreen, clipboard) require trusted events.
- **`getBoundingClientRect` returns zero** for a hidden canvas. The `canvasCoords()` helper in EditorMode uses `rect.left/rect.width` — would need a bypass for VR (canvas dimensions are known, offset is 0,0).
- **Scroll emulation**: Right thumbstick could map to `WheelEvent` for scrollable panels (sprite atlas), but this only helps canvas-drawn scrollable areas, not DOM scrollable elements.
- **Coordinate mapping must account for canvas vs client coordinates**: In VR we bypass CSS layout entirely, so canvas coords = pixel coords directly.

## Paths Forward

### Path 1: VR = Play Mode Only (minimal effort)

Accept that VR is for playing, not editing. This actually matches the primary use case (6-year-old plays in VR, parent edits on desktop/tablet).

**Scope:**
- Implement controller pointer for canvas click-to-interact (talk to NPCs, etc.)
- Draw a simple "Exit VR" indicator on canvas (or bind to controller combo like both grips)
- No editor, no menus in VR
- Parent can edit the world on a separate device via multiplayer

**Effort:** Small — just the raycasting + event dispatch (~100 lines in XRSessionManager).

### Path 2: Canvas-Drawn VR Menu (medium effort)

Add a minimal VR-specific menu rendered directly on the canvas, triggered by a controller button (e.g. left menu button or grip).

**Scope:**
- Radial or grid menu drawn on canvas: Play / Edit / Exit VR / Debug toggle
- In edit mode, draw a simplified tool palette on canvas (terrain type grid, brush size)
- No full editor panel — just enough to paint terrain and place entities
- Could reuse the touch button rendering pattern (semi-transparent overlays)

**Effort:** Medium — new canvas UI code for the VR menu + simplified editor palette. Doesn't require architectural changes.

### Path 3: Retained-Mode Canvas UI System (large effort, long-term)

Build a proper UI framework that renders to canvas instead of DOM. All game UI migrates to this system, making it portable across all render targets.

**Scope:**
- UI primitives: buttons, panels, scroll views, text input, dropdowns
- Layout system (flexbox-like or constraint-based)
- Hit testing, focus management, keyboard/pointer input routing
- Theme/styling system
- Migrate editor panel, menus, debug panel, console UI

**Effort:** Very large — essentially building a UI toolkit. But it solves the problem permanently and also enables:
- Video recording / streaming that includes UI
- Screenshot capture with UI
- Consistent look across platforms
- No DOM dependency (could run in Node for headless testing)

**Prior art:** Roblox's `ScreenGui`/`Frame`/`TextButton` system, Godot's Control nodes, Dear ImGui.

### Path 4: DOM-to-Canvas Compositing (hacky, medium effort)

Before blitting to the QuadLayer, composite DOM elements onto the canvas.

**Options:**
- `html2canvas` library — captures DOM to canvas. Slow (~50-100ms), doesn't handle all CSS.
- `foreignObject` SVG trick — wrap HTML in SVG, draw to canvas via `drawImage`. CORS restrictions, inconsistent browser support.
- `OffscreenCanvas` + manual DOM reading — read element positions/styles and redraw them manually on canvas. Partial reimplementation of a browser.

**Verdict:** Fragile, slow, and incomplete. Not recommended as a long-term solution. Could work as a stopgap for specific elements (e.g., compositing the hamburger button onto the canvas).

### Path 5: WebXR DOM Overlay

The [WebXR DOM Overlays Module](https://www.w3.org/TR/webxr-dom-overlays-1/) allows a DOM element to be rendered on top of the XR scene with pointer event support from controllers.

```js
navigator.xr.requestSession("immersive-vr", {
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["layers", "dom-overlay"],
  domOverlay: { root: document.getElementById("game-container") }
});
```

**Pros:**
- Browser handles rendering DOM into VR and routing controller input to DOM events
- Existing DOM UI would work with no changes

**Cons:**
- **Primarily designed for AR**, not immersive VR. Support in immersive-vr is inconsistent.
- Quest Browser support is unclear / limited for immersive-vr sessions.
- May conflict with QuadLayer rendering (DOM overlay is a separate composition layer).
- DOM overlay is always head-locked (follows your view), not world-anchored like our QuadLayer.
- May not work at all with our architecture (hidden canvas + QuadLayer blit).

**Verdict:** Worth a quick experiment to see if Quest Browser supports `dom-overlay` in `immersive-vr`. If it works, it's the lowest-effort solution. If not, don't fight it.

## Recommendation

**Short term (now):** Path 1 — VR is play mode only. Implement controller pointer for canvas interactions. This is already valuable.

**Medium term:** Path 2 — Canvas-drawn VR menu for basic mode switching. Small, self-contained.

**Long term:** Path 3 — Retained-mode canvas UI. This is inevitable if VR editing, video recording, or headless rendering become priorities. Start with the editor palette (already the most-requested VR feature from playtesting) and expand from there.

**Skip:** Path 4 (too hacky). **Experiment with:** Path 5 (might get lucky, but don't depend on it).

## Technical Notes

### XR Input Source Layout (Quest Touch v3)

Per controller, `xr-standard` gamepad mapping:
| Index | Type | Left | Right |
|-------|------|------|-------|
| axes[0] | Touchpad X | — | — |
| axes[1] | Touchpad Y | — | — |
| axes[2] | Thumbstick X | Movement X | Pointer/scroll X |
| axes[3] | Thumbstick Y | Movement Y | Pointer/scroll Y |
| buttons[0] | Trigger | (unused) | Click / Throw |
| buttons[1] | Squeeze/Grip | (unused) | (unused) |
| buttons[2] | Touchpad | — | — |
| buttons[3] | Thumbstick press | (unused) | (unused) |
| buttons[4] | A / X face button | (unused) | Sprint |
| buttons[5] | B / Y face button | (unused) | Jump |

**Note:** Actual button indices may vary. The periodic console logging (`[tilefun:xr] frame N: ...`) reports real-time axes/button state — use it to verify mappings on hardware.

### Key API References

- `XRInputSource.targetRaySpace` — ray origin + direction for pointing
- `XRFrame.getPose(space, baseSpace)` — get spatial pose (position + orientation)
- `XRSession` events: `selectstart`, `select`, `selectend` — trigger press/release
- `XRRigidTransform.orientation` — quaternion; multiply by `[0, 0, -1, 0]` to get ray direction
- `XRQuadLayer` transform — defines the quad's position in 3D space (used for ray intersection)

### Canvas Coordinate Mapping

For a quad at `(0, SCREEN_HEIGHT_M, -SCREEN_DISTANCE_M)` with width `SCREEN_WIDTH_M` and height `SCREEN_WIDTH_M / aspect`:

```
u = 0.5 + hitX / SCREEN_WIDTH_M          // 0..1 left-to-right
v = 0.5 - (hitY - SCREEN_HEIGHT_M) / quadH  // 0..1 top-to-bottom
canvasX = u * canvas.width
canvasY = v * canvas.height
```

Pointer is on-screen when `u ∈ [0,1]` and `v ∈ [0,1]` and `t > 0`.
