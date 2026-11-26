import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { RemoteStateView } from "../client/ClientStateView.js";
import type { FirstPersonControl } from "../client/FirstPersonControl.js";
import { XR_WALK } from "../client/XrControl.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { controllerInput } from "../input/ControllerInput.js";
import { furnitureDefinition } from "../interiors/FurnitureCatalog.js";
import { furnitureAsset, INTERIOR_WALL_TYPE } from "../interiors/GameplayInterior.js";
import { compileGameplayRoom, initialRoom } from "../interiors/GameplayRoom.js";
import { collectWorldSprites, SURFACE_RECEIVER_MIN_ZOOM } from "../rendering/collectScene.js";
import { entityHeading } from "../rendering/EntityMeshPose.js";
import { type FirstPersonEye, NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import type { HeadsetFrame } from "../rendering/firstperson/FirstPersonCameras.js";
import type { EffectItem } from "../rendering/firstperson/FirstPersonEffects.js";
import type {
  FirstPersonInterior,
  InteriorFurnitureArt,
} from "../rendering/firstperson/FirstPersonInterior.js";
import type {
  FirstPersonFrame,
  FirstPersonView,
} from "../rendering/firstperson/FirstPersonView.js";
import { grown, obliqueGround } from "../rendering/firstperson/ObliqueCamera.js";
import { collectCameraGrass } from "../rendering/GrassBladeRenderer.js";
import type { OverlayDraw } from "../rendering/OverlayFrame.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import { bladesOnPixelGrid, onPixelGrid, particlesOnPixelGrid } from "../rendering/PixelGrid.js";
import type { SceneItem, SpriteItem } from "../rendering/SceneItem.js";
import { SurfaceReceivers } from "../rendering/SurfaceReceivers.js";
import type { View3dHost } from "../rendering/View3dHost.js";
import type { SeatFrame } from "../session/DeviceSeats.js";
import { seatEntity } from "../session/SeatFocus.js";
import type { View } from "../session/View.js";
import type { SkyClockView } from "../sky/Sky.js";
import { playAtmosphere } from "./playAtmosphere.js";

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
  // A headset's look is the head's; the stick snap-turns the room (252).
  if (gc.xr?.immersive && view.look) gc.xr.tick(view.look, dt, controllerInput.rightStick);
  else
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
  dt = 0,
): T {
  const vehicleAxes = !!vehicle && gc.carDriving === "steering";
  if (!view || !gc.firstPerson || vehicleAxes) return input;
  const keyboardTurn =
    !vehicle &&
    !gc.xr?.immersive &&
    gc.firstPerson.controls === "simple" &&
    gc.actions?.keyboardMoving;
  const manual = keyboardTurn ? gc.firstPerson.keyTurn(view, input, dt) : input;
  const turned = gc.firstPerson.movement(view, manual);
  // First person in a headset walks: full stick speed reads as a run there.
  return gc.xr?.walking && !vehicle
    ? { ...turned, dx: turned.dx * XR_WALK, dy: turned.dy * XR_WALK }
    : turned;
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
    interior = {
      key,
      map: room.map,
      shellType: INTERIOR_WALL_TYPE,
      furniture: furnitureArt,
      editable: !room.legacy,
    };
  }
  rooms.set(control, { identity, state, interior });
  return interior;
}

/** True when a view should be drawn in 3D this frame: its seat chose first
 * person or the device draws top-down in 3D, the host can draw 3D into its
 * region and its scene has loaded. */
export function wantsFirstPerson(gc: GameContext, view: View): boolean {
  return !!gc.view3d && !view.region.mask && !!gc.firstPerson?.scene(view);
}

/** What a 3D view shows this frame: where it looks from, and what is collected. */
interface Seen {
  readonly eye: FirstPersonEye;
  /** The viewer's own body, left out of its own first-person view. */
  readonly own: number | undefined;
  readonly cull: { left: number; right: number; top: number; bottom: number };
  readonly drawRadius: number;
  readonly topDown: { scale: number } | undefined;
  /** Drawn to a headset's eyes instead of the view's region (252). */
  readonly headset?: HeadsetFrame | undefined;
}

