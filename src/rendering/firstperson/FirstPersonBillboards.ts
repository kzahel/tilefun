import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import type { Prop } from "../../entities/Prop.js";
import type { SpriteItem } from "../SceneItem.js";
import type { PageRegion, SharedPages } from "../View3dHost.js";
import { apparentDirection, type FirstPersonEye } from "./FirstPersonCamera.js";
import type { PropImageFrame } from "./FirstPersonProps.js";

/** Where cards find their artwork: the host's page atlas (250). */
export type CardPages = Pick<SharedPages, "pageSize" | "page">;

/** An upright quad standing on its bottom-centre point, in game axes. It shows a
 * rectangle of an image (a sheet or a composed canvas), in image pixels. */
export interface Billboard {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Mirrored left to right. */
  flipX?: boolean;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

/**
 * A frame's pages with the last answer remembered: cards that follow each other
 * usually share a sheet page, so a crowd costs one request to the host.
 */
export class RecentPages implements CardPages {
  pageSize = 0;
  private source: CardPages | undefined;
  private image: CanvasImageSource | undefined;
  private x = 0;
  private y = 0;
  private region: PageRegion | undefined;

  /** Start a display frame: earlier answers are forgotten. */
  begin(source: CardPages): void {
    this.source = source;
    this.pageSize = source.pageSize;
    this.image = undefined;
  }

  page(image: CanvasImageSource, x: number, y: number): PageRegion | undefined {
    if (image !== this.image || x !== this.x || y !== this.y) {
      this.region = this.source?.page(image, x, y);
      this.image = image;
      this.x = x;
      this.y = y;
    }
    return this.region;
  }
}

const NO_SHIFT = { x: 0, y: 0, z: 0 } as const;

/** One sheet frame as a card's artwork. */
export function sheetFrame(
  sheet: Spritesheet,
  sprite: { frameCol: number; spriteWidth: number; spriteHeight: number },
  row: number,
): Pick<Billboard, "image" | "sx" | "sy" | "sw" | "sh"> {
  const region = sheet.getRegion(sprite.frameCol, row);
  return {
    image: sheet.image as CanvasImageSource,
    sx: region.x,
    sy: region.y,
    sw: sprite.spriteWidth,
    sh: sprite.spriteHeight,
  };
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
    ...sheetFrame(sheet, item, row),
    flipX: item.flipX,
    x,
    y,
    z: item.zOffset - item.drawOffsetY - shift.z,
    width: item.spriteWidth,
    height: item.spriteHeight * (item.scaleY ?? 1),
  };
}

/** Vertices and indices per quad: bottom-left, bottom-right, top-right, top-left. */
const CARD_INDICES = [0, 1, 2, 0, 2, 3] as const;
/** Lookups stay this far (texels) inside a card's artwork: the texels around it
 * belong to other frames, or to other images in the atlas layer. */
const EDGE_INSET = 0.01;

/**
 * Cards as shader-expanded quads. Every vertex carries the card's foot centre, its
 * corner offset (across, up) and its place in the page atlas (texel x, texel y,
 * layer); the vertex shader places it along one shared horizontal axis. Turning
 * the camera therefore changes a uniform, not vertex data, and the same cards can
 * be drawn facing the sun for its shadow map.
 *
 * A card whose artwork crosses a page boundary is written as one quad per page.
 */
export class CardArrays {
  centres: Float32Array;
  corners: Float32Array;
  pages: Float32Array;
  /** Quads written. */
  count = 0;

  constructor(capacity: number) {
    this.centres = new Float32Array(capacity * 12);
    this.corners = new Float32Array(capacity * 8);
    this.pages = new Float32Array(capacity * 12);
  }

  get capacity(): number {
    return this.corners.length / 8;
  }

  /** Writes the card; false, writing nothing, when a page it needs is not in the atlas. */
  push(b: Billboard, pages: CardPages): boolean {
    if (!(b.sw > 0 && b.sh > 0)) return false;
    const size = pages.pageSize;
    const start = this.count;
    const right = b.sx + b.sw,
      bottom = b.sy + b.sh;
    for (let py = Math.floor(b.sy / size) * size; py < bottom; py += size)
      for (let px = Math.floor(b.sx / size) * size; px < right; px += size) {
        const region = pages.page(b.image, px, py);
        if (!region) {
          this.count = start;
          return false;
        }
        this.quad(
          b,
          region,
          Math.max(px, b.sx) - px,
          Math.max(py, b.sy) - py,
          Math.min(px + size, right) - px,
          Math.min(py + size, bottom) - py,
          px,
          py,
        );
      }
    return true;
  }

