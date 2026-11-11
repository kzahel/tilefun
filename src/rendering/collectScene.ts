import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import { interpolatePosition, interpolateWz } from "./EntityInterpolation.js";
import { appendGrassBladeItems, GrassFrameBuffer, grassOpacity } from "./GrassBladeRenderer.js";
import type { ParticlePresentation } from "./ParticleSystem.js";
import type { SceneFrame } from "./SceneFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";
import { type ReceiverOptions, SurfaceReceivers } from "./SurfaceReceivers.js";
import { collectEntitySprites, entityDepth } from "./scene/EntitySprites.js";
import { type CullBounds, cullBounds, outsideView } from "./scene/SceneCull.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";
import { grassDepthUnderVehicles, isVehicleSprite } from "./VehicleGrassDepth.js";

export { interpolatePosition } from "./EntityInterpolation.js";

/** Overview LOD in logical zoom: below this, no surface receivers are built.
 * Shadows then use the collector's own surface height, and contact effects stay
 * on the ground. Like the grass LOD, this keeps a 0.1× overview within budget. */
export const SURFACE_RECEIVER_MIN_ZOOM = 0.2;

type SceneWorld = Pick<World, "getHeightAt" | "getChunkIfLoaded" | "getRoadAt">;

/**
 * Collect, cull, interpolate, and Y-sort all visible scene items.
 * Returns SceneItem[] in draw order. With a frame, the list and grass items are
 * borrowed until its next collection; consume synchronously and release after drawing.
 *
 * This is the "scene graph" step — it computes what needs to be drawn
 * and where in world-space, without any Canvas2D-specific code. Stages append in
 * a fixed order (actors, props, grass, elevation, particles); the stable sort
 * keeps that order between equal keys, so it is part of the drawn output.
 */
export function collectScene(
  entities: readonly Entity[],
  props: readonly Prop[],
  world: SceneWorld,
  camera: Camera,
  visible: ChunkRange,
  alpha: number,
  terrain: TerrainPresentation,
  particles: ParticlePresentation,
  hasGrass: boolean,
  drawProps?: ReadonlySet<number>,
  frame?: SceneFrame,
  receiverOptions: ReceiverOptions = {},
): SceneItem[] {
  const grassAlpha = hasGrass ? grassOpacity(camera.zoom) : 0;
  const visibleGrass = grassAlpha > 0;
  const items = frame ? frame.begin(visibleGrass) : [];
  const grassVehicles = visibleGrass ? ([] as SpriteItem[]) : undefined;
  const receivers =
    camera.worldRaster && camera.zoom >= SURFACE_RECEIVER_MIN_ZOOM
      ? new SurfaceReceivers(world, props, entities, alpha, {
          ...receiverOptions,
          propCache: frame?.propReceivers,
          mesh: terrain.meshSurfaceGeometry?.bind(terrain),
        })
      : undefined;

  // Viewport bounds in world coordinates for culling
  const vpTL = camera.screenToWorld(0, 0);
  const vpBR = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  const cull = cullBounds(vpTL, vpBR);
  const poseTime = frame?.presentationTime ?? 0;
  collectWorldSprites({
    entities,
    props,
    world,
    alpha,
    cull,
    items,
    frame,
    terrain,
    receivers,
    depthShadows: camera.worldRaster,
    grassVehicles,
  });
  const observer = receiverOptions.observer;
  collectPropSprites(
    props,
    drawProps,
    world,
    cull,
    items,
    grassVehicles,
    observer && roomObserver(observer, alpha),
  );
  if (grassVehicles) {
    // Share the owner's presentation clock (e.g. paused labs); frameless callers keep wall time.
    const nowSec = frame ? poseTime : performance.now() / 1000;
    const viewport = { minWx: vpTL.wx, minWy: vpTL.wy, maxWx: vpBR.wx, maxWy: vpBR.wy };
    const grassStart = items.length;
    appendGrassBladeItems(
      world,
      entities,
      visible,
      viewport,
      nowSec,
      frame?.grass ?? new GrassFrameBuffer(),
      items,
      grassAlpha === 1 ? undefined : grassAlpha,
    );
    keepGrassUnderVehicles(items, grassStart, grassVehicles);
  }

  // --- Elevation tiles ---
  for (const elev of terrain.collectElevationItems(world, visible)) items.push(elev);
  // --- Particles ---
  for (const p of Array.isArray(particles) ? particles : particles.collectItems(receivers)) {
    items.push(p);
  }

  if (frame && receivers) Object.assign(frame.receiverStats, receivers.diagnostics);

  // Sort by pre-computed sort key for correct depth ordering
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}

/** Inputs for the view-independent actor stage. */
export interface WorldSpriteInput {
  readonly entities: readonly Entity[];
  /** Depth surfaces only; prop sprites are collected per view. */
  readonly props: readonly Prop[];
  readonly world: Pick<World, "getHeightAt">;
  readonly alpha: number;
  /** World box: the fixed view's viewport, or the first-person view's draw radius. */
  readonly cull: CullBounds;
  readonly items: SceneItem[];
  readonly frame?: SceneFrame | undefined;
  readonly terrain?: Pick<TerrainPresentation, "meshSurfaceGeometry"> | undefined;
  readonly receivers?: SurfaceReceivers | undefined;
  /** The view draws shadows from world depth (the GPU fixed view). */
  readonly depthShadows?: boolean | undefined;
  readonly grassVehicles?: SpriteItem[] | undefined;
}