/** Collection beyond the ground on screen in a top-down 3D view: wide sprites at
 * the sides, and raised or tall bodies south of the bottom edge. */
const TOP_DOWN_CULL_SIDE = 96;
const TOP_DOWN_CULL_BELOW = 384;

/** The seat's eye in first person; the view's own fixed camera for top-down (251),
 * already presented for this display frame. */
function seen(
  gc: GameContext,
  control: FirstPersonControl,
  view: View,
  alpha: number,
): Seen | undefined {
  if (gc.xr?.immersive) {
    const seenInHeadset = gc.xr.seen(
      view,
      (look) => view.policy.eye?.(gc.session, look, alpha),
      () => view.policy.focus?.(gc.session, alpha),
      control.drawRadius,
    );
    return seenInHeadset && { ...seenInHeadset, own: seenInHeadset.eye.own, topDown: undefined };
  }
  if (view.look) {
    const eye = view.policy.eye?.(gc.session, view.look, alpha);
    if (!eye) return undefined;
    const lifted = { ...eye, z: eye.z + control.lift };
    const { drawRadius } = control;
    return {
      eye: lifted,
      own: eye.own,
      cull: {
        left: eye.x - drawRadius,
        right: eye.x + drawRadius,
        top: eye.y - drawRadius,
        bottom: eye.y + drawRadius,
      },
      drawRadius,
      topDown: undefined,
    } satisfies Seen;
  }
  return topDownSeen(control, view);
}

/** The top-down camera's view (251): the fixed view's camera, its eye on the
 * pixel grid its bodies and blades stand on (`PixelGrid`). */
function topDownSeen(control: FirstPersonControl, view: View): Seen | undefined {
  const { camera } = view;
  const x = control.pixelGrid ? onPixelGrid(camera.x, camera.scale) : camera.x;
  const y = control.pixelGrid ? onPixelGrid(camera.y, camera.scale) : camera.y;
  const ground = obliqueGround(
    { x, y, scale: camera.scale },
    view.region.width,
    view.region.height,
  );
  return {
    eye: { x, y, z: 0, yaw: NORTH_YAW, pitch: 0 },
    own: undefined,
    cull: grown(ground, TOP_DOWN_CULL_SIDE, TOP_DOWN_CULL_BELOW),
    drawRadius: Math.hypot(ground.right - ground.left, ground.bottom - ground.top) / 2,
    topDown: { scale: camera.scale },
  } satisfies Seen;
}

/**
 * What a 3D view of play reads, from the game or from a Workshop lab: one
 * device's replica and its presentation this frame. Both draw through
 * `drawSeen`, so collection, the pixel grid, grass, effects and the cutaway are
 * shared, not copied.
 */
export interface Play3dSource {
  readonly control: FirstPersonControl;
  readonly view3d: View3dHost;
  readonly state: RemoteStateView;
  /** Presented bodies (the game leaves out those behind a door being crossed). */
  readonly entities: readonly Entity[];
  readonly realm: string | null;
  readonly presentationTime: number;
  /** The clock slab fades run on, as the fixed view's `fadeSeconds`. */
  readonly fadeSeconds: number;
  /** A lab fixture without terrain: no ground, this colour behind. */
  readonly background?: string | undefined;
  /** The grass sheet is loaded. */
  readonly grass: boolean;
  /** The view's body, for the overhead decks' cutaway. */
  readonly observer: Entity | undefined;
  readonly props?: readonly Prop[];
  readonly interior?: FirstPersonInterior;
  readonly underlay?: readonly OverlayDraw[];
  readonly meshSurfaceGeometry?: import("../rendering/TerrainPresentation.js").TerrainPresentation["meshSurfaceGeometry"];
  readonly visibility?: import("../rendering/SurfacePresentation.js").SurfaceVisibility;
  /** Appends presentation-only sprites (opening doors), as the fixed view's
   * `collected` hook does. */
  readonly overlays?: ((items: SceneItem[]) => void) | undefined;
  /** The world's clock and weather; without them the view shows a clear day. */
  readonly sky?: SkyClockView | undefined;
}

