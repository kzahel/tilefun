import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import type { Prop } from "../../entities/Prop.js";
import type { SpriteItem } from "../SceneItem.js";
import { apparentDirection, type FirstPersonEye } from "./FirstPersonCamera.js";
import type { PropImageFrame } from "./FirstPersonProps.js";

/** u0, v0 (top), u1, v1 (bottom) with v counted from the image top. */
export type UvRect = readonly [number, number, number, number];

/** An upright quad standing on its bottom-centre point, in game axes. */
export interface Billboard {
  texture: THREE.Texture;
  uv: UvRect;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

const NO_SHIFT = { x: 0, y: 0, z: 0 } as const;

/** Atlas UVs for one sheet frame; flipped sprites swap the horizontal edges. */
export function sheetUv(
  sheet: Spritesheet,
  sprite: { frameCol: number; spriteWidth: number; spriteHeight: number },
  row: number,
  flipX: boolean,
): UvRect {
  const region = sheet.getRegion(sprite.frameCol, row);
  const w = sheet.image.width,
    h = sheet.image.height;
  const u0 = region.x / w,
    u1 = (region.x + sprite.spriteWidth) / w;
  return [flipX ? u1 : u0, region.y / h, flipX ? u0 : u1, (region.y + sprite.spriteHeight) / h];
}

/** The fixed view's roof-rider shift, applied only while the supporting mesh is drawn. */
function roofShift(
  support: SpriteItem["meshRoofSupport"],
  ready: ReadonlySet<string>,
): { x: number; y: number; z: number } {
  if (!support || !ready.has(support.assetId)) return NO_SHIFT;
  if (support.ownerAssetId && !ready.has(support.ownerAssetId)) return NO_SHIFT;
  return { x: support.offsetX ?? 0, y: support.offsetY ?? 0, z: support.heightDelta };
}

/**
 * Upright placement of one collected actor sprite: feet at its displayed position
 * and height (minus the draw offset), with four-direction rows reselected for the
 * side that faces the eye.
 */
export function actorBillboard(
  item: SpriteItem,
  sheet: Spritesheet,
  texture: THREE.Texture,
  eye: FirstPersonEye,
  ready: ReadonlySet<string>,
): Billboard {
  const shift = roofShift(item.meshRoofSupport, ready);
  const x = item.wx + shift.x,
    y = item.wy + shift.y;
  const row =
    item.facing === undefined
      ? item.frameRow
      : apparentDirection(item.facing, Math.atan2(y - eye.y, x - eye.x));
  return {
    texture,
    uv: sheetUv(sheet, item, row, item.flipX),
    x,
    y,
    z: item.zOffset - item.drawOffsetY - shift.z,
    width: item.spriteWidth,
    height: item.spriteHeight * (item.scaleY ?? 1),
  };
}

/** Vertices and indices per card: bottom-left, bottom-right, top-right, top-left. */
const CARD_INDICES = [0, 1, 2, 0, 2, 3] as const;

/**
 * Cards as shader-expanded quads. Every vertex carries the card's foot centre, its
 * corner offset (across, up) and its UV; the vertex shader places it along one
 * shared horizontal axis. Turning the camera therefore changes a uniform, not
 * vertex data, and the same cards can be drawn facing the sun for its shadow map.
 */
export class CardArrays {
  centres: Float32Array;
  corners: Float32Array;
  uvs: Float32Array;
  count = 0;

  constructor(capacity: number) {
    this.centres = new Float32Array(capacity * 12);
    this.corners = new Float32Array(capacity * 8);
    this.uvs = new Float32Array(capacity * 8);
  }

  get capacity(): number {
    return this.corners.length / 8;
  }

  push(b: Billboard): void {
    const { centres, corners, uvs } = this;
    const half = b.width / 2;
    const [u0, v0, u1, v1] = b.uv;
    let p = this.count * 12,
      c = this.count * 8;
    for (let i = 0; i < 4; i++) {
      centres[p++] = b.x;
      centres[p++] = b.y;
      centres[p++] = b.z;
      const right = i === 1 || i === 2,
        top = i >= 2;
      corners[c] = right ? half : -half;
      corners[c + 1] = top ? b.height : 0;
      uvs[c] = right ? u1 : u0;
      uvs[c + 1] = top ? v0 : v1;
      c += 2;
    }
    this.count++;
  }

