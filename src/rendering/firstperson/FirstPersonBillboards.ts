import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import type { SpriteItem } from "../SceneItem.js";
import { apparentDirection, type FirstPersonEye } from "./FirstPersonCamera.js";

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

/** Camera-facing upright quads for one texture, refilled every frame. */
class BillboardBatch {
  readonly mesh: THREE.Mesh;
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private count = 0;
  idleFrames = 0;

  constructor(readonly material: THREE.MeshBasicMaterial) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
  }

  begin(): void {
    this.count = 0;
  }

  push(b: Billboard, right: { x: number; y: number }): void {
    if (this.count * 18 >= this.positions.length) this.grow();
    const hx = (right.x * b.width) / 2,
      hy = (right.y * b.width) / 2;
    const [u0, v0, u1, v1] = b.uv;
    const top = b.z + b.height;
    // Bottom-left, bottom-right, top-right / bottom-left, top-right, top-left.
    const corners = [
      [b.x - hx, b.y - hy, b.z, u0, v1],
      [b.x + hx, b.y + hy, b.z, u1, v1],
      [b.x + hx, b.y + hy, top, u1, v0],
      [b.x - hx, b.y - hy, b.z, u0, v1],
      [b.x + hx, b.y + hy, top, u1, v0],
      [b.x - hx, b.y - hy, top, u0, v0],
    ] as const;
    let p = this.count * 18,
      t = this.count * 12;
    for (const c of corners) {
      this.positions[p++] = c[0];
      this.positions[p++] = c[1];
      this.positions[p++] = c[2];
      this.uvs[t++] = c[3];
      this.uvs[t++] = c[4];
    }
    this.count++;
  }

  end(): void {
    this.mesh.visible = this.count > 0;
    this.idleFrames = this.count ? 0 : this.idleFrames + 1;
    if (!this.count) return;
    const geometry = this.mesh.geometry;
    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("uv") as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, this.count * 6);
  }

  private grow(): void {
    const quads = Math.max(64, (this.positions.length / 18) * 2);
    const positions = new Float32Array(quads * 18);
    const uvs = new Float32Array(quads * 12);
    positions.set(this.positions);
    uvs.set(this.uvs);
    this.positions = positions;
    this.uvs = uvs;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
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
 * One alpha-tested batch per texture, so every billboard sharing a sheet is a
 * single draw. All quads face the camera plane (Doom/Build style).
 */
export class BillboardBatches {
  count = 0;
  private readonly batches = new Map<THREE.Texture, BillboardBatch>();
  private right = { x: 1, y: 0 };

  constructor(private readonly parent: THREE.Object3D) {}

  begin(right: { x: number; y: number }): void {
    this.right = right;
    this.count = 0;
    for (const batch of this.batches.values()) batch.begin();
  }

  push(billboard: Billboard): void {
    let batch = this.batches.get(billboard.texture);
    if (!batch) {
      batch = new BillboardBatch(
        new THREE.MeshBasicMaterial({
          map: billboard.texture,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      this.batches.set(billboard.texture, batch);
      this.parent.add(batch.mesh);
    }
    batch.push(billboard, this.right);
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