/**
 * Draw one view of play in the 3D scene (229, per view since 249) into its
 * region: first person for a seat that chose it, or the top-down view through
 * the fixed view's camera when the device opted in (251). Returns false to let
 * the fixed view draw it (not chosen, loading, failed to load, graphics lost,
 * the seat's body is not streamed yet, or top-down inside a room).
 * In first person, indoors draws the room (230) and drivers get a chase camera
 * behind their vehicle.
 */
export function renderFirstPerson(
  gc: GameContext,
  view: View,
  alpha: number,
  particles?: ParticlePresentation,
): boolean {
  const control = gc.firstPerson;
  const { stateView, view3d } = gc;
  const scene = control && wantsFirstPerson(gc, view) ? control.scene(view) : undefined;
  const from = control && scene ? seen(gc, control, view, alpha) : undefined;
  if (!control || !scene || !view3d || !from) {
    // A headset shows nothing else: no fixed view takes this view's place.
    if (gc.xr?.immersive) return true;
    control?.hide(view);
    return false;
  }
  const realm = gc.realmId ?? null;
  const source: Play3dSource = {
    control,
    view3d,
    state: stateView,
    entities: gc.doorPresentation?.entities(stateView.entities, realm) ?? stateView.entities,
    realm,
    presentationTime: gc.time?.presentationSeconds ?? 0,
    fadeSeconds: gc.time?.presentationSeconds ?? 0,
    grass: gc.spriteCatalog.has("grass-blades"),
    overlays: (items) => gc.doorPresentation?.appendOverlays(items, realm),
    meshSurfaceGeometry: gc.renderer?.meshSurfaceGeometry?.bind(gc.renderer),
    observer: (view.seat ? seatEntity(gc.session, view.seat) : undefined) ?? stateView.playerEntity,
    // Building shows the world in plain daylight, so painted colours read true.
    sky: stateView.editorEnabled ? undefined : stateView.sky.now,
  };
  const interior = currentInterior(gc, control);
  const headset = from.headset && gc.xr;
  return drawSeen(source, view, scene, from, alpha, particles, interior, headset || undefined);
}

/**
 * A Workshop lab's view in the unified top-down view (renderer unification:
 * labs on the one renderer). As the game's top-down path; false leaves the view
 * to the fixed view (not opted in, still loading, a diagonal split, or a room).
 */
export function renderTopDown3d(
  source: Play3dSource,
  view: View,
  alpha: number,
  particles?: ParticlePresentation,
): boolean {
  const { control } = source;
  const scene = !view.region.mask ? control.scene(view) : undefined;
  const from = scene ? topDownSeen(control, view) : undefined;
  if (!scene || !from) {
    control.hide(view);
    return false;
  }
  return drawSeen(source, view, scene, from, alpha, particles, source.interior, undefined);
}

