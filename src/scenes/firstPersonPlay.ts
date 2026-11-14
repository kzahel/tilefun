import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { FirstPersonControl } from "../client/FirstPersonControl.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { VIEW_DISTANCES } from "../config/firstPersonViewDistance.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import { furnitureDefinition } from "../interiors/FurnitureCatalog.js";
import { furnitureAsset, INTERIOR_WALL_TYPE } from "../interiors/GameplayInterior.js";
import { compileGameplayRoom, initialRoom } from "../interiors/GameplayRoom.js";
import { collectWorldSprites } from "../rendering/collectScene.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import { entityHeading } from "../rendering/EntityMeshPose.js";
import { chaseEye, type FirstPersonEye } from "../rendering/firstperson/FirstPersonCamera.js";
import type {
  FirstPersonInterior,
  InteriorFurnitureArt,
} from "../rendering/firstperson/FirstPersonInterior.js";
import type { SpriteItem } from "../rendering/SceneItem.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";

const EYE_FRACTION = 0.85;
const CHASE_DISTANCE = 96;
const CHASE_HEIGHT = 28;
/** Never fog closer than this, even while the streamed area is still widening. */
const MIN_DRAW_RADIUS = 160;

interface StreamCamera {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly zoom: number;
}

/** Half the shorter side of the fixed camera's streamed rectangle, in world pixels
 * (`Camera.getVisibleChunkRange` spans viewport / (PIXEL_SCALE · zoom)). */
export function streamedRadius(camera: StreamCamera): number {
  return Math.min(camera.viewportWidth, camera.viewportHeight) / (2 * PIXEL_SCALE * camera.zoom);
}

/** Highest fixed-camera zoom whose streamed rectangle reaches `radius` around its
 * centre; undefined before the viewport has a size. */
export function streamZoomFor(radius: number, camera: StreamCamera): number | undefined {
  const shortest = Math.min(camera.viewportWidth, camera.viewportHeight);
  return shortest > 0 ? shortest / (2 * PIXEL_SCALE * radius) : undefined;
}

/** Fog end: the chosen view distance, limited to what is actually streamed. */
export function firstPersonDrawRadius(chosen: number, camera: StreamCamera): number {
  return Math.max(MIN_DRAW_RADIUS, Math.min(chosen, streamedRadius(camera)));
}

/**
 * Tactical 229 glue, per fixed tick while play is drawn in first person: widen the
 * streamed area to the chosen view distance, apply look input and drop tap/hold
 * destinations (they come from the hidden fixed camera). Returns undefined
 * whenever the fixed view is shown.
 */
export function firstPersonTick(
  gc: GameContext,
  dt: number,
  vehicle: Entity | undefined,
): FirstPersonControl | undefined {
  const control = gc.firstPerson?.drawing ? gc.firstPerson : undefined;
  if (!control) return undefined;
  // The fixed camera keeps following the player, so its zoom sets the streamed area.
  const zoom = streamZoomFor(VIEW_DISTANCES[control.viewDistance], gc.camera);
  if (zoom !== undefined) gc.camera.zoom = Math.min(gc.camera.zoom, zoom);
  control.update(dt, vehicle ? entityHeading(vehicle) : undefined);
  gc.tapMovement?.cancel();
  gc.touchHold?.reset();
  return control;
}

/** Manual input turned by the camera heading; steering cars keep their own
 * vehicle-relative axes. `control` is firstPersonTick's result. */
export function firstPersonMovement<T extends { dx: number; dy: number }>(
  gc: GameContext,
  control: FirstPersonControl | undefined,
  vehicle: Entity | undefined,
  input: T,
): T {
  const vehicleAxes = !!vehicle && gc.carDriving === "steering";
  return control && !vehicleAxes ? control.movement(input) : input;
}

/** Displayed feet position and height, via the same interpolation as the scene collector. */
function displayed(e: Entity, alpha: number): { x: number; y: number; z: number } {
  const p = interpolatePosition(e.position, e.prevPosition, alpha);
  return { x: p.wx, y: p.wy, z: interpolateWz(e, alpha) ?? 0 };
}

/** Interior furniture artwork and anchoring from the gameplay catalog. */
function furnitureArt(type: string): InteriorFurnitureArt | undefined {
  const asset = furnitureAsset(type);
  if (!asset) return undefined;
  const definition = furnitureDefinition(asset);
  const rect = getModernInteriorsEntry(definition.key)?.rect;
  return (
    rect && {
      rect,
      anchor: definition.anchor,
      floor: definition.layer === "floor",
      wall: definition.layer === "wall",
    }
  );
}

