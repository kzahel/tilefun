import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { GRASS_ANCHOR_X, GRASS_ANCHOR_Y } from "../GrassBladeRenderer.js";
import type { GrassItem } from "../SceneItem.js";
import type { CardPages } from "./FirstPersonBillboards.js";

/** A blade's four corners on its card, in the order of a card's vertices
 * (bottom-left, bottom-right, top-right, top-left of the artwork): `across`
 * along the card and `up` from its anchor (below it where negative). */
export type BladeCorners = readonly [across: number, up: number][];

/** The artwork's corners as (column, row) from its top-left, in vertex order. */
const ART_CORNERS = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
] as const;

/** How much nearer than the ground it covers a blade's row below its anchor is
 * drawn (world pixels along a view ray). */
export const BLADE_GROUND_LIFT = 0.25;

/**
 * Where a blade's artwork stands in the scene. The fixed view turns the blade
 * about its anchor on screen (clockwise for a positive angle). The top-down
 * camera shows an upright card's `up` as distance up the screen, so the same
 * turn made in the card's plane lands on the same pixels.
 *
 * The card stands at the anchor, so it is nearer or farther than a body exactly
 * where the fixed view sorts it, by the anchor's row. The artwork reaches a row
 * or two below the anchor, more when it leans; those rows are under the ground,
 * and the blade material draws them at the depth of the ground they cover
 * (`bladeDepth`), so they show and still sort by their own row.
 */
export function bladeQuad(
  variant: number,
  angle: number,
  width: number,
  height: number,
): BladeCorners {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const anchorY = GRASS_ANCHOR_Y[variant] ?? 7;
  return ART_CORNERS.map(([column, row]) => {
    const x = column * width - GRASS_ANCHOR_X,
      y = row * height - anchorY;
    // Screen offsets from the anchor: right, and down.
    return [x * cos - y * sin, -(x * sin + y * cos)] as const;
  });
}

/**
 * Depth for a blade's rows below its anchor (top-down camera only). Such a row
 * `below` world pixels under the anchor stands under the ground that covers it
 * on screen: the camera shows a point that far south of the anchor on the
 * ground at the same pixel, `2 × below` nearer along the ray. Writing that
 * depth (plus `BLADE_GROUND_LIFT`) keeps the row in front of its ground and
 * behind a body whose feet are farther south, as the fixed view sorts them;
 * the rows above the anchor keep the card's own depth. Geometry cannot do this:
 * a card bent at the anchor's row would interpolate depth across the whole
 * triangle and pull the blade's top over a body's legs.
 *
 * Actor cards use it too, for the rows under their standing point (near feet),
 * with a larger `lift` that also clears the contact shadow under them.
 */
export function bladeDepth(material: THREE.Material, lift = BLADE_GROUND_LIFT): void {
  const shade = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:blade-depth:${lift}`;
  material.onBeforeCompile = (shader, renderer) => {
    shade(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vBladeBelow;\nvarying float vDepthPerNear;",
      )
      .replace(
        "#include <project_vertex>",
        // Window depth per world pixel nearer: half the clip depth per unit up.
        "#include <project_vertex>\n  vBladeBelow = -corner.y;\n  vDepthPerNear = 0.5 * projectionMatrix[2][2];",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vBladeBelow;\nvarying float vDepthPerNear;",
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
  gl_FragDepth = vBladeBelow > 0.0
    ? gl_FragCoord.z + vDepthPerNear * 2.0 * (vBladeBelow + ${lift.toFixed(2)})
    : gl_FragCoord.z;`,
      );
  };
  material.needsUpdate = true;
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
 * behind anything nearer, cover an actor's feet only from in front (south of
 * its feet, as the fixed view sorts them), and stay under vehicles, which are
 * drawn after the scene.
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
    bladeDepth(material);
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
      const [across, up] = quad[i] ?? [0, 0];
      centres[p] = blade.wx;
      centres[p + 1] = blade.wy;
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
