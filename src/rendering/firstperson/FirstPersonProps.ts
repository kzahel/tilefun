import { type AABB, getEntityAABB } from "../../entities/collision.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import { surfaceZAt } from "../../physics/SurfacePatch.js";
import { FACE_SHADE, type TriangleWriter } from "./FirstPersonTerrain.js";

/** The prop's composed artwork relative to its feet, in the fixed view's plane:
 * `left` is a world-X offset and `top` a screen-Y offset (y − z) from the anchor. */
export interface PropImageFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Piece = { dx: number; dy: number; spriteWidth: number; spriteHeight: number };

/** Outside-view pieces (or the single sprite), each anchored bottom-centre. */
export function propPieces(
  prop: Prop,
): readonly (Piece & { frameCol: number; frameRow: number })[] {
  const parts = prop.sprite.parts?.filter((part) => part.view !== "inside");
  return parts?.length ? parts : [{ ...prop.sprite, dx: 0, dy: 0 }];
}

export function propImageFrame(prop: Prop): PropImageFrame {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const p of propPieces(prop)) {
    left = Math.min(left, p.dx - p.spriteWidth / 2);
    right = Math.max(right, p.dx + p.spriteWidth / 2);
    top = Math.min(top, p.dy - p.spriteHeight);
    bottom = Math.max(bottom, p.dy);
  }
  return {
    left: Math.floor(left),
    top: Math.floor(top),
    width: Math.ceil(right - Math.floor(left)),
    height: Math.ceil(bottom - Math.floor(top)),
  };
}

/** Colliders that stop or support movement; ladders and other passable volumes are omitted. */
export function blockingColliders(prop: Prop): PropCollider[] {
  const all = [...(prop.walls ?? []), ...(prop.collider ? [prop.collider] : [])];
  return all.filter((c) => c.surface || !c.passable);
}

/**
 * Solid props draw their physical volumes, wearing the fixed-view artwork on the
 * faces it depicts. Props whose bodies are much narrower than their pictures
 * (trees, posts, signs) or that have no body at all stay upright billboards.
 */
export function propForm(prop: Prop, frame = propImageFrame(prop)): "billboard" | "solid" {
  const blocking = blockingColliders(prop);
  if (!blocking.length) return "billboard";
  if (blocking.some((c) => c.surface)) return "solid";
  const widest = Math.max(...blocking.map((c) => Math.max(c.width, c.height)));
  return widest < frame.width * 0.5 ? "billboard" : "solid";
}

/**
 * Visual height for an unlimited physical wall. The fixed view draws a box of
 * height H over screen rows [boxTop − H, boxBottom], so the artwork's top edge
 * implies H = boxTop − artTop. Finite colliders keep their own height.
 */
export function unlimitedWallHeight(prop: Prop, bounds: AABB, frame: PropImageFrame): number {
  const artTop = prop.position.wy + frame.top;
  return Math.max(12, Math.min(frame.height, bounds.top - artTop));
}

export interface PropSolid {
  bounds: AABB;
  surface: boolean;
  /** Bottom ring then top ring: (left,top), (right,top), (right,bottom), (left,bottom). */
  corners: [number, number, number][];
}

export function propSolids(prop: Prop, frame = propImageFrame(prop)): PropSolid[] {
  return blockingColliders(prop).map((c) => {
    const bounds = getEntityAABB(prop.position, c);
    const ring = [
      [bounds.left, bounds.top],
      [bounds.right, bounds.top],
      [bounds.right, bounds.bottom],
      [bounds.left, bounds.bottom],
    ] as const;
    const surface = c.surface;
    if (surface) {
      const top = ring.map(([x, y]) => [x, y, surfaceZAt(surface, bounds, x, y)] as const);
      return {
        bounds,
        surface: true,
        corners: [
          ...top.map(([x, y, z]) => [x, y, z - surface.thickness] as [number, number, number]),
          ...top.map(([x, y, z]) => [x, y, z] as [number, number, number]),
        ],
      };
    }
    const low = c.zBase ?? 0;
    const high = low + (c.zHeight ?? unlimitedWallHeight(prop, bounds, frame));
    return {
      bounds,
      surface: false,
      corners: [
        ...ring.map(([x, y]) => [x, y, low] as [number, number, number]),
        ...ring.map(([x, y]) => [x, y, high] as [number, number, number]),
      ],
    };
  });
}

/** Where a world point appears in the prop's artwork, as clamped image UVs (v from the top). */
export function projectedUv(
  prop: Prop,
  frame: PropImageFrame,
  elevation: number,
  x: number,
  y: number,
  z: number,
): [number, number] {
  const u = (x - (prop.position.wx + frame.left)) / frame.width;
  const v = (y - z - (prop.position.wy - elevation + frame.top)) / frame.height;
  return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
}

export interface TexturedTriangles {
  positions: number[];
  uvs: number[];
}

export interface PropGeometry {
  /** Faces the fixed view never shows, in the artwork's average colour. */
  flat: TriangleWriter;
  /** Top and south faces wearing the projected artwork; flat when the artwork is missing. */
  textured: TexturedTriangles | undefined;
}

const FACES = {
  top: [4, 5, 6, 7],
  south: [3, 2, 6, 7],
  north: [1, 0, 4, 5],
  east: [2, 1, 5, 6],
  west: [0, 3, 7, 4],
  bottom: [0, 1, 2, 3],
} as const;

export function appendPropGeometry(
  out: PropGeometry,
  prop: Prop,
  color: number,
  elevation: number,
  frame = propImageFrame(prop),
): void {
  for (const solid of propSolids(prop, frame)) {
    const corner = (i: number) => solid.corners[i] ?? [0, 0, 0];
    const flat = (face: readonly number[], shade: number) =>
      out.flat.quad(face.map(corner), color, shade);
    const textured = (face: readonly number[], shade: number) => {
      const target = out.textured;
      if (!target) return flat(face, shade);
      const [a, b, c, d] = face.map(corner);
      if (!a || !b || !c || !d) return;
      for (const p of [a, b, c, a, c, d]) {
        target.positions.push(p[0], p[1], p[2]);
        target.uvs.push(...projectedUv(prop, frame, elevation, p[0], p[1], p[2]));
      }
    };
    if (solid.surface) {
      // Decks and ramps are usually drawn by surface overlays rather than their sprite.
      flat(FACES.top, FACE_SHADE.top);
      flat(FACES.south, FACE_SHADE.south);
      flat(FACES.bottom, FACE_SHADE.bottom);
    } else {
      textured(FACES.top, FACE_SHADE.top);
      textured(FACES.south, FACE_SHADE.south);
    }
    flat(FACES.north, FACE_SHADE.north);
    flat(FACES.east, FACE_SHADE.east);
    flat(FACES.west, FACE_SHADE.west);
  }
}
