import type { FirstPersonControl } from "../client/FirstPersonControl.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import { collectWorldSprites } from "../rendering/collectScene.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import { entityHeading } from "../rendering/EntityMeshPose.js";
import { chaseEye, type FirstPersonEye } from "../rendering/firstperson/FirstPersonCamera.js";
import type { SpriteItem } from "../rendering/SceneItem.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";

/** Lowest camera zoom while first person is active: the fixed camera still
 * follows the player, so this widens the streamed area the fog radius needs. */
const FIRST_PERSON_STREAM_ZOOM = 0.5;
const EYE_FRACTION = 0.85;
const CHASE_DISTANCE = 96;
const CHASE_HEIGHT = 28;

/**
 * Tactical 229 glue, per fixed tick while play is drawn in first person: widen the
 * streamed area, apply look input and drop tap/hold destinations (they come from
 * the hidden fixed camera). Returns undefined whenever the fixed view is shown.
 */
export function firstPersonTick(
  gc: GameContext,
  dt: number,
  vehicle: Entity | undefined,
): FirstPersonControl | undefined {
  const control = gc.firstPerson?.drawing ? gc.firstPerson : undefined;
  if (!control) return undefined;
  gc.camera.zoom = Math.min(gc.camera.zoom, FIRST_PERSON_STREAM_ZOOM);
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

/**
 * Tactical 229 glue: draw the play view in first person when it is enabled and
 * loaded. Returns false to keep the fixed view (disabled, loading, unsupported
 * host or indoors). Drivers get a chase camera behind their vehicle.
 */
export function renderFirstPerson(gc: GameContext, alpha: number): boolean {
  const control = gc.firstPerson;
  if (!control?.active) return false;
  const view = gc.stateView.interior ? undefined : control.currentView();
  const { stateView, camera } = gc;
  const shown = stateView.presentedPlayerEntity ?? stateView.playerEntity;
  if (!view || shown.id === -1) {
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
  // The fixed camera keeps following the player, so its streamed range bounds the fog.
  const visible = Math.min(camera.viewportWidth, camera.viewportHeight) / camera.zoom / 2;
  const drawRadius = Math.max(320, Math.min(900, visible));
  const frame = control.frame;
  frame.presentationTime = gc.time?.presentationSeconds ?? 0;
  const items = frame.begin(false);
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
    });
    view.render({
      eye,
      world: stateView.world,
      realm: gc.realmId ?? null,
      props: stateView.props,
      sprites: items.filter((item): item is SpriteItem => item.kind === "sprite"),
      drawRadius,
    });
  } finally {
    frame.release();
  }
  control.markDrawn();
  return true;
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
