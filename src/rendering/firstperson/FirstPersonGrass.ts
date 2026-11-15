import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { GRASS_ANCHOR_X, GRASS_ANCHOR_Y } from "../GrassBladeRenderer.js";
import type { GrassItem } from "../SceneItem.js";
import type { CardPages } from "./FirstPersonBillboards.js";

/** A blade's four corners on its card, in the order of a card's vertices
 * (bottom-left, bottom-right, top-right, top-left of the artwork): `across`
 * along the card and `up` from its foot. */
export interface BladeQuad {
  /** How far south of the blade's anchor the card stands. */
  south: number;
  corners: readonly [across: number, up: number][];
}

/** The artwork's corners as (column, row) from its top-left, in vertex order. */
const ART_CORNERS = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
] as const;

/**
 * Where a blade's artwork stands in the scene. The fixed view turns the blade
 * about its anchor on screen (clockwise for a positive angle). The top-down
 * camera shows an upright card's `up` as distance up the screen, so the same
 * turn made in the card's plane lands on the same pixels.
 *
 * The artwork reaches a row or two below its anchor, more when it leans. Below
 * the ground the ground in front would hide it, so the card stands just far
 * enough south of the anchor for its lowest corner to touch the ground.
 */
export function bladeQuad(
  variant: number,
  angle: number,
  width: number,
  height: number,
): BladeQuad {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const anchorY = GRASS_ANCHOR_Y[variant] ?? 7;
  // Screen offsets from the anchor: right, and down.
  const offsets = ART_CORNERS.map(([column, row]) => {
    const x = column * width - GRASS_ANCHOR_X,
      y = row * height - anchorY;
    return [x * cos - y * sin, x * sin + y * cos] as const;
  });
  const south = Math.max(0, ...offsets.map(([, down]) => down));
  return { south, corners: offsets.map(([right, down]) => [right, south - down]) };
}

const CARD_INDICES = [0, 1, 2, 0, 2, 3] as const;
/** Lookups stay this far (texels) inside a blade's cell: its neighbours are other blades. */
const EDGE_INSET = 0.01;

/**
 * Grass blades in the 3D scene (renderer unification, slice 5): the blades the
 * fixed view collected for this frame, with its sway and push already in each
 * blade's angle, as one mesh of leaning cards read from the page atlas.
 *
 * Blades blend at the frame's grass opacity and do not write depth: they hide
 * behind anything nearer, cover an actor's feet from in front, and stay under
 * vehicles, which are drawn after the scene.
 */
export class GrassCards {
  /** Blades written this frame. */
  count = 0;
  readonly mesh: THREE.Mesh;
  private centres = new Float32Array(0);
  private corners = new Float32Array(0);
  private pages = new Float32Array(0);

  constructor(
    parent: THREE.Object3D,
    private readonly material: THREE.MeshBasicMaterial,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // After contact shadows, which lie on the ground under the blades.
    this.mesh.renderOrder = 1;
    parent.add(this.mesh);
  }

  /** Replace the frame's blades; none, or a sheet whose page is not in the atlas, hides the mesh. */
  fill(blades: readonly GrassItem[], sheet: Spritesheet | undefined, pages: CardPages): void {
    this.count = 0;
    const size = pages.pageSize;
    if (sheet && blades.length && size > 0) {
      if (blades.length * 12 > this.centres.length) this.grow(blades.length);
      const image = sheet.image as CanvasImageSource;
      for (const blade of blades) {
        const cell = sheet.getRegion(blade.variant, 0);
        const px = Math.floor(cell.x / size) * size,
          py = Math.floor(cell.y / size) * size;
        // A cell is far smaller than a page; one that straddled two is not drawn.
        if (cell.x + cell.width > px + size || cell.y + cell.height > py + size) continue;
        const region = pages.page(image, px, py);
        if (!region) continue;
        this.write(
          blade,
          cell,
          region.x + cell.x - px,
          region.y + region.height - (cell.y - py),
          region.layer,
        );
      }
    }
    this.material.opacity = blades[0]?.alpha ?? 1;
    this.mesh.visible = this.count > 0;
    if (!this.count) return;
    const geometry = this.mesh.geometry;
    for (const name of ["position", "corner", "cardPage"])
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, this.count * 6);
  }

  /** `left` and `top` are the cell's corner in its atlas layer, whose rows run bottom first. */
  private write(
    blade: GrassItem,
    cell: { width: number; height: number },
    left: number,
    top: number,
    layer: number,
  ): void {
    const quad = bladeQuad(blade.variant, blade.angle, cell.width, cell.height);
    const { centres, corners, pages } = this;
    let p = this.count * 12,
      c = this.count * 8;
    for (let i = 0; i < 4; i++) {
      const [column, row] = ART_CORNERS[i] ?? [0, 0];
      const [across, up] = quad.corners[i] ?? [0, 0];
      centres[p] = blade.wx;
      centres[p + 1] = blade.wy + quad.south;
      centres[p + 2] = 0;
      corners[c] = across;
      corners[c + 1] = up;
      pages[p] = left + (column ? cell.width - EDGE_INSET : EDGE_INSET);
      pages[p + 1] = top - (row ? cell.height - EDGE_INSET : EDGE_INSET);
      pages[p + 2] = layer;
      p += 3;
      c += 2;
    }
    this.count++;
  }

  private grow(blades: number): void {
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(256, blades)));
    this.centres = new Float32Array(capacity * 12);
    this.corners = new Float32Array(capacity * 8);
    this.pages = new Float32Array(capacity * 12);
    const geometry = new THREE.BufferGeometry();
    const dynamic = (array: Float32Array, size: number) =>
      new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", dynamic(this.centres, 3));
    geometry.setAttribute("corner", dynamic(this.corners, 2));
    geometry.setAttribute("cardPage", dynamic(this.pages, 3));
    const index =
      capacity * 4 > 65535 ? new Uint32Array(capacity * 6) : new Uint16Array(capacity * 6);
    for (let blade = 0; blade < capacity; blade++)
      for (let i = 0; i < 6; i++) index[blade * 6 + i] = blade * 4 + (CARD_INDICES[i] ?? 0);
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