/** Collect and draw what `from` sees; marks the view drawn or hands it back. */
function drawSeen(
  source: Play3dSource,
  view: View,
  scene: FirstPersonView,
  from: Seen,
  alpha: number,
  particles: ParticlePresentation | undefined,
  interior: FirstPersonInterior | undefined,
  headset: Pick<NonNullable<GameContext["xr"]>, "draw"> | undefined,
): boolean {
  const { control, state, entities, view3d } = source;
  const { eye, drawRadius, topDown } = from;
  const grid = topDown && control.pixelGrid ? topDown.scale : undefined;
  const frame = control.frame;
  frame.presentationTime = source.presentationTime;
  // Top-down draws the fixed view's blades for its camera; first person has none.
  const grass =
    // Rooms have no grass.
    topDown && source.grass && !interior
      ? collectCameraGrass(state.world, entities, view.camera, frame.presentationTime, frame.grass)
      : undefined;
  if (grid && grass) bladesOnPixelGrid(grass, grid);
  const effects = particles && viewEffects(source, view, particles, alpha, !!topDown);
  if (grid && effects) particlesOnPixelGrid(effects, grid);
  const items = frame.begin(!!grass?.length);
  view.pedestrianGait.begin();
  let drawn = false;
  try {
    collectWorldSprites({
      // First person hides the viewer's own body; a driver is drawn inside the vehicle.
      entities: from.own === undefined ? entities : entities.filter((e) => e.id !== from.own),
      props: source.props ?? state.props,
      world: state.world,
      alpha,
      cull: from.cull,
      items,
      frame,
      // Casters carry their shadow shapes, as for the fixed view's depth pass (247).
      // Top-down rooms have none there: every body takes the plain oval at its feet.
      depthShadows: control.shadows && !(topDown && interior),
      pixelGrid: grid,
      pedestrianGait: view.pedestrianGait,
    });
    source.overlays?.(items);
    const content: FirstPersonFrame = {
      eye,
      world: state.world,
      realm: source.realm,
      props: source.props ?? state.props,
      sprites: items.filter((item): item is SpriteItem => item.kind === "sprite"),
      drawRadius,
      interior,
      shadows: control.shadows,
      sun: control.sun,
      dynamicShadows: control.dynamicShadows,
      topDown,
      pixelBodies: control.pixelBodies,
      wildlifeModels: control.wildlifeModels,
      groundNearest: control.groundNearest || !!grid,
      grass,
      effects,
      // The fixed view's cutaway: the view's body and its own slab fades, so
      // switching renderers keeps a fade where it was.
      cutaway: source.observer && {
        observer: source.observer,
        fades: view.fades,
        time: source.fadeSeconds,
        alpha,
        visibility: source.visibility,
      },
      background: source.background,
      underlay: source.underlay,
      headset: from.headset,
      atmosphere:
        source.sky &&
        playAtmosphere(source.sky, {
          entities,
          eye,
          scale: topDown?.scale,
          region: view.region,
          indoors: !!interior,
          headset: !!headset,
          seconds: source.presentationTime,
        }),
    };
    // Through the render host's own renderer (249): into this view's region, or
    // to a headset's eyes.
    drawn = headset
      ? headset.draw((target) => scene.render(content, target))
      : view3d.draw(view.region, (target) => scene.render(content, target));
    if (drawn) control.onPresented?.(view, content.sprites);
  } finally {
    frame.release();
  }
  if (!drawn && !headset) control.hide(view);
  else if (topDown) control.markTopDown(view);
  else if (drawn) control.markDrawn(view);
  return drawn || !!headset;
}

/**
 * Play's particles and surface marks for one 3D view, as the fixed view collects
 * them: on the decks and ground under them (`SurfaceReceivers`), which are only
 * built while there is something to show and, top-down, above the fixed view's
 * overview LOD. Collection advances the particles' landings, as it does there.
 */
function viewEffects(
  source: Play3dSource,
  view: View,
  particles: ParticlePresentation,
  alpha: number,
  topDown: boolean,
): EffectItem[] {
  if (Array.isArray(particles)) return particles;
  if (particles.active === false) return [];
  const { state } = source;
  const receivers =
    !topDown || view.camera.zoom >= SURFACE_RECEIVER_MIN_ZOOM
      ? new SurfaceReceivers(state.world, state.props, source.entities, alpha, {
          propCache: source.control.frame.propReceivers,
          mesh: source.meshSurfaceGeometry,
        })
      : undefined;
  const items = particles
    .collectItems(receivers)
    .filter((item): item is EffectItem => item.kind === "particle" || item.kind === "decal");
  if (receivers) Object.assign(source.control.frame.receiverStats, receivers.diagnostics);
  return items;
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
