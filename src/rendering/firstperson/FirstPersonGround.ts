import * as THREE from "three";
import type { PageRegion } from "../View3dHost.js";
import { CHUNK_TOP_VERTICES, type ColoredTriangles } from "./FirstPersonTerrain.js";

/** Floats per vertex of each attribute. */
const ATTRIBUTES = {
  position: 3,
  color: 3,
  groundTexel: 2,
  groundShade: 1,
  groundPage: 3,
} as const;
type AttributeName = keyof typeof ATTRIBUTES;
const NAMES = Object.keys(ATTRIBUTES) as AttributeName[];
/** Chunks per mesh: 2.2 MiB of vertex data, allocated and uploaded whole once. */
export const GROUND_BLOCK_CHUNKS = 32;

/** One mesh of `GROUND_BLOCK_CHUNKS` slots. */
interface Block {
  readonly mesh: THREE.Mesh;
  readonly arrays: Record<AttributeName, Float32Array>;
  /** The chunk in each slot. */
  readonly used: (string | undefined)[];
  count: number;
}

/**
 * Every resident chunk's tile tops in a few meshes (251): one draw per 32
 * chunks instead of one per chunk. A chunk's tops are always the same number of
 * vertices, so each chunk owns a slot of a block's buffers: a chunk that
 * arrives, changes or leaves uploads its own slot and nothing else. Blocks are
 * fixed in size, so more chunks mean another block, never a larger buffer to
 * fill again; a block whose chunks have all left is freed.
 *
 * Besides position and flat colour, every vertex carries its place in the
 * chunk's ground image (`groundTexel`) and where that image's page sits in the
 * page atlas (`groundPage`: corner x, corner y, layer; layer −1 keeps the flat
 * colour). The page is per vertex because chunks share a mesh. `groundShade`
 * darkens the artwork (raised ground, `RAISED_ART_SHADE`).
 *
 * A chunk's cliff faces that wear its image (`TerrainChunk.cliffs`) are a mesh
 * of their own, made only where there is raised ground, and bound to the same
 * page. `made` sees each such mesh (the sun's casters).
 */
export class GroundTops {
  /** Parent of the blocks' meshes. */
  readonly root = new THREE.Group();
  private readonly blocks: (Block | undefined)[] = [];
  private readonly slots = new Map<string, { block: Block; slot: number }>();
  private readonly cliffs = new Map<string, THREE.Mesh>();

  constructor(
    parent: THREE.Object3D,
    private readonly material: THREE.Material,
    private readonly made?: (mesh: THREE.Mesh) => void,
  ) {
    parent.add(this.root);
  }

  /** Chunks drawn. */
  get count(): number {
    return this.slots.size;
  }

  /** Meshes they are drawn as. */
  get meshes(): number {
    return this.root.children.length;
  }

  /** Add a chunk's tops (and textured cliffs) or replace them. They draw flat
   * colours until `bind`. */
  set(key: string, tops: ColoredTriangles, cliffs?: ColoredTriangles): void {
    if (tops.positions.length !== CHUNK_TOP_VERTICES * 3 || !tops.texels || !tops.artShades)
      throw Error("A chunk's ground tops must be one textured quad per tile");
    this.setCliffs(key, cliffs);
    let place = this.slots.get(key);
    if (!place) {
      place = this.take();
      place.block.used[place.slot] = key;
      place.block.count++;
      this.slots.set(key, place);
    }
    const { block, slot } = place;
    write(block, slot, "position", tops.positions);
    write(block, slot, "color", tops.colors);
    write(block, slot, "groundTexel", tops.texels);
    write(block, slot, "groundShade", tops.artShades);
    fill(block, slot, "groundPage", -1, -1, -1);
    range(block);
  }

  /** Point a chunk's tops at its ground page, or back at their flat colours. */
  bind(key: string, page: PageRegion | undefined): void {
    const place = this.slots.get(key);
    if (place)
      fill(place.block, place.slot, "groundPage", page?.x ?? -1, page?.y ?? -1, page?.layer ?? -1);
    const cliffs = this.cliffs.get(key);
    if (cliffs) bindPage(cliffs.geometry, page);
  }

