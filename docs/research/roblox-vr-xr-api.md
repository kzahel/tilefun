# Roblox VR/XR API Surface — Full Report

Based on local reference at `~/code/reference/roblox/creator-docs/` (Feb 2025).

## 1. Architecture: Native OpenXR (Not WebXR)

Roblox uses **native OpenXR** as the unified backend — no WebXR involvement at all. This gives them direct access to headset APIs without browser sandboxing. Supported hardware:

| Device | Connection |
|--------|-----------|
| Meta Quest 2/3/Pro | **Standalone** (native Quest app) or PC Link |
| Oculus Rift/Rift S | PC |
| HTC Vive | PC (SteamVR) |
| Valve Index | PC (SteamVR) |

The standalone Quest app is a big deal — experiences just work on Quest without a PC. There's also a Studio VR Emulator (Quest 2/3 device profiles) so devs can test without hardware.

## 2. VRService — The Core API

`VRService` is the primary service experience creators interact with. Everything lives here.

### Properties (creator-configurable)

| Property | Type | What It Does |
|----------|------|-------------|
| `VREnabled` | bool (read-only) | Is the user on a VR headset? The fundamental branch point. |
| `AutomaticScaling` | `VRScaling` | Adjusts `Camera.HeadScale` so the player sees from their avatar's eye height. `World` (auto) or `Off`. |
| `AvatarGestures` | bool | Avatar IK — head and hands follow real body. Other players see your gestures. |
| `ControllerModels` | `VRControllerModelMode` | Show controller models in-world: `Disabled` or `Transparent`. |
| `FadeOutViewOnCollision` | bool | Fades to black when your head clips geometry — prevents seeing through walls. |
| `LaserPointer` | `VRLaserPointerMode` | `Disabled`, `Pointer` (one hand), or `DualPointer` (both hands). |
| `GuiInputUserCFrame` | `UserCFrame` | Which device drives GUI interaction (Head, LeftHand, RightHand). |
| `ThirdPersonFollowCamEnabled` | bool (read-only) | Whether the comfort third-person camera is active. |

### Methods

| Method | Purpose |
|--------|---------|
| `GetUserCFrame(type)` | Get position+orientation of Head, LeftHand, RightHand, or Floor |
| `GetUserCFrameEnabled(type)` | Is this tracking source active? |
| `RecenterUserHeadCFrame()` | Reset head position to current physical location |
| `RequestNavigation(cframe, inputUserCFrame)` | Trigger teleport locomotion with a parabola visualizer |
| `SetTouchpadMode(pad, mode)` | Configure touchpad behavior per-hand |
| `GetTouchpadMode(pad)` | Query current touchpad mode |

### Events

| Event | Fires When |
|-------|-----------|
| `UserCFrameChanged(type, cframe)` | Any tracked device moves — **every frame**, so this is your hand/head tracking loop |
| `UserCFrameEnabled(type, enabled)` | Tracking source comes online/offline |
| `NavigationRequested(cframe, inputUserCFrame)` | Teleport navigation was requested |
| `TouchpadModeChanged(pad, mode)` | Touchpad config changed |

### Supporting Enums

- **`UserCFrame`**: `Head` (0), `LeftHand` (1), `RightHand` (2), `Floor` (3)
- **`VRTouchpad`**: `Left` (0), `Right` (1)
- **`VRTouchpadMode`**: `Touch` (button mapping), `VirtualThumbstick` (joystick emulation), `ABXY` (4-way pie)
- **`VRComfortSetting`**: `Comfort`, `Normal`, `Expert`, `Custom` — user-chosen presets
- **`VRSafetyBubbleMode`**: `NoOne`, `OnlyFriends`, `Anyone` — personal space boundary
- **`VRDeviceType`**: `Unknown`, `OculusRift`, `HTCVive`, `ValveIndex`, `OculusQuest`
- **`VRSessionState`**: `Undefined`, `Idle`, `Visible`, `Focused`, `Stopping`

