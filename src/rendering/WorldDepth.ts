import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { PropCollider } from "../entities/Prop.js";
import type { Camera } from "./Camera.js";
import { projectWorld } from "./Projection.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SceneItem } from "./SceneItem.js";

/** Camera-relative depth along the fixed (x,y-z) projection. A 24-bit depth
 * attachment resolves ~0.004 world pixels across this bounded visible range. */
export const WORLD_DEPTH_RANGE = 65536;
export function surfaceWorldDepth(
  camera: Camera,
  position: { wx: number; wy: number },
  collider: PropCollider,
) {
  const patch = collider.surface;
  if (!patch) return undefined;
  const bounds = getEntityAABB(position, collider),
    s = camera.scale,
    r = WORLD_DEPTH_RANGE;
  const a = patch.riseX / (bounds.right - bounds.left),
    b = patch.riseY / (bounds.bottom - bounds.top);
  if (Math.abs(1 - b) < 0.001) return undefined; // Edge-on planes have no projected top area.
  const c = patch.z - a * bounds.left - b * bounds.top;
  const origin = projectWorld(camera, 0, 0, 0),
    x = (2 * a) / (1 - b),
    y = (1 + b) / (1 - b);
  const top: [number, number, number] = [
    -x / s / r,
    -y / s / r,
    0.5 - ((2 * c) / (1 - b) - camera.y - (x * origin.sx) / s - (y * origin.sy) / s) / r,
  ];
  const front: [number, number, number] = [
    0,
    1 / s / r,
    0.5 - (2 * bounds.bottom - camera.y + origin.sy / s) / r,
  ];
  const xBounds: [number, number] = [
    projectWorld(camera, bounds.left, 0).sx,
    projectWorld(camera, bounds.right, 0).sx,
  ];
  return { top, front, xBounds };
}
export function sceneDepth(ctx: RasterSurface, camera: Camera, item: SceneItem, shadow: boolean) {
  if (!ctx.setDepthPlane || item.kind === "decal") return;
  let y = item.wy,
    z = 0,
    horizontal = shadow;
  if (item.kind === "sprite") {
    y = shadow ? item.shadowFeetWy : item.wy;
    z = shadow ? item.shadowTerrainZ : item.zOffset;
  } else if (item.kind === "elevation") {
    z = item.height * ELEVATION_PX;
    horizontal = item.phase === "surface";
    if (!horizontal) y += TILE_SIZE;
  } else if (item.kind === "particle") z = item.z;
  const anchor = projectWorld(camera, item.wx, y, z);
  const b = (horizontal ? -1 : 1) / (camera.scale * WORLD_DEPTH_RANGE);
  ctx.setDepthPlane(0, b, 0.5 - (y + z - camera.y) / WORLD_DEPTH_RANGE - b * anchor.sy);
}
