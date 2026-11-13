import type * as THREE from "three";
import { MODERN_INTERIORS_SHEET_KEY } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Prop } from "../../entities/Prop.js";
import {
  averageColor,
  type FirstPersonImages,
  type PropImage,
  pixelTexture,
} from "./FirstPersonImages.js";
import {
  containingWallFace,
  type FirstPersonInterior,
  floorDecalQuad,
  furnitureFrame,
  paintedShell,
  rasterizeRoom,
  roomFloorQuad,
  roomShellFrame,
  shellSideColor,
  wallPieceQuad,
} from "./FirstPersonInterior.js";
import {
  appendPropGeometry,
  type PropImageFrame,
  type PropSolid,
  type TexturedTriangles,
} from "./FirstPersonProps.js";
import type { TriangleWriter } from "./FirstPersonTerrain.js";

/** Furniture placed by its anchor, with its composed artwork. */
export interface RoomFurniture {
  readonly frame: PropImageFrame;
  /** Rugs and other floor-layer pieces lie flat on the floor. */
  readonly floor: boolean;
  /** Pictures hang on the wall containing their anchor. */
  readonly wall: boolean;
  image(opaque: boolean): PropImage | undefined;
}

/** A shell's drawing split and side colours, cached until its walls change. */
interface ShellMeasure {
  readonly walls: Prop["walls"];
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly frame: PropImageFrame;
  readonly painted: Prop;
  readonly plain: Prop;
  sideColor(solid: PropSolid): number;
}

/**
 * The current room in the first-person view (tactical 230 slice 2): its rasters,
 * the floor plane's faces, and how the wall shell and furniture are drawn. The
 * view owns the meshes and materials built on these textures.
 */
export class FirstPersonRoomScene {
  readonly floor: THREE.Texture;
  readonly walls: THREE.Texture;
  private readonly wallPixels: ImageData | undefined;
  private readonly wallColor: number;
  private shell: Prop | undefined;
  private measured: ShellMeasure | undefined;

  /** `key` includes whether the atlas was loaded, so late artwork rebuilds the room. */
  constructor(
    readonly interior: FirstPersonInterior,
    readonly key: string,
    atlas: CanvasImageSource | undefined,
  ) {
    const rasters = rasterizeRoom(interior.map, atlas);
    this.floor = pixelTexture(rasters.floor);
    this.walls = pixelTexture(rasters.walls);
    this.wallPixels = rasters.wallPixels;
    this.wallColor = rasters.wallPixels ? averageColor(rasters.wallPixels.data) : 0x8a8a8a;
  }

  floorFaces(): TexturedTriangles {
    const quad = roomFloorQuad(this.interior.map);
    // Room art is unshaded: white vertex colours.
    return { ...quad, colors: quad.positions.map(() => 1) };
  }

  isShell(prop: Prop): boolean {
    return prop.type === this.interior.shellType;
  }

  /** The replicated shell among the room's props, for hanging wall-layer pieces. */
  adoptShell(props: readonly Prop[] | null): void {
    this.shell = props?.find((p) => this.isShell(p));
  }

  /**
   * Room walls wear the whole room picture, as tall as the fixed view paints them
   * (collision walls are 64 px). Backs repeat the art and sides take its colours;
   * walls with no art of their own (the outer boundary) are plain. Measurements
   * are cached per shell, since its chunk rebuilds whenever nearby furniture moves.
   */
  appendShell(
    shell: Prop,
    elevation: number,
    flat: TriangleWriter,
    facesFor: (image: PropImage) => TexturedTriangles | undefined,
  ): void {
    const { frame, painted, plain, sideColor } = this.measure(shell, elevation);
    const image = { texture: this.walls, color: this.wallColor, frame };
    appendPropGeometry(
      { flat, textured: facesFor(image) },
      painted,
      this.wallColor,
      elevation,
      frame,
      { sideColor },
    );
    appendPropGeometry({ flat, textured: undefined }, plain, this.wallColor, elevation, frame);
  }

  private measure(shell: Prop, elevation: number): ShellMeasure {
    const cached = this.measured;
    if (
      cached?.walls === shell.walls &&
      cached.x === shell.position.wx &&
      cached.y === shell.position.wy &&
      cached.elevation === elevation
    )
      return cached;
    const frame = roomShellFrame(shell, this.interior.map);
    const pixels = this.wallPixels;
    const { painted, plain } = paintedShell(shell, frame, elevation, pixels);
    const sides = new Map<string, number>();
    const measure: ShellMeasure = {
      walls: shell.walls,
      x: shell.position.wx,
      y: shell.position.wy,
      elevation,
      frame,
      painted,
      plain,
      sideColor: (solid) => {
        const key = `${solid.bounds.left},${solid.bounds.top},${solid.bounds.right},${solid.bounds.bottom}`;
        let color = sides.get(key);
        if (color === undefined) {
          color =
            (pixels && shellSideColor(pixels, painted, frame, elevation, solid)) ?? this.wallColor;
          sides.set(key, color);
        }
        return color;
      },
    };
    this.measured = measure;
    return measure;
  }

  furniture(type: string, images: FirstPersonImages): RoomFurniture | undefined {
    const art = this.interior.furniture(type);
    if (!art) return undefined;
    const frame = furnitureFrame(art);
    return {
      frame,
      floor: art.floor,
      wall: art.wall,
      image: (opaque) => images.region(MODERN_INTERIORS_SHEET_KEY, art.rect, frame, opaque),
    };
  }

  /**
   * Furniture drawn flat: rugs a hair above the floor (so they win the depth test),
   * and pictures on the south face of the painted wall containing their anchor.
   * False for other furniture, and for pictures not inside a painted wall.
   */
  appendFlat(
    prop: Prop,
    furniture: RoomFurniture,
    elevation: number,
    facesFor: (image: PropImage | undefined) => TexturedTriangles | undefined,
  ): boolean {
    let quad: Pick<TexturedTriangles, "positions" | "uvs"> | undefined;
    if (furniture.floor) quad = floorDecalQuad(prop, furniture.frame, elevation + 0.25);
    else if (furniture.wall && this.shell) {
      const painted = this.measure(this.shell, elevation).painted;
      const face = containingWallFace(painted, prop.position.wx, prop.position.wy);
      if (face !== undefined) quad = wallPieceQuad(prop, furniture.frame, face, elevation);
    }
    if (!quad) return false;
    const faces = facesFor(furniture.image(false));
    faces?.positions.push(...quad.positions);
    faces?.uvs.push(...quad.uvs);
    faces?.colors.push(...quad.positions.map(() => 1));
    return true;
  }

  dispose(): void {
    this.floor.dispose();
    this.walls.dispose();
  }
}