## 3. Camera — VR-Specific Behavior

The `Camera` class has three VR-specific properties:

| Property | What It Does |
|----------|-------------|
| `HeadLocked` (bool) | When true, camera auto-combines `Camera.CFrame` with head tracking. Enables latency optimizations. Most experiences leave this on. |
| `HeadScale` (float) | World scale factor. 1 stud = `0.3m / HeadScale`. Controlled by `VRService.AutomaticScaling` or manually. Changing this makes you feel giant or tiny. |
| `VRTiltAndRollEnabled` (bool) | Whether head tilt/roll affects the view. **Off by default** to prevent motion sickness (keeps horizon level). |

Key method: **`Camera:GetRenderCFrame()`** returns the actual rendered CFrame including VR head transform. In VR, `Camera.CFrame` alone is NOT what the user sees — you must use `GetRenderCFrame()` for the true eye position.

Built-in camera modes:
- **3rd-person comfort** — camera teleports to keep player in view (no smooth follow)
- **1st-person** — standard head-tracked first person
- **Vehicle camera** — adapted for seated VR
- Creators can write custom camera scripts in `CameraModule` within `PlayerScripts`

## 4. Comfort System

Roblox has a **user-controlled comfort tier** system — the user picks their comfort level, and experiences should respect it:

| Setting | Comfort | Normal | Expert |
|---------|---------|--------|--------|
| Vignette (peripheral darkening during motion) | Strong | Medium | Off |
| Stepped Rotation (snap-turn vs smooth) | On | On | Off |
| 3rd Person Fixed Camera | On | Off | Off |

This is notable because it's **user-driven, not developer-driven**. The experience creator doesn't force comfort settings — the user chooses. Creators can query the state but shouldn't override it.

## 5. Input & Interaction

### UserInputService (VR extensions)

`UserInputService` mirrors some VRService functionality:
- `UserHeadCFrame` — head position/orientation
- `VREnabled` — headset detection
- `GetUserCFrame(type)` / `RecenterUserHeadCFrame()` — same as VRService versions
- `UserCFrameChanged` event — same as VRService

### DragDetector (6DOF VR interaction)

This is Roblox's solution for "grab and move things in VR":
- `DragStyle.BestForDevice` automatically uses **6DOF** for VR (full position + rotation)
- `VRSwitchKeyCode` — modifier key to toggle between primary/secondary drag modes
- Events include `cursorRay` parameter with the VR hand CFrame
- Works automatically — no VR-specific code needed if you use DragDetector

### Input Action System

The newer `InputAction` system is platform-agnostic. VR controllers map to gamepad-style inputs. The recommended approach is to use InputAction bindings rather than checking raw input types — this way your experience works on keyboard, gamepad, touch, AND VR without branching.

## 6. UI in VR — The Pain Point

This is where Roblox's docs get **thin**. The actual guidance amounts to:

**ScreenGui** — Renders as a floating panel in VR. Does NOT fill the viewport. Developers have limited control over its VR positioning. The VR UI Update (Build 545) changed how `PlayerGui` renders and added a `BottomBar`, but documentation is sparse.

**SurfaceGui** — Renders on 3D surfaces (diegetic UI). Works in VR but:
- "Complex SurfaceGuis can be costly" — performance warning in the docs
- No built-in laser-pointer-to-SurfaceGui interaction out of the box (developers build it)

**BillboardGui** — Always faces camera. Useful for nametags, health bars, spatial labels in VR.

**What's NOT documented**:
- No "VR UI design patterns" guide
- No guidance on ScreenGui layout adaptation for VR
- No recommended approach for VR menus
- No spatial/world-anchored UI system docs

This matches what the community forums show — VR UI is the biggest pain point for Roblox experience creators, and the official docs don't provide much help.

## 7. Performance Guidance

