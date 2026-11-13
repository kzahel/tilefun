import { type AABB, getEntityAABB } from "../../entities/collision.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import { forestRowDefinition } from "../../patterns/ForestThicket.js";
import { surfaceZAt } from "../../physics/SurfacePatch.js";
import { FACE_SHADE, srgbToLinear, type TriangleWriter } from "./FirstPersonTerrain.js";

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
 * Forest rows are wide bodies of many trees: they stand as a row of cards (247).
 */
export function propForm(
  prop: Prop,
  frame = propImageFrame(prop),
): "billboard" | "solid" | "cards" {
  if (forestRowDefinition(prop.type)) return "cards";
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
  /** Linear grey per vertex: the face's baked shade. */
  colors: number[];
}

/**
 * Baked shade of faces wearing artwork (display-space multipliers). Top, south and
 * east faces face the sun and take its shadow; west and north faces never see it,
 * so they sit just below a shadowed lit face.
 */
export const ART_SHADE = { top: 1, south: 1, east: 0.92, west: 0.72, north: 0.66 };

/** One upright slice of a prop's artwork, for props that stand as a row of cards. */
export interface PropSlice {
  /** Source rectangle in the sheet image, in pixels. */
  sheetX: number;
  sheetY: number;
  width: number;
  height: number;
  /** Foot centre in world pixels. */
  x: number;
  y: number;
}

/** Widest card a forest row is cut into: each stays inside the row's body from any
 * side, and neighbouring rows (48 px apart) still overlap when seen along the row. */
const SLICE_WIDTH = 64;

/**
 * A forest row as upright cards: each piece of its artwork cut into slices that
 * stand at the middle of the row's body. Seen from the south they line up into the
 * fixed view's picture; from other sides each turns to face the eye like any tree.
 * `regionOf` returns a sheet frame's top-left pixel.
 */
export function propSlices(
  prop: Prop,
  regionOf: (frameCol: number, frameRow: number) => { x: number; y: number },
): PropSlice[] {
  const blocking = blockingColliders(prop);
  let top = Infinity,
    bottom = -Infinity;
  for (const c of blocking) {
    const bounds = getEntityAABB(prop.position, c);
    top = Math.min(top, bounds.top);
    bottom = Math.max(bottom, bounds.bottom);
  }
  const y = blocking.length ? (top + bottom) / 2 : prop.position.wy;
  const slices: PropSlice[] = [];
  for (const piece of propPieces(prop)) {
    const region = regionOf(piece.frameCol, piece.frameRow);
    const count = Math.max(1, Math.ceil(piece.spriteWidth / SLICE_WIDTH));
    const width = piece.spriteWidth / count;
    const left = prop.position.wx + piece.dx - piece.spriteWidth / 2;
    for (let i = 0; i < count; i++)
      slices.push({
        sheetX: region.x + i * width,
        sheetY: region.y,
        width,
        height: piece.spriteHeight,
        x: left + (i + 0.5) * width,
        // A shorter, top-aligned piece stands further back rather than floating.
        y: y + piece.dy,
      });
  }
  return slices;
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

/**
 * Room walls (tactical 230) are seen from both sides: their north faces repeat the
 * south-face artwork, and tops and east/west faces take a colour sampled from that
 * solid's artwork instead of the prop's single average colour.
 */
export interface RoomShellFaces {
  sideColor(solid: PropSolid): number;
}

type Point = readonly [number, number, number];

function between(p: Point, q: Point, t: number): Point {
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
}

/**
 * A wall that wears artwork `width` wide starting at `artLeft`, from x `from` at
 * its first corner to `to` at its second. The picture mirror-repeats beyond its
 * edges, so the wall is cut where it turns round: UVs are linear only between
 * turns. Each strip gives its fractions along the wall and the artwork x (inside
 * the picture) at its two ends.
 */
export function wallStrips(
  from: number,
  to: number,
  artLeft: number,
  width: number,
): { t0: number; t1: number; x0: number; x1: number }[] {
  const w = Math.max(1, width);
  const cuts = [from];
  for (let k = Math.floor((Math.min(from, to) - artLeft) / w) + 1; ; k++) {
    const turn = artLeft + k * w;
    if (turn >= Math.max(from, to)) break;
    cuts.push(turn);
  }
  cuts.push(to);
  cuts.sort((p, q) => (to >= from ? p - q : q - p));
  const span = to - from || 1;
  const strips: { t0: number; t1: number; x0: number; x1: number }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const start = cuts[i] ?? from,
      end = cuts[i + 1] ?? to;
    // Inside one repeat the fold is linear: even repeats run forwards, odd back.
    const repeat = Math.floor(((start + end) / 2 - artLeft) / w);
    const folded = (x: number) =>
      repeat % 2 === 0 ? x - repeat * w : 2 * artLeft + (repeat + 1) * w - x;
    strips.push({
      t0: (start - from) / span,
      t1: (end - from) / span,
      x0: folded(start),
      x1: folded(end),
    });
  }
  return strips;
}