/** The compiled room per control, rebuilt when the room identity or saved plan changes.
 * Replicated identity/plan objects are replaced on change, so references are checked
 * first and the JSON key only when they differ. */
const rooms = new WeakMap<
  FirstPersonControl,
  { identity: object; state: object | null; interior: FirstPersonInterior }
>();

/** Tactical 230 slice 2: the room the player is in, compiled as the fixed view compiles it. */
function currentInterior(
  gc: GameContext,
  control: FirstPersonControl,
): FirstPersonInterior | undefined {
  const identity = gc.stateView.interior;
  if (!identity) return undefined;
  const state = gc.stateView.roomState ?? null;
  const cached = rooms.get(control);
  if (cached?.identity === identity && cached.state === state) return cached.interior;
  const key = JSON.stringify([identity, state]);
  let interior = cached?.interior;
  if (interior?.key !== key) {
    const room = compileGameplayRoom(identity, state ?? initialRoom(identity));
    interior = { key, map: room.map, shellType: INTERIOR_WALL_TYPE, furniture: furnitureArt };
  }
  rooms.set(control, { identity, state, interior });
  return interior;
}

/**
 * Tactical 229 glue: draw the play view in first person when it is enabled and
 * loaded. Returns false to keep the fixed view (disabled, loading, failed to
 * load, or graphics lost). Indoors draws the room (230). Drivers get a chase camera behind their vehicle.
 */
export function renderFirstPerson(gc: GameContext, alpha: number): boolean {
  const control = gc.firstPerson;
  if (!control?.active) return false;
  const view = control.currentView();
  const { stateView, camera, view3d } = gc;
  const shown = stateView.presentedPlayerEntity ?? stateView.playerEntity;
  if (!view || !view3d || shown.id === -1) {
    control.hideView();
    return false;
  }
  const entities =
    gc.doorPresentation?.entities(stateView.entities, gc.realmId ?? null) ?? stateView.entities;
  const vehicle = occupiedVehicle(stateView.playerEntity, entities);
  let eye: FirstPersonEye;
  if (vehicle) {
    const target = displayed(vehicle, alpha);
    target.z += (vehicle.collider?.physicalHeight ?? 24) * 0.6;
    eye = chaseEye(target, control.look, CHASE_DISTANCE, CHASE_HEIGHT);
  } else {
    const feet = displayed(shown, alpha);
    const height = shown.collider?.physicalHeight ?? 24;
    eye = { ...feet, z: feet.z + height * EYE_FRACTION, ...control.look };
  }
  eye.z += control.lift;
  const drawRadius = firstPersonDrawRadius(VIEW_DISTANCES[control.viewDistance], camera);
  const interior = currentInterior(gc, control);
  const frame = control.frame;
  frame.presentationTime = gc.time?.presentationSeconds ?? 0;
  const items = frame.begin(false);
  let drawn = false;
  try {
    collectWorldSprites({
      // First person hides the viewer's own body; a driver is drawn inside the vehicle anyway.
      entities: vehicle ? entities : entities.filter((e) => e.id !== shown.id),
      props: stateView.props,
      world: stateView.world,
      alpha,
      cull: {
        left: eye.x - drawRadius,
        right: eye.x + drawRadius,
        top: eye.y - drawRadius,
        bottom: eye.y + drawRadius,
      },
      items,
      frame,
      // Casters carry their shadow shapes, as for the fixed view's depth pass (247).
      depthShadows: control.shadows,
    });
    const scene = {
      eye,
      world: stateView.world,
      realm: gc.realmId ?? null,
      props: stateView.props,
      sprites: items.filter((item): item is SpriteItem => item.kind === "sprite"),
      drawRadius,
      interior,
      shadows: control.shadows,
    };
    // The whole canvas, through the render host's own renderer (248).
    drawn = view3d.draw(undefined, (target) => view.render(scene, target));
  } finally {
    frame.release();
  }
  if (drawn) control.markDrawn();
  else control.hideView();
  return drawn;
}

/** Small aiming mark at the screen centre of the UI canvas. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const x = Math.round(width / 2),
    y = Math.round(height / 2);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 7, y - 2, 14, 4);
  ctx.fillRect(x - 2, y - 7, 4, 14);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 6, y - 1, 12, 2);
  ctx.fillRect(x - 1, y - 6, 2, 12);
  ctx.restore();
}