  /** The part of the card inside one page; the rectangle is in page texels. */
  private quad(
    b: Billboard,
    region: PageRegion,
    left: number,
    top: number,
    right: number,
    bottom: number,
    px: number,
    py: number,
  ): void {
    if (this.count >= this.capacity) this.grow();
    const { centres, corners, pages } = this;
    // Where the part sits on the card: across from the card's left, up from its feet.
    const across = (x: number) => ((px + x - b.sx) / b.sw - 0.5) * b.width * (b.flipX ? -1 : 1);
    const up = (y: number) => (1 - (py + y - b.sy) / b.sh) * b.height;
    const a0 = across(left),
      a1 = across(right);
    // Pages store their rows bottom first.
    const u0 = region.x + left + EDGE_INSET,
      u1 = region.x + right - EDGE_INSET;
    const vTop = region.y + region.height - top - EDGE_INSET,
      vBottom = region.y + region.height - bottom + EDGE_INSET;
    let p = this.count * 12,
      c = this.count * 8;
    for (let i = 0; i < 4; i++) {
      centres[p] = b.x;
      centres[p + 1] = b.y;
      centres[p + 2] = b.z;
      const east = i === 1 || i === 2,
        high = i >= 2;
      // A mirrored card's left edge shows the artwork's right edge.
      const first = east === a0 > a1;
      corners[c] = first ? a0 : a1;
      corners[c + 1] = high ? up(top) : up(bottom);
      pages[p] = first ? u0 : u1;
      pages[p + 1] = high ? vTop : vBottom;
      pages[p + 2] = region.layer;
      p += 3;
      c += 2;
    }
    this.count++;
  }

  private grow(): void {
    const capacity = Math.max(64, this.capacity * 2);
    const grown = (old: Float32Array, per: number) => {
      const next = new Float32Array(capacity * per);
      next.set(old);
      return next;
    };
    this.centres = grown(this.centres, 12);
    this.corners = grown(this.corners, 8);
    this.pages = grown(this.pages, 12);
  }

  /** Copies another set's quads after this one's; the capacity must already fit. */
  append(other: CardArrays): void {
    this.centres.set(other.centres.subarray(0, other.count * 12), this.count * 12);
    this.corners.set(other.corners.subarray(0, other.count * 8), this.count * 8);
    this.pages.set(other.pages.subarray(0, other.count * 12), this.count * 12);
    this.count += other.count;
  }
}

function cardGeometry(arrays: CardArrays, usage: THREE.Usage): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(arrays.centres, 3).setUsage(usage));
  geometry.setAttribute("corner", new THREE.BufferAttribute(arrays.corners, 2).setUsage(usage));
  geometry.setAttribute("cardPage", new THREE.BufferAttribute(arrays.pages, 3).setUsage(usage));
  const capacity = arrays.capacity;
  const index =
    capacity * 4 > 65535 ? new Uint32Array(capacity * 6) : new Uint16Array(capacity * 6);
  for (let card = 0; card < capacity; card++)
    for (let i = 0; i < 6; i++) index[card * 6 + i] = card * 4 + (CARD_INDICES[i] ?? 0);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, arrays.count * 6);
  return geometry;
}

/**
 * Moving actors, refilled every frame: one alpha-tested mesh for all of them,
 * whatever their sheets, since every card reads the page atlas. All quads face
 * the camera plane (Doom/Build style).
 */
export class MovingCards {
  /** Cards written this frame. */
  count = 0;
  readonly mesh: THREE.Mesh;
  private readonly arrays = new CardArrays(0);
  /** The buffer the mesh's geometry was made from; the arrays replace theirs to grow. */
  private built: Float32Array | undefined;