export function appendPropGeometry(
  out: PropGeometry,
  prop: Prop,
  color: number,
  elevation: number,
  frame = propImageFrame(prop),
  shell?: RoomShellFaces,
): void {
  const artLeft = prop.position.wx + frame.left;
  for (const solid of propSolids(prop, frame)) {
    const corner = (i: number) => solid.corners[i] ?? [0, 0, 0];
    const sideColor = shell ? shell.sideColor(solid) : color;
    const { left, right, bottom } = solid.bounds;
    const flat = (face: readonly number[], shade: number, hex = color) =>
      out.flat.quad(face.map(corner), hex, shade);
    /** `art` moves each corner to the point of the south face or roof it wears. */
    const textured = (face: readonly number[], shade: number, art?: (p: Point) => Point) => {
      const target = out.textured;
      if (!target) return flat(face, shade);
      const [a, b, c, d] = face.map(corner);
      if (!a || !b || !c || !d) return;
      const grey = srgbToLinear(shade);
      for (const p of [a, b, c, a, c, d]) {
        const q = art ? art(p) : p;
        target.positions.push(p[0], p[1], p[2]);
        target.uvs.push(...projectedUv(prop, frame, elevation, q[0], q[1], q[2]));
        target.colors.push(grey, grey, grey);
      }
    };
    /** A wall wearing the south face along the artwork's x from `from` to `to`. */
    const wrapped = (face: readonly number[], shade: number, from: number, to: number) => {
      const target = out.textured;
      if (!target) return flat(face, shade);
      const [a, b, c, d] = face.map(corner);
      if (!a || !b || !c || !d) return;
      const grey = srgbToLinear(shade);
      for (const strip of wallStrips(from, to, artLeft, frame.width)) {
        const corners: [Point, number][] = [
          [between(a, b, strip.t0), strip.x0],
          [between(a, b, strip.t1), strip.x1],
          [between(d, c, strip.t1), strip.x1],
          [between(d, c, strip.t0), strip.x0],
        ];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          const entry = corners[i];
          if (!entry) continue;
          const [p, x] = entry;
          target.positions.push(p[0], p[1], p[2]);
          target.uvs.push(...projectedUv(prop, frame, elevation, x, bottom, p[2]));
          target.colors.push(grey, grey, grey);
        }
      }
    };
    if (shell && !solid.surface) {
      // Room art paints caps over the footprint, so a projected top would show the
      // floor beyond a low wall; tops take the wall's colour instead.
      flat(FACES.top, FACE_SHADE.top, sideColor);
      textured(FACES.south, 1);
      textured(FACES.north, 1, (p) => [p[0], bottom, p[2]]);
      flat(FACES.east, FACE_SHADE.east, sideColor);
      flat(FACES.west, FACE_SHADE.west, sideColor);
      continue;
    }
    if (solid.surface) {
      // Decks and ramps are usually drawn by surface overlays rather than their sprite.
      flat(FACES.top, FACE_SHADE.top);
      flat(FACES.south, FACE_SHADE.south);
      flat(FACES.bottom, FACE_SHADE.bottom);
      flat(FACES.north, FACE_SHADE.north);
      flat(FACES.east, FACE_SHADE.east);
      flat(FACES.west, FACE_SHADE.west);
      continue;
    }
    // The fixed view shows only the roof and the south face. The other walls wear
    // the south face too: side walls continue it around their south corner at the
    // artwork's own scale, and the north wall repeats it.
    textured(FACES.top, ART_SHADE.top);
    textured(FACES.south, ART_SHADE.south);
    // Faces start at these corners: east at its south end, west and north at
    // their north-west and north-east ends.
    const depth = bottom - solid.bounds.top;
    wrapped(FACES.east, ART_SHADE.east, right, right - depth);
    wrapped(FACES.west, ART_SHADE.west, left + depth, left);
    const mirror = 2 * artLeft + frame.width;
    wrapped(FACES.north, ART_SHADE.north, mirror - right, mirror - left);
  }
}

/** A walkable surface (deck, ramp) a moving body can stand on. */
export interface PropSurface {
  readonly bounds: AABB;
  readonly patch: NonNullable<PropCollider["surface"]>;
}

export function propSurfaces(prop: Prop): PropSurface[] {
  const surfaces: PropSurface[] = [];
  for (const c of blockingColliders(prop))
    if (c.surface) surfaces.push({ bounds: getEntityAABB(prop.position, c), patch: c.surface });
  return surfaces;
}

/** The surface's height at a point it covers, when that is at or below `maxZ`. */
export function surfaceUnder(
  surface: PropSurface,
  x: number,
  y: number,
  maxZ: number,
): number | undefined {
  const { bounds } = surface;
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return undefined;
  const z = surfaceZAt(surface.patch, bounds, x, y);
  return z <= maxZ ? z : undefined;
}