The VR guidelines doc gives these tips:
- Enable **instance streaming** (LOD/culling)
- Avoid CPU-heavy raycasting
- Use `RunService` instead of `task.wait()` for frame-coupled logic
- Minimize draw calls and semi-transparent objects
- Optimize SurfaceGuis (expensive to render)
- Target **72 fps minimum** on Quest (Auto Quality Mode helps)
- Test on Quest 2 (lowest common denominator)

No VR-specific profiling tools documented. General Studio profiler is the only option.

## 8. What's NOT in the Docs

Notable gaps:
- **No hand tracking** — controller-only, no native hand tracking API
- **No spatial audio VR guide** — audio docs don't cover VR spatialization
- **No IK system details** — AvatarGestures is a boolean toggle, no docs on the underlying IK
- **No multiplayer VR considerations** — nothing about VR player-to-player interaction patterns
- **No VR accessibility** — accessibility docs skip VR entirely
- **No WebXR** — completely native, no browser path
- **No AR/passthrough** — no mixed reality APIs documented

## 9. Relevance to Tilefun

### What to steal from Roblox's design

1. **`VREnabled` as the branch point** — Simple boolean check, adapt from there. We're already doing this with `xrSession` presence.

2. **User-controlled comfort settings** — Vignette, snap-turn, comfort presets. Worth implementing (especially vignette — cheap to render on canvas, big comfort improvement).

3. **`HeadScale` concept** — Our pixel-art world needs a scale factor so 16px tiles feel right in VR. Roblox auto-scales to avatar eye height; we'd scale to make the tile world feel like a miniature diorama or a life-size world.

4. **`FadeOutViewOnCollision`** — Fade to black on head clip. Simple and prevents nausea. Easy to implement with a canvas overlay.

5. **DragDetector's `BestForDevice` pattern** — Don't branch on input type everywhere. Have one interaction system that adapts. Our synthetic PointerEvent approach is exactly this.

6. **Laser pointer as a first-class concept** — Roblox has `VRLaserPointerMode` with Disabled/Pointer/DualPointer. Our raycasting plan maps directly to `Pointer` mode.

### Where we have advantages over Roblox

1. **Canvas-rendered gameplay** — Everything visible in VR is already on the canvas. Roblox has to deal with a 3D scene graph + multiple GUI layers. We blit one texture.

2. **Zero install, link sharing** — WebXR means Quest Browser → URL → playing. Roblox requires app install.

3. **We control all UI** — Roblox can't break millions of existing ScreenGuis. We can make clean decisions about what renders where.

4. **2D game = simpler VR** — No head-coupled 3D camera needed. Our "virtual TV" approach is actually the right UX for a 2D tile game. Roblox has to solve full 3D VR, which is vastly harder.

### What Roblox's gaps tell us

The fact that Roblox — with a massive team and native renderer access — **still hasn't solved VR UI well** validates our Path 1 (play-only) and Path 2 (canvas-drawn VR menu) strategy. Don't try to solve the general VR UI problem. Ship the fun part (playing in VR) and iterate.

## Source Files

Key files from `~/code/reference/roblox/creator-docs/content/en-us/`:
- `production/publishing/vr-guidelines.md` — Main VR guide
- `reference/engine/classes/VRService.yaml` — VRService API
- `reference/engine/classes/Camera.yaml` — Camera VR properties
- `reference/engine/classes/UserInputService.yaml` — VR input
- `reference/engine/classes/DragDetector.yaml` — 6DOF VR interaction
- `reference/engine/enums/UserCFrame.yaml` — Device tracking enum
- `reference/engine/enums/VRComfortSetting.yaml` — Comfort presets
- `studio/testing-modes.md` — VR emulation & testing
- `ui/3D-drag-detectors.md` — DragDetector usage guide
- `ui/in-experience-containers.md` — SurfaceGui/BillboardGui
- `production/publishing/adaptive-design.md` — Cross-platform input
