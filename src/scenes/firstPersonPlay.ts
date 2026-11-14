import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { FirstPersonControl } from "../client/FirstPersonControl.js";
import { VIEW_DISTANCES } from "../config/firstPersonViewDistance.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import { controllerInput } from "../input/ControllerInput.js";
import { furnitureDefinition } from "../interiors/FurnitureCatalog.js";
import { furnitureAsset, INTERIOR_WALL_TYPE } from "../interiors/GameplayInterior.js";
import { compileGameplayRoom, initialRoom } from "../interiors/GameplayRoom.js";
import { collectWorldSprites } from "../rendering/collectScene.js";
import { entityHeading } from "../rendering/EntityMeshPose.js";
import type {
  FirstPersonInterior,
  InteriorFurnitureArt,
} from "../rendering/firstperson/FirstPersonInterior.js";
import type { SpriteItem } from "../rendering/SceneItem.js";
import type { SeatFrame } from "../session/DeviceSeats.js";
import type { View } from "../session/View.js";

/**
 * Seat 0's view while play shows it in first person (249), per fixed tick: apply
 * its look input and drop tap/hold destinations (they aim through the fixed
 * camera). Returns undefined whenever the fixed view is shown.
 */
export function firstPersonTick(
  gc: GameContext,
  dt: number,
  vehicle: Entity | undefined,
): View | undefined {
  const control = gc.firstPerson;
  const view = gc.view;
  if (!control || !view?.drawn3d) return undefined;
  control.update(
    view,
    dt,
    controllerInput.rightStick,
    vehicle ? entityHeading(vehicle) : undefined,
  );
  gc.tapMovement?.cancel();
  gc.touchHold?.reset();
  return view;
}

/** Manual input turned by the view's heading; steering cars keep their own
 * vehicle-relative axes. `view` is firstPersonTick's result. */
export function firstPersonMovement<T extends { dx: number; dy: number }>(
  gc: GameContext,
  view: View | undefined,
  vehicle: Entity | undefined,
  input: T,
): T {
  const vehicleAxes = !!vehicle && gc.carDriving === "steering";
  return view && gc.firstPerson && !vehicleAxes ? gc.firstPerson.movement(view, input) : input;
}

/** Where a seat shown in first person aims (a stationary throw); `view` is
 * firstPersonTick's result. */
export function firstPersonAim(
  gc: GameContext,
  view: View | undefined,
): { x: number; y: number } | undefined {
  return view ? gc.firstPerson?.forward(view) : undefined;
}

const STILL = { dx: 0, dy: 0 };

/**
 * Guests shown in first person (249): each frame's movement is turned by its own
 * view's heading, and the seat's look device turns that view. A pad looks with
 * its right stick. A keyboard guest has no look device, so on foot its left and
 * right keys turn instead of strafing. Steering cars keep vehicle axes.
 */
export function turnGuestFrames(gc: GameContext, frames: SeatFrame[], dt: number): SeatFrame[] {
  const control = gc.firstPerson;
  if (!control) return frames;
  for (const frame of frames) {
    const view = gc.session.views.find((v) => v.seat === frame.seat.seat);
    if (!view?.drawn3d) continue;
    const { vehicle, steering, locked } = frame.situation;
    const stick = frame.seat.input?.look?.();
    let manual = frame.sample.manual;
    if (!stick && !vehicle && !locked) manual = control.keyTurn(view, manual, dt);
    control.update(
      view,
      dt,
      stick && !locked ? stick : STILL,
      vehicle ? entityHeading(vehicle) : undefined,
    );
    if (!(vehicle && steering)) manual = control.movement(view, manual);
    frame.sample = { ...frame.sample, manual, steered: manual };
    frame.situation = { ...frame.situation, look: control.forward(view) };
  }
  return frames;
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

/** True when a view should be drawn in 3D this frame: its seat chose first
 * person, the host can draw 3D into its region and its scene has loaded. */
export function wantsFirstPerson(gc: GameContext, view: View): boolean {
  return !!view.look && !!gc.view3d && !view.region.mask && !!gc.firstPerson?.scene(view);
}

/**
 * Draw one view of play in first person (229, per view since 249) into its
 * region. Returns false to let the fixed view draw it (not chosen, loading,
 * failed to load, graphics lost, or the seat's body is not streamed yet).
 * Indoors draws the room (230). Drivers get a chase camera behind their vehicle.
 */
export function renderFirstPerson(gc: GameContext, view: View, alpha: number): boolean {
  const control = gc.firstPerson;
  const { stateView, view3d } = gc;
  const scene = control && wantsFirstPerson(gc, view) ? control.scene(view) : undefined;
  const seen = view.look && scene ? view.policy.eye?.(gc.session, view.look, alpha) : undefined;
  if (!control || !scene || !view3d || !seen) {
    control?.hide(view);
    return false;
  }
  const eye = { ...seen, z: seen.z + control.lift };
  const entities =
    gc.doorPresentation?.entities(stateView.entities, gc.realmId ?? null) ?? stateView.entities;
  const drawRadius = VIEW_DISTANCES[control.viewDistance];
  const interior = currentInterior(gc, control);
  const frame = control.frame;
  frame.presentationTime = gc.time?.presentationSeconds ?? 0;
  const items = frame.begin(false);
  let drawn = false;
  try {
    collectWorldSprites({
      // First person hides the viewer's own body; a driver is drawn inside the vehicle.
      entities: seen.own === undefined ? entities : entities.filter((e) => e.id !== seen.own),
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
    const content = {
      eye,
      world: stateView.world,
      realm: gc.realmId ?? null,
      props: stateView.props,
      sprites: items.filter((item): item is SpriteItem => item.kind === "sprite"),
      drawRadius,
      interior,
      shadows: control.shadows,
    };
    // Through the render host's own renderer, into this view's region (249).
    drawn = view3d.draw(view.region, (target) => scene.render(content, target));
  } finally {
    frame.release();
  }
  if (drawn) control.markDrawn(view);
  else control.hide(view);
  return drawn;
}

/** Small aiming mark at the centre of a view (context already at its region's origin). */
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
