import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
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
  const receivers = camera.worldRaster
    ? new SurfaceReceivers(world, props, entities, alpha, {
        ...receiverOptions,
        mesh: terrain.meshSurfaceGeometry?.bind(terrain),
      })
    : undefined;

  // Viewport bounds in world coordinates for culling
  const vpTL = camera.screenToWorld(0, 0);
  const vpBR = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  const cull = cullBounds(vpTL, vpBR);
  const depth = entityDepth(entities, props, frame);
  const poseTime = frame?.presentationTime ?? 0;
  frame?.meshPoses.retain(entities);
  collectEntitySprites({
    entities,
    world,
    alpha,
    terrain,
    frame,
    receivers,
    cull,
    depth,
    poseTime,
    items,
    grassVehicles,
  });
  collectPropSprites(props, drawProps, world, cull, items, grassVehicles);
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

/** Props have no interpolation, no Z beyond terrain, and no shadows. */
function collectPropSprites(
  props: readonly Prop[],
  drawProps: ReadonlySet<number> | undefined,
  world: Pick<World, "getHeightAt">,
  cull: CullBounds,
  items: SceneItem[],
  grassVehicles: SpriteItem[] | undefined,
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
    if (p.sprite.parts) {
      for (const part of p.sprite.parts) {
        const partItem = {
          ...baseItem,
          ...part,
          wx: p.position.wx + part.dx,
          wy: p.position.wy + part.dy,
        };
        items.push(partItem);
        vehicle?.push(partItem);
      }
    } else {
      items.push(baseItem);
      vehicle?.push(baseItem);
    }
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