  /** Copies another set's cards after this one's; the capacity must already fit. */
  append(other: CardArrays): void {
    this.centres.set(other.centres.subarray(0, other.count * 12), this.count * 12);
    this.corners.set(other.corners.subarray(0, other.count * 8), this.count * 8);
    this.uvs.set(other.uvs.subarray(0, other.count * 8), this.count * 8);
    this.count += other.count;
  }
}

function cardGeometry(arrays: CardArrays, usage: THREE.Usage): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(arrays.centres, 3).setUsage(usage));
  geometry.setAttribute("corner", new THREE.BufferAttribute(arrays.corners, 2).setUsage(usage));
  geometry.setAttribute("uv", new THREE.BufferAttribute(arrays.uvs, 2).setUsage(usage));
  const capacity = arrays.capacity;
  const index =
    capacity * 4 > 65535 ? new Uint32Array(capacity * 6) : new Uint16Array(capacity * 6);
  for (let card = 0; card < capacity; card++)
    for (let i = 0; i < 6; i++) index[card * 6 + i] = card * 4 + (CARD_INDICES[i] ?? 0);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, arrays.count * 6);
  return geometry;
}

/** Builds the material for one texture's cards; the view supplies shading. */
export type CardMaterial = (texture: THREE.Texture) => THREE.Material;

/** Moving cards for one texture, refilled every frame. */
class BillboardBatch {
  readonly mesh: THREE.Mesh;
  private arrays = new CardArrays(0);
  idleFrames = 0;

  constructor(readonly material: THREE.Material) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
  }

  begin(): void {
    this.arrays.count = 0;
  }

  push(b: Billboard): void {
    if (this.arrays.count >= this.arrays.capacity) this.grow();
    this.arrays.push(b);
  }

  end(): void {
    const count = this.arrays.count;
    this.mesh.visible = count > 0;
    this.idleFrames = count ? 0 : this.idleFrames + 1;
    if (!count) return;
    const geometry = this.mesh.geometry;
    for (const name of ["position", "corner", "uv"])
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, count * 6);
  }

  private grow(): void {
    const grown = new CardArrays(Math.max(64, this.arrays.capacity * 2));
    grown.append(this.arrays);
    this.arrays = grown;
    this.mesh.geometry.dispose();
    this.mesh.geometry = cardGeometry(grown, THREE.DynamicDrawUsage);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}

/** Batches older than this many frames without quads release their buffers. */
const IDLE_FRAMES = 600;

/**
 * Moving actors: one alpha-tested batch per texture, so every billboard sharing a
 * sheet is a single draw. All quads face the camera plane (Doom/Build style).
 */
export class BillboardBatches {
  count = 0;
  private readonly batches = new Map<THREE.Texture, BillboardBatch>();

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly material: CardMaterial,
  ) {}

  begin(): void {
    this.count = 0;
    for (const batch of this.batches.values()) batch.begin();
  }

  push(billboard: Billboard): void {
    let batch = this.batches.get(billboard.texture);
    if (!batch) {
      batch = new BillboardBatch(this.material(billboard.texture));
      this.batches.set(billboard.texture, batch);
      this.parent.add(batch.mesh);
    }
    batch.push(billboard);
    this.count++;
  }

  end(): void {
    for (const [texture, batch] of this.batches) {
      batch.end();
      if (batch.idleFrames > IDLE_FRAMES) {
        batch.dispose();
        this.batches.delete(texture);
      }
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) batch.dispose();
    this.batches.clear();
  }
}

interface StaticBatch {
  readonly mesh: THREE.Mesh;
  /** The same cards facing the sun, drawn only into its shadow map. */
  readonly caster: THREE.Mesh | undefined;
  dirty: boolean;
}

/**
 * Standing props (trees, posts, signs, forest rows): each chunk's cards are built
 * once, and all resident chunks merge into one mesh per texture. Nothing is
 * written per frame; a merged mesh is rebuilt only when one of its chunks changes.
 */