  constructor(
    parent: THREE.Object3D,
    private readonly material: THREE.Material,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  begin(): void {
    this.count = 0;
    this.arrays.count = 0;
  }

  push(billboard: Billboard, pages: CardPages): void {
    if (this.arrays.push(billboard, pages)) this.count++;
  }

  end(): void {
    const { arrays } = this;
    this.mesh.visible = arrays.count > 0;
    if (!arrays.count) return;
    if (this.built !== arrays.centres) {
      this.built = arrays.centres;
      this.mesh.geometry.dispose();
      this.mesh.geometry = cardGeometry(arrays, THREE.DynamicDrawUsage);
      return;
    }
    const geometry = this.mesh.geometry;
    for (const name of ["position", "corner", "cardPage"])
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, arrays.count * 6);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}

interface ChunkCards {
  readonly cards: readonly Billboard[];
  arrays: CardArrays;
  /** Cards written (one whose page is missing is left out). */
  drawn: number;
  /** The pages the cards were written against. */
  pages: { image: CanvasImageSource; x: number; y: number; region: PageRegion | undefined }[];
}

/**
 * Standing props (trees, posts, signs, forest rows): each chunk's cards are
 * written once, and all resident chunks merge into one mesh. Nothing is written
 * per frame; the merged mesh is rebuilt only when one of its chunks changes.
 *
 * The cards hold places in the page atlas, so `keep` asks for their pages every
 * frame (a page someone asks for stays where it is) and writes the cards again
 * if the atlas gave any page a new place.
 */
export class StaticCards {
  count = 0;
  readonly mesh: THREE.Mesh;
  /** The same cards facing the sun, drawn only into its shadow map. */
  readonly caster: THREE.Mesh | undefined;
  private readonly chunks = new Map<string, ChunkCards>();
  private dirty = false;

  /** `casters` receives the sun-facing copy when `casterMaterial` is given. */
  constructor(
    parent: THREE.Object3D,
    private readonly material: THREE.Material,
    casters?: THREE.Object3D,
    private readonly casterMaterial?: THREE.Material,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    parent.add(this.mesh);
    if (casters && casterMaterial) {
      this.caster = new THREE.Mesh(this.mesh.geometry, casterMaterial);
      this.caster.frustumCulled = false;
      this.caster.visible = false;
      casters.add(this.caster);
    }
  }

  /** Replace one chunk's cards. */
  set(key: string, cards: readonly Billboard[], pages: CardPages): void {
    this.delete(key);
    if (!cards.length) return;
    this.chunks.set(key, this.write(cards, pages));
    this.dirty = true;
  }

  delete(key: string): void {
    if (this.chunks.delete(key)) this.dirty = true;
  }

  private write(cards: readonly Billboard[], pages: CardPages): ChunkCards {
    const chunk: ChunkCards = { cards, arrays: new CardArrays(cards.length), drawn: 0, pages: [] };
    const recording: CardPages = {
      pageSize: pages.pageSize,
      page(image, x, y) {
        const known = chunk.pages.find((p) => p.image === image && p.x === x && p.y === y);
        if (known) return known.region;
        const region = pages.page(image, x, y);
        chunk.pages.push({ image, x, y, region });
        return region;
      },
    };
    for (const card of cards) if (chunk.arrays.push(card, recording)) chunk.drawn++;
    return chunk;
  }

  /** Once a frame: keep the cards' pages resident, and write every card again if
   * the atlas moved or forgot one (a restored context, changed assets). */
  keep(pages: CardPages): void {
    let moved = false;
    for (const chunk of this.chunks.values())
      for (const page of chunk.pages)
        if (pages.page(page.image, page.x, page.y) !== page.region) moved = true;
    if (!moved) return;
    for (const [key, chunk] of this.chunks) this.chunks.set(key, this.write(chunk.cards, pages));
    this.dirty = true;
  }

  /** Rebuild the merged mesh if any chunk changed; true when it did. */
  flush(): boolean {
    if (!this.dirty) return false;
    this.dirty = false;
    let quads = 0;
    this.count = 0;
    for (const chunk of this.chunks.values()) {
      quads += chunk.arrays.count;
      this.count += chunk.drawn;
    }
    const merged = new CardArrays(quads);
    for (const chunk of this.chunks.values()) merged.append(chunk.arrays);
    this.mesh.geometry.dispose();
    this.mesh.geometry = cardGeometry(merged, THREE.StaticDrawUsage);
    this.mesh.visible = quads > 0;
    if (this.caster) {
      this.caster.geometry = this.mesh.geometry;
      this.caster.visible = quads > 0;
    }
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    for (const mesh of [this.mesh, this.caster]) mesh?.removeFromParent();
    this.material.dispose();
    this.casterMaterial?.dispose();
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
  image: HTMLCanvasElement,
  elevation: number,
): Billboard {
  return {
    image,
    sx: 0,
    sy: 0,
    sw: image.width,
    sh: image.height,
    x: prop.position.wx + frame.left + frame.width / 2,
    y: prop.position.wy,
    z: elevation - (frame.top + frame.height),
    width: frame.width,
    height: frame.height,
  };
}
