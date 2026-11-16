import * as THREE from "three";
import type { DecalMask } from "../ProjectedDecals.js";
import type { DecalItem, ParticleItem } from "../SceneItem.js";
import { planeZ } from "../SurfaceReceivers.js";

/** What the effects mesh draws: the play view's particles and surface marks. */
export type EffectItem = ParticleItem | DecalItem;

/** Mask cells in the effects' alpha map, left to right; `solid` is opaque. */
const MASK_CELLS: readonly (DecalMask | "solid")[] = ["ring", "oval", "vehicle", "solid"];
const CELL = 64;

/** The fixed view's decal masks (`ProjectedDecals`), at the same size. */
function maskAlpha(kind: DecalMask | "solid", x: number, y: number): number {
  const r = Math.hypot(x, y);
  const a =
    kind === "solid"
      ? 1
      : kind === "oval"
        ? (1 - r) / 0.2
        : kind === "ring"
          ? (0.12 - Math.abs(r - 0.72)) / 0.08
          : (0.18 - Math.hypot(Math.max(0, Math.abs(x) - 0.72), Math.max(0, Math.abs(y) - 0.72))) /
            0.12;
  return Math.max(0, Math.min(1, a));
}

function maskTexture(): THREE.DataTexture {
  const width = CELL * MASK_CELLS.length;
  const data = new Uint8Array(width * CELL * 4);
  MASK_CELLS.forEach((kind, cell) => {
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        const a = maskAlpha(kind, (x + 0.5) / (CELL / 2) - 1, (y + 0.5) / (CELL / 2) - 1);
        const i = (y * width + cell * CELL + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = Math.round(a * 255);
      }
  });
  const texture = new THREE.DataTexture(data, width, CELL);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** U of a mask's cell in the alpha map, for `u` 0…1 across it. */
function cellU(kind: DecalMask | "solid", u: number): number {
  const cell = MASK_CELLS.indexOf(kind);
  // Half a texel inside the cell: linear filtering must not reach its neighbour.
  const inset = 0.5 / CELL;
  return (cell + inset + u * (1 - 2 * inset)) / MASK_CELLS.length;
}

/** How far nearer than its surface a mark lies, along the view ray (world px). */
export const MARK_LIFT = 0.25;

/**
 * Particles and surface marks in the 3D scene, as the fixed view draws them
 * (renderer unification, slice 5): a particle is a square of its colour
 * standing upright at its point, facing the camera; a mark (the landing ring)
 * lies on the deck or ground it was projected onto with the fixed view's mask.
 * Both blend and leave depth alone, so bodies and walls in front hide them.
 * One mesh, rewritten every frame; there are only ever a few hundred.
 */
export class EffectQuads {
  count = 0;
  readonly mesh: THREE.Mesh;
  private positions = new Float32Array(0);
  private colors = new Float32Array(0);
  private uvs = new Float32Array(0);
  private index = new Uint32Array(0);
  private vertices = 0;
  private indices = 0;
  private readonly palette = new Map<string, THREE.Color>();
  private readonly material: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Object3D) {
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaMap: maskTexture(),
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // After grass: dust kicked up in front of blades shows over them.
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);
  }

  /** Replace the frame's effects. `right` is the camera's right in game axes:
   * particles face it. */
  fill(items: readonly EffectItem[], right: { x: number; y: number }): void {
    this.vertices = this.indices = this.count = 0;
    for (const item of items)
      if (item.kind === "particle") this.particle(item, right);
      else this.decal(item);
    this.mesh.visible = this.indices > 0;
    if (!this.indices) return;
    const geometry = this.mesh.geometry;
    for (const name of ["position", "color", "uv"])
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getIndex() as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, this.indices);
  }

  private particle(item: ParticleItem, right: { x: number; y: number }): void {
    const half = item.size / 2;
    const { wx: x, wy: y, z } = item;
    const colour = this.colour(item.color);
    const first = this.reserve(4, 6);
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const)
      this.vertex(
        x + right.x * a * half,
        y + right.y * a * half,
        z + b * half,
        colour,
        item.alpha,
        cellU("solid", 0.5),
        0.5,
      );
    this.quad(first, first + 1, first + 2, first + 3);
    this.count++;
  }

  private decal(item: DecalItem): void {
    const colour = this.colour(item.color);
    for (const polygon of item.polygons) {
      if (polygon.length < 3) continue;
      const first = this.reserve(polygon.length, (polygon.length - 2) * 3);
      for (const p of polygon) {
        const z = planeZ(item.plane, p.x, p.y);
        // Nearer along the view ray (south and up) than the surface it marks.
        this.vertex(
          p.x,
          p.y + MARK_LIFT,
          z + MARK_LIFT,
          colour,
          item.alpha,
          cellU(item.mask, p.u),
          p.v,
        );
      }
      for (let i = 1; i < polygon.length - 1; i++) this.triangle(first, first + i, first + i + 1);
    }
    this.count++;
  }

  private colour(css: string): THREE.Color {
    let colour = this.palette.get(css);
    if (!colour) {
      colour = new THREE.Color(css);
      this.palette.set(css, colour);
    }
    return colour;
  }

  /** Room for more vertices and indices; returns the first new vertex. */
  private reserve(vertices: number, indices: number): number {
    if (
      this.vertices + vertices > this.positions.length / 3 ||
      this.indices + indices > this.index.length
    )
      this.grow(this.vertices + vertices, this.indices + indices);
    return this.vertices;
  }

  private vertex(
    x: number,
    y: number,
    z: number,
    colour: THREE.Color,
    alpha: number,
    u: number,
    v: number,
  ): void {
    const v3 = this.vertices * 3;
    this.positions[v3] = x;
    this.positions[v3 + 1] = y;
    this.positions[v3 + 2] = z;
    const c = this.vertices * 4;
    this.colors[c] = colour.r;
    this.colors[c + 1] = colour.g;
    this.colors[c + 2] = colour.b;
    this.colors[c + 3] = alpha;
    this.uvs[this.vertices * 2] = u;
    this.uvs[this.vertices * 2 + 1] = v;
    this.vertices++;
  }

  private triangle(a: number, b: number, c: number): void {
    this.index[this.indices++] = a;
    this.index[this.indices++] = b;
    this.index[this.indices++] = c;
  }

  private quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  private grow(vertices: number, indices: number): void {
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(256, vertices, indices)));
    const keep = <T extends Float32Array | Uint32Array>(
      old: T,
      size: number,
      make: (n: number) => T,
    ) => {
      const next = make(size);
      next.set(old.subarray(0, Math.min(old.length, size)));
      return next;
    };
    this.positions = keep(this.positions, capacity * 3, (n) => new Float32Array(n));
    this.colors = keep(this.colors, capacity * 4, (n) => new Float32Array(n));
    this.uvs = keep(this.uvs, capacity * 2, (n) => new Float32Array(n));
    this.index = keep(this.index, capacity * 2, (n) => new Uint32Array(n));
    const geometry = new THREE.BufferGeometry();
    const dynamic = (array: Float32Array, size: number) =>
      new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", dynamic(this.positions, 3));
    geometry.setAttribute("color", dynamic(this.colors, 4));
    geometry.setAttribute("uv", dynamic(this.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(this.index, 1).setUsage(THREE.DynamicDrawUsage));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.alphaMap?.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