  private setCliffs(key: string, cliffs: ColoredTriangles | undefined): void {
    this.cliffs.get(key)?.geometry.dispose();
    this.cliffs.get(key)?.removeFromParent();
    this.cliffs.delete(key);
    if (!cliffs?.positions.length || !cliffs.texels || !cliffs.artShades) return;
    const geometry = new THREE.BufferGeometry();
    const count = cliffs.positions.length / 3;
    geometry.setAttribute("position", new THREE.BufferAttribute(cliffs.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(cliffs.colors, 3));
    geometry.setAttribute("groundTexel", new THREE.BufferAttribute(cliffs.texels, 2));
    geometry.setAttribute("groundShade", new THREE.BufferAttribute(cliffs.artShades, 1));
    geometry.setAttribute(
      "groundPage",
      new THREE.BufferAttribute(new Float32Array(count * 3).fill(-1), 3),
    );
    const mesh = new THREE.Mesh(geometry, this.material);
    this.root.add(mesh);
    this.cliffs.set(key, mesh);
    this.made?.(mesh);
  }

  delete(key: string): void {
    this.setCliffs(key, undefined);
    const place = this.slots.get(key);
    if (!place) return;
    this.slots.delete(key);
    const { block, slot } = place;
    block.used[slot] = undefined;
    if (--block.count === 0) {
      block.mesh.geometry.dispose();
      block.mesh.removeFromParent();
      this.blocks[this.blocks.indexOf(block)] = undefined;
      return;
    }
    // Triangles with every corner in one place draw nothing.
    fill(block, slot, "position", 0, 0, 0);
    range(block);
  }

  /** The first free slot of the first block that has one, else of a new block. */
  private take(): { block: Block; slot: number } {
    for (const block of this.blocks)
      if (block && block.count < GROUND_BLOCK_CHUNKS)
        return { block, slot: block.used.indexOf(undefined) };
    const geometry = new THREE.BufferGeometry();
    const arrays = {} as Record<AttributeName, Float32Array>;
    for (const name of NAMES) {
      arrays[name] = new Float32Array(GROUND_BLOCK_CHUNKS * CHUNK_TOP_VERTICES * ATTRIBUTES[name]);
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(arrays[name], ATTRIBUTES[name]).setUsage(THREE.DynamicDrawUsage),
      );
    }
    const mesh = new THREE.Mesh(geometry, this.material);
    // A block's chunks can lie anywhere around the view.
    mesh.frustumCulled = false;
    this.root.add(mesh);
    const block: Block = {
      mesh,
      arrays,
      used: new Array(GROUND_BLOCK_CHUNKS).fill(undefined),
      count: 0,
    };
    const free = this.blocks.indexOf(undefined);
    this.blocks[free < 0 ? this.blocks.length : free] = block;
    return { block, slot: 0 };
  }

  dispose(): void {
    for (const block of this.blocks) block?.mesh.geometry.dispose();
    for (const mesh of this.cliffs.values()) mesh.geometry.dispose();
    this.cliffs.clear();
    this.blocks.length = 0;
    this.slots.clear();
    this.root.clear();
    this.root.removeFromParent();
  }
}

function write(block: Block, slot: number, name: AttributeName, values: Float32Array): void {
  block.arrays[name].set(values, slot * CHUNK_TOP_VERTICES * ATTRIBUTES[name]);
  upload(block, slot, name);
}

function fill(block: Block, slot: number, name: AttributeName, ...value: number[]): void {
  const size = ATTRIBUTES[name],
    array = block.arrays[name];
  const start = slot * CHUNK_TOP_VERTICES * size;
  for (let i = 0; i < CHUNK_TOP_VERTICES * size; i++) array[start + i] = value[i % size] ?? 0;
  upload(block, slot, name);
}

function bindPage(geometry: THREE.BufferGeometry, page: PageRegion | undefined): void {
  const attribute = geometry.getAttribute("groundPage") as THREE.BufferAttribute;
  const array = attribute.array as Float32Array;
  const value = [page?.x ?? -1, page?.y ?? -1, page?.layer ?? -1];
  for (let i = 0; i < array.length; i++) array[i] = value[i % 3] ?? -1;
  attribute.needsUpdate = true;
}

/** Mark one slot of one attribute for upload. */
function upload(block: Block, slot: number, name: AttributeName): void {
  const attribute = block.mesh.geometry.getAttribute(name) as THREE.BufferAttribute;
  const count = CHUNK_TOP_VERTICES * ATTRIBUTES[name];
  attribute.addUpdateRange(slot * count, count);
  attribute.needsUpdate = true;
}

/** Draw up to the block's last slot in use. */
function range(block: Block): void {
  let end = GROUND_BLOCK_CHUNKS;
  while (end > 0 && block.used[end - 1] === undefined) end--;
  block.mesh.geometry.setDrawRange(0, end * CHUNK_TOP_VERTICES);
}