/**
 * Interpolated actor positions, heights, frames and optional mesh poses inside a
 * world box, appended in entity order. This is the shared world-space presentation
 * step: the fixed oblique view sorts the result into painter order, and the
 * first-person view (tactical 229) draws it in perspective. Neither view copies
 * interpolation, pose or vehicle-grouping policy.
 */
export function collectWorldSprites(input: WorldSpriteInput): void {
  const { entities, frame } = input;
  frame?.meshPoses.retain(entities);
  collectEntitySprites({
    entities,
    world: input.world,
    alpha: input.alpha,
    terrain: input.terrain ?? {},
    frame,
    receivers: input.receivers,
    depthShadows: input.depthShadows ?? false,
    cull: input.cull,
    depth: entityDepth(entities, input.props, frame),
    poseTime: frame?.presentationTime ?? 0,
    items: input.items,
    grassVehicles: input.grassVehicles,
  });
}

interface RoomObserver {
  wx: number;
  wy: number;
  z: number;
}
/** The observer's displayed footprint centre and feet height. */
function roomObserver(observer: Entity, alpha: number): RoomObserver {
  const p = interpolatePosition(observer.position, observer.prevPosition, alpha);
  const c = observer.collider;
  return {
    wx: p.wx + (c?.offsetX ?? 0),
    wy: p.wy + (c ? c.offsetY - c.height / 2 : 0),
    z: interpolateWz(observer, alpha) ?? 0,
  };
}
/** Presentation-only roof cutaway: is the observer within one of the prop's rooms? */
export function observerInsideRoom(prop: Prop, observer: RoomObserver | undefined): boolean {
  if (!observer) return false;
  for (const c of prop.walls ?? []) {
    if (!c.room || c.zHeight === undefined) continue;
    const b = getEntityAABB(prop.position, c),
      base = c.zBase ?? 0;
    if (
      observer.wx >= b.left &&
      observer.wx <= b.right &&
      observer.wy >= b.top &&
      observer.wy <= b.bottom &&
      observer.z >= base - 1 &&
      observer.z <= base + c.zHeight
    )
      return true;
  }
  return false;
}

/** Props have no interpolation, no Z beyond terrain, and no shadows. */
function collectPropSprites(
  props: readonly Prop[],
  drawProps: ReadonlySet<number> | undefined,
  world: Pick<World, "getHeightAt">,
  cull: CullBounds,
  items: SceneItem[],
  grassVehicles: SpriteItem[] | undefined,
  observer: RoomObserver | undefined,
): void {
  for (const p of props) {
    if (drawProps && !drawProps.has(p.id)) continue;
    const sw = p.sprite.spriteWidth;
    const sh = p.sprite.spriteHeight;
    if (outsideView(cull, p.position.wx, sw / 2, p.position.wy - sh, p.position.wy)) continue;

    const tx = Math.floor(p.position.wx / TILE_SIZE);
    const ty = Math.floor(p.position.wy / TILE_SIZE);
    const elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX;

    const baseItem = {
      kind: "sprite",
      sortKey: p.position.wy + (p.sortOffsetY ?? 0),
      wx: p.position.wx,
      wy: p.position.wy,
      zOffset: elevOffset,
      sheetKey: p.sprite.sheetKey,
      frameCol: p.sprite.frameCol,
      frameRow: p.sprite.frameRow,
      spriteWidth: sw,
      spriteHeight: sh,
      flipX: false,
      drawOffsetY: 0,
      hasShadow: false,
      shadowFeetWy: 0,
      shadowWidth: 0,
      shadowTerrainZ: 0,
      flashHidden: false,
    } satisfies SpriteItem;
    const vehicle = grassVehicles && isVehicleSprite(p.type) ? grassVehicles : undefined;
    if (p.sprite.parts)
      pushPropParts(p, p.sprite.parts, baseItem, elevOffset, observer, items, vehicle);
    else {
      items.push(baseItem);
      vehicle?.push(baseItem);
    }
  }
}

/** Atlas pieces share the prop's depth key; room views and depth planes are per piece. */
function pushPropParts(
  p: Prop,
  parts: NonNullable<Prop["sprite"]["parts"]>,
  baseItem: SpriteItem,
  elevOffset: number,
  observer: RoomObserver | undefined,
  items: SceneItem[],
  vehicle: SpriteItem[] | undefined,
): void {
  const inside = parts.some((part) => part.view) && observerInsideRoom(p, observer);
  for (const { view, depthDy, depthFloorZ, ...part } of parts) {
    if (view && (view === "inside") !== inside) continue;
    const partItem: SpriteItem = {
      ...baseItem,
      ...part,
      wx: p.position.wx + part.dx,
      wy: p.position.wy + part.dy,
    };
    if (depthDy !== undefined) partItem.depthWy = p.position.wy + depthDy;
    if (depthFloorZ !== undefined) partItem.depthFloorZ = elevOffset + depthFloorZ;
    items.push(partItem);
    vehicle?.push(partItem);
  }
}

function keepGrassUnderVehicles(
  items: readonly SceneItem[],
  grassStart: number,
  grassVehicles: readonly SpriteItem[],
): void {
  if (!grassVehicles.length) return;
  for (let i = grassStart; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === "grass") grassDepthUnderVehicles(item, grassVehicles);
  }
}