export class StaticCards {
  count = 0;
  private readonly chunks = new Map<string, Map<THREE.Texture, CardArrays>>();
  private readonly batches = new Map<THREE.Texture, StaticBatch>();

  /** `casters` receives the sun-facing copies when `casterMaterial` is given. */
  constructor(
    private readonly parent: THREE.Object3D,
    private readonly material: CardMaterial,
    private readonly casters?: THREE.Object3D,
    private readonly casterMaterial?: CardMaterial,
  ) {}

  /** Replace one chunk's cards. */
  set(key: string, cards: readonly Billboard[]): void {
    this.delete(key);
    if (!cards.length) return;
    const counts = new Map<THREE.Texture, number>();
    for (const card of cards) counts.set(card.texture, (counts.get(card.texture) ?? 0) + 1);
    const byTexture = new Map<THREE.Texture, CardArrays>();
    for (const [texture, count] of counts) byTexture.set(texture, new CardArrays(count));
    for (const card of cards) byTexture.get(card.texture)?.push(card);
    this.chunks.set(key, byTexture);
    for (const texture of byTexture.keys()) this.touch(texture);
  }

  delete(key: string): void {
    const previous = this.chunks.get(key);
    if (!previous) return;
    this.chunks.delete(key);
    for (const texture of previous.keys()) this.touch(texture);
  }

  private touch(texture: THREE.Texture): void {
    let batch = this.batches.get(texture);
    if (!batch) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material(texture));
      mesh.frustumCulled = false;
      this.parent.add(mesh);
      let caster: THREE.Mesh | undefined;
      if (this.casters && this.casterMaterial) {
        caster = new THREE.Mesh(mesh.geometry, this.casterMaterial(texture));
        caster.frustumCulled = false;
        this.casters.add(caster);
      }
      batch = { mesh, caster, dirty: true };
      this.batches.set(texture, batch);
    }
    batch.dirty = true;
  }

  /** Rebuild the merged meshes whose chunks changed; true when any did. */
  flush(): boolean {
    let changed = false;
    for (const [texture, batch] of this.batches) {
      if (!batch.dirty) continue;
      batch.dirty = false;
      changed = true;
      let total = 0;
      for (const chunk of this.chunks.values()) total += chunk.get(texture)?.count ?? 0;
      batch.mesh.geometry.dispose();
      if (!total) {
        this.release(batch);
        this.batches.delete(texture);
        continue;
      }
      const merged = new CardArrays(total);
      for (const chunk of this.chunks.values()) {
        const part = chunk.get(texture);
        if (part) merged.append(part);
      }
      batch.mesh.geometry = cardGeometry(merged, THREE.StaticDrawUsage);
      if (batch.caster) batch.caster.geometry = batch.mesh.geometry;
    }
    if (changed) {
      this.count = 0;
      for (const chunk of this.chunks.values())
        for (const part of chunk.values()) this.count += part.count;
    }
    return changed;
  }

  private release(batch: StaticBatch): void {
    for (const mesh of [batch.mesh, batch.caster]) {
      if (!mesh) continue;
      (mesh.material as THREE.Material).dispose();
      mesh.removeFromParent();
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.geometry.dispose();
      this.release(batch);
    }
    this.batches.clear();
    this.chunks.clear();
    this.count = 0;
  }
}

/**
 * An upright card of composed artwork whose frame is relative to the prop's feet:
 * the frame's row 0 (the prop's anchor row) meets the ground. Outdoor art is
 * anchored at its bottom centre. Room furniture is anchored at its ground contact
 * with intentional transparent padding below, which stays under the floor.
 */
export function artCard(
  prop: Prop,
  frame: PropImageFrame,
  texture: THREE.Texture,
  elevation: number,
): Billboard {
  return {
    texture,
    uv: [0, 0, 1, 1],
    x: prop.position.wx + frame.left + frame.width / 2,
    y: prop.position.wy,
    z: elevation - (frame.top + frame.height),
    width: frame.width,
    height: frame.height,
  };
}
