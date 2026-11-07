import type { AABB } from "../entities/collision.js";
import type { SurfacePatch } from "../physics/SurfacePatch.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import { isRoadRailBridge, ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import type { Camera } from "./Camera.js";
import type { OverlayFrame } from "./OverlayFrame.js";
import { projectWorld } from "./Projection.js";

/** Drivable decks drawn as roads rather than schematic surfaces. */
export const isRoadDeck = (type: string) =>
  isRoadRailBridge(type) || type.startsWith("prop-depot-bridge-");

/** Road-over-rail asphalt lightens with height (0 → bridge deck). */
function deckShade(z: number): string {
  const t = Math.max(0, Math.min(1, z / ROAD_RAIL_BRIDGE.height));
  const c = (lo: number, hi: number) => Math.round(lo + (hi - lo) * t);
  return `rgb(${c(84, 128)},${c(89, 134)},${c(93, 139)})`;
}

/** Thin strips approximate the projected plane, as for schematic surfaces; all
 * collision queries use the exact plane. North/south road-rail decks carry traffic
 * along Y; depot and east/west decks along X. */
export function drawRoadDeck(
  frame: OverlayFrame,
  camera: Camera,
  type: string,
  patch: SurfacePatch,
  bounds: AABB,
) {
  const railRoad = isRoadRailBridge(type);
  const alongY = railRoad && !type.startsWith("prop-road-rail-x-");
  if (alongY) drawDeckRows(frame, camera, patch, bounds);
  else
    for (let x = bounds.left; x < bounds.right; x += 2) {
      const width = Math.min(2, bounds.right - x);
      const north = projectWorld(camera, x, bounds.top, surfaceZAt(patch, bounds, x, bounds.top));
      const south = projectWorld(
        camera,
        x,
        bounds.bottom,
        surfaceZAt(patch, bounds, x, bounds.bottom),
      );
      const w = width * camera.scale + 0.5;
      const fill = railRoad
        ? deckShade(surfaceZAt(patch, bounds, x + width / 2, bounds.top))
        : "#62676b";
      frame.rect(north.sx, north.sy, w, south.sy - north.sy, fill);
      frame.rect(south.sx, south.sy, w, patch.thickness * camera.scale, "#3d4854");
    }
  drawMarkings(frame, camera, patch, bounds, alongY, railRoad);
}

/** A north/south deck rises along Y, which this projection only stretches. Rows
 * shaded by height keep the raised road readable over the track; its side faces
 * have no projected width, so a ground shadow east of the deck (widening with
 * height) shows the track passing underneath. */
function drawDeckRows(frame: OverlayFrame, camera: Camera, patch: SurfacePatch, bounds: AABB) {
  for (let y = bounds.top; y < bounds.bottom; y += 2) {
    const end = Math.min(bounds.bottom, y + 2),
      z0 = surfaceZAt(patch, bounds, bounds.left, y),
      z1 = surfaceZAt(patch, bounds, bounds.left, end),
      z = (z0 + z1) / 2;
    const a = projectWorld(camera, bounds.left, y, z0),
      b = projectWorld(camera, bounds.right, end, z1);
    const g = projectWorld(camera, bounds.right, y, 0),
      h = projectWorld(camera, bounds.right + z * 0.4, end, 0);
    if (h.sx > g.sx) frame.rect(g.sx, g.sy, h.sx - g.sx, h.sy - g.sy + 0.5, "#1d2a2033");
    frame.rect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy + 0.5, deckShade(z));
  }
}

/** Rail-crossing decks match the regional road: ±64px asphalt edge lines and a
 * guard rail at each outer edge; depot decks keep their inset lines. */
function drawMarkings(
  frame: OverlayFrame,
  camera: Camera,
  patch: SurfacePatch,
  bounds: AABB,
  alongY: boolean,
  railRoad: boolean,
) {
  const lo = alongY ? bounds.left : bounds.top,
    hi = alongY ? bounds.right : bounds.bottom,
    mid = (lo + hi) / 2;
  const rows = railRoad ? [lo + 2, hi - 2, mid - 64, mid + 64, mid] : [lo + 6, hi - 6, mid];
  const start = alongY ? bounds.top : bounds.left,
    stop = alongY ? bounds.bottom : bounds.right;
  for (const across of rows) {
    const center = across === mid,
      guard = railRoad && Math.abs(across - mid) > 64;
    // Guard rails read as parapets: twice the painted line weight.
    const stroke = center ? "#e5bf59" : guard ? "#d8d5ca" : "#e0dfd6",
      weight = Math.max(1, camera.scale) * (guard ? 2 : 1);
    for (let along = start; along < stop; along += center ? 32 : stop - start) {
      const end = Math.min(stop, along + (center ? 16 : stop - start));
      const [ax, ay, bx, by] = alongY ? [across, along, across, end] : [along, across, end, across];
      const a = projectWorld(camera, ax, ay, surfaceZAt(patch, bounds, ax, ay));
      const b = projectWorld(camera, bx, by, surfaceZAt(patch, bounds, bx, by));
      Object.assign(frame.next("line"), {
        x: a.sx,
        y: a.sy,
        width: b.sx,
        height: b.sy,
        stroke,
        lineWidth: weight,
      });
    }
  }
}
