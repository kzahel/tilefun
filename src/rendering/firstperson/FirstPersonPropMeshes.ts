import * as THREE from "three";
import { buildingExterior } from "../../buildings/BuildingExteriors.js";
import { ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import type { AABB } from "../../entities/collision.js";
import type { Prop } from "../../entities/Prop.js";
import { forestRowDefinition } from "../../patterns/ForestThicket.js";
import type { SurfacePatch } from "../../physics/SurfacePatch.js";
import { SURFACE_GRID, surfaceColors } from "../SurfacePresentation.js";
import { appendBuilding, type BuildingFaces, BuildingViews } from "./BuildingMeshes.js";
import { artCard, type Billboard, sheetFrame } from "./FirstPersonBillboards.js";
import type { DeckMaterials } from "./FirstPersonDecks.js";
import type { FacePart } from "./FirstPersonFaces.js";
import { forestRowCards, forestTreeCards } from "./FirstPersonForest.js";
import { BACKING_ALPHA, type FirstPersonImages, type PropImage } from "./FirstPersonImages.js";
import {
  appendLeftover,
  appendPiecePlane,
  appendPropGeometry,
  excavationCeilings,
  hasRoomViews,
  isOverheadDeck,
  type PropGeometry,
  type PropSurface,
  type PropView,
  propForm,
  propImageFrame,
  propPieces,
  propSurfaces,
  solidSilhouettes,
} from "./FirstPersonProps.js";
import type { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { type ColoredTriangles, TriangleWriter } from "./FirstPersonTerrain.js";

export type TexturedFaces = NonNullable<PropGeometry["textured"]>;
type FacesFor = (image: Pick<PropImage, "texture"> | undefined) => TexturedFaces | undefined;

/** One chunk's props as drawn: the faces of solid volumes (flat-coloured, and
 * wearing artwork by its texture), standing cards and walkable surfaces. The
 * view merges the faces with other chunks' (`MergedFaces`, 251). */
export interface ChunkProps {
  buildings: BuildingFaces;
  flat: ColoredTriangles | undefined;
  /** Surface grid lines (`PropGeometry.lines`), in pairs of points. */
  lines: { positions: number[]; colors: number[] };
  textured: Map<THREE.Texture, TexturedFaces>;
  billboards: Billboard[];
  forestRows: Billboard[];
  forestTrees: Billboard[];
  surfaces: PropSurface[];
  /** Decks a body can stand under, each apart so it can fade (`isOverheadDeck`). */
  decks: OverheadDeck[];
  /** Props with an inside picture (tree houses), each view apart so the view can
   * swap them as the fixed view does (`observerInsideRoom`). */
  rooms: RoomProp[];
}

/** One view's faces of a room prop. */
export interface RoomPropFaces {
  flat: ColoredTriangles | undefined;
  textured: Map<THREE.Texture, TexturedFaces>;
}

/** A room prop's forms: its volumes wearing the outside picture (first person),
 * and for the top-down camera each picture's pieces on their planes
 * (`appendPiecePlane`). */
export interface RoomProp {
  readonly prop: Prop;
  readonly solid: RoomPropFaces;
  readonly outside: RoomPropFaces;
  readonly inside: RoomPropFaces;
}

/** One overhead deck's faces, with the surface the fixed view's cutaway reads. */
export interface OverheadDeck {
  readonly id: string;
  readonly patch: SurfacePatch;
  readonly bounds: AABB;
  readonly flat: ColoredTriangles;
  readonly lines: ChunkProps["lines"];
}

export function texturedMesh(faces: TexturedFaces, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(faces.positions), 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(faces.uvs), 2));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(faces.colors), 3));
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry.dispose();
  });
  group.removeFromParent();
}

/** Set per frame: faces drop their compositions' backing (`BACKING_ALPHA`), as
 * the top-down camera does, so what lies behind shows where the fixed view's
 * artwork is empty. First person keeps the backing, so no box shows its inside.
 * Top-down, a hole would show the inside of the box's north wall, which wears
 * the south face's picture again (a fountain's basin behind its statue), so
 * the walls the fixed view never shows (`unseen`) are dropped with the backing. */
export const ART_HOLES = { value: false };

function artHoles(material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
  const shade = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:art-holes`;
  material.onBeforeCompile = (shader, renderer) => {
    shade(shader, renderer);
    shader.uniforms.artHoles = ART_HOLES;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float unseen;\nvarying float vUnseen;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vUnseen = unseen;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform bool artHoles;\nvarying float vUnseen;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
  if (artHoles && (vUnseen > 0.5 || diffuseColor.a < ${((BACKING_ALPHA + 0.5) / 255).toFixed(4)})) discard;`,
      );
  };
  material.needsUpdate = true;
  return material;
}

function propElevation(prop: Prop, heightAt: (tx: number, ty: number) => number): number {
  return (
    heightAt(Math.floor(prop.position.wx / TILE_SIZE), Math.floor(prop.position.wy / TILE_SIZE)) *
    ELEVATION_PX
  );
}

/**
 * Builds a chunk's props for the first-person view: collision volumes wearing
 * their artwork, with one material per artwork texture, and the standing cards
 * for the view's merged card meshes. `shade` adds the view's shading to a new
 * face material.
 */
export class PropMeshes {
  readonly buildings = new BuildingViews();
  private readonly faceMaterials = new Map<THREE.Texture, THREE.MeshBasicMaterial>();

  constructor(
    private readonly images: FirstPersonImages,
    private readonly shade: (material: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial,
  ) {}

  faceMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    let material = this.faceMaterials.get(texture);
    if (!material) {
      // Opaque compositions have no holes; floor decals (rugs) cut out their padding.
      // Vertex colours carry each face's baked shade.
      material = artHoles(
        this.shade(
          new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            alphaTest: 0.5,
            vertexColors: true,
          }),
        ),
      );
      this.faceMaterials.set(texture, material);
    }
    return material;
  }

  /** Static prop faces join the area's batches. Each deck keeps its own draw
   * and material so it can fade on its own. */
  faceParts(
    built: ChunkProps,
    area: string,
    parent: THREE.Group,
    flatMaterial: THREE.Material,
    gridMaterial: THREE.Material,
    decks: DeckMaterials,
  ): FacePart[] {
    const parts = this.buildings.parts(built.buildings, (texture) => this.faceMaterial(texture));
    if (built.flat)
      parts.push({ bucket: `flat:${area}`, material: flatMaterial, parent, ...built.flat });
    parts.push({
      bucket: `grid:${area}`,
      material: gridMaterial,
      parent,
      ...built.lines,
      lines: true,
    });
    for (const [texture, faces] of built.textured)
      parts.push({ bucket: texture, material: this.faceMaterial(texture), parent, ...faces });
    for (const deck of built.decks) {
      const material = decks.get(deck.id);
      parts.push(
        { bucket: `deck:${deck.id}`, material: material.face, parent, ...deck.flat },
        {
          bucket: `deck-grid:${deck.id}`,
          material: material.grid,
          parent,
          ...deck.lines,
          lines: true,
        },
      );
    }
    return parts;
  }

  /** The texture is gone (evicted artwork, a released room): drop its material. */
  dropMaterial(texture: THREE.Texture): void {
    this.faceMaterials.get(texture)?.dispose();
    this.faceMaterials.delete(texture);
  }

  /** `room` is set indoors: its shell and furniture replace the outdoor forms. */
  build(
    props: readonly Prop[],
    heightAt: (tx: number, ty: number) => number,
    room: FirstPersonRoomScene | undefined,
  ): ChunkProps {
    const flat = new TriangleWriter();
    const textured = new Map<THREE.Texture, TexturedFaces>();
    const built: ChunkProps = {
      buildings: { sprite: new Map(), model: new Map() },
      flat: undefined,
      lines: { positions: [], colors: [] },
      textured,
      billboards: [],
      forestRows: [],
      forestTrees: [],
      surfaces: [],
      decks: [],
      rooms: [],
    };
    const facesFor: FacesFor = (image) => {
      if (!image) return undefined;
      const faces = textured.get(image.texture) ?? { positions: [], uvs: [], colors: [] };
      textured.set(image.texture, faces);
      return faces;
    };
    // A roof and the floor it covers share their bounds, so also their chunk.
    const ceilings = excavationCeilings(props);
    for (const prop of props) {
      const elevation = propElevation(prop, heightAt);
      const building = buildingExterior(prop.type);
      if (building) appendBuilding(built.buildings, this.images, prop, building, elevation);
      else if (room) this.appendRoomProp(built, prop, elevation, room, flat, facesFor);
      else this.appendProp(built, prop, elevation, flat, facesFor, ceilings);
    }
    if (flat.vertexCount) built.flat = flat.finish();
    return built;
  }

  private appendProp(
    built: ChunkProps,
    prop: Prop,
    elevation: number,
    flat: TriangleWriter,
    facesFor: FacesFor,
    ceilings?: ReadonlySet<string>,
  ): void {
    const forest = forestRowDefinition(prop.type);
    if (forest) {
      const sheet = this.images.sheet(prop.sprite.sheetKey);
      if (sheet) {
        built.forestRows.push(...forestRowCards(prop, elevation, sheet));
        built.forestTrees.push(...forestTreeCards(prop, forest.kit.id, elevation, sheet));
      }
      return;
    }
    const frame = propImageFrame(prop);
    const form = propForm(prop, frame);
    if (form === "billboard") {
      const billboard = this.propBillboard(prop, elevation);
      if (billboard) built.billboards.push(billboard);
    } else if (hasRoomViews(prop)) {
      built.surfaces.push(...propSurfaces(prop));
      built.rooms.push({
        prop,
        solid: this.roomView((flat, facesFor) =>
          this.appendSolid(prop, elevation, flat, facesFor, built, "outside"),
        ),
        outside: this.roomView((_flat, facesFor) =>
          this.appendPlanes(prop, elevation, facesFor, "outside"),
        ),
        inside: this.roomView((_flat, facesFor) =>
          this.appendPlanes(prop, elevation, facesFor, "inside"),
        ),
      });
    } else {
      const surfaces = propSurfaces(prop);
      const overhead = isOverheadDeck(prop, ceilings) ? new TriangleWriter() : undefined;
      const lines = { positions: [] as number[], colors: [] as number[] };
      this.appendSolid(
        prop,
        elevation,
        overhead ?? flat,
        facesFor,
        overhead ? { ...built, lines } : built,
        "outside",
      );
      built.surfaces.push(...surfaces);
      const [surface] = surfaces;
      if (overhead?.vertexCount && surface) {
        // Bake the grid ink into the surface colour; its depth-writing lines
        // can then fade once with the slab instead of blending over it twice.
        const color = new THREE.Color(
          surfaceColors(prop.type, surface.patch).top,
        ).convertLinearToSRGB();
        color
          .lerp(new THREE.Color(SURFACE_GRID.color).convertLinearToSRGB(), SURFACE_GRID.opacity)
          .convertSRGBToLinear();
        for (let i = 0; i < lines.colors.length; i += 3) {
          lines.colors[i] = color.r;
          lines.colors[i + 1] = color.g;
          lines.colors[i + 2] = color.b;
        }
        built.decks.push({
          id: surface.patch.id,
          patch: surface.patch,
          bounds: surface.bounds,
          flat: overhead.finish(),
          lines,
        });
      }
    }
  }

  /** A solid prop's volumes wearing one view's picture, and the artwork they do
   * not wear (signs, a carpet: see `appendLeftover`). */
  private appendSolid(
    prop: Prop,
    elevation: number,
    flat: TriangleWriter,
    facesFor: FacesFor,
    built: ChunkProps,
    view: PropView,
  ): void {
    const frame = propImageFrame(prop, view);
    const image = this.images.prop(prop, true, view);
    appendPropGeometry(
      { flat, textured: facesFor(image), lines: built.lines },
      prop,
      image?.color ?? 0x8a8a8a,
      elevation,
      frame,
    );
    const holes = solidSilhouettes(prop, frame, elevation);
    const leftover = holes && this.images.leftover(prop, holes, view);
    const leftoverFaces = leftover ? facesFor(leftover) : undefined;
    if (leftoverFaces) appendLeftover(leftoverFaces, prop, frame, elevation);
  }

  /** One form of a room prop, apart from the chunk's merged faces. */
  private roomView(append: (flat: TriangleWriter, facesFor: FacesFor) => void): RoomPropFaces {
    const flat = new TriangleWriter();
    const textured = new Map<THREE.Texture, TexturedFaces>();
    const facesFor: FacesFor = (image) => {
      if (!image) return undefined;
      const faces = textured.get(image.texture) ?? { positions: [], uvs: [], colors: [] };
      textured.set(image.texture, faces);
      return faces;
    };
    append(flat, facesFor);
    return { flat: flat.vertexCount ? flat.finish() : undefined, textured };
  }

  /** One picture's pieces, each its own image on its plane. */
  private appendPlanes(prop: Prop, elevation: number, facesFor: FacesFor, view: PropView): void {
    const sheet = this.images.sheet(prop.sprite.sheetKey);
    if (!sheet) return;
    for (const piece of propPieces(prop, view)) {
      const region = sheet.getRegion(piece.frameCol, piece.frameRow);
      const image = this.images.region(
        prop.sprite.sheetKey,
        [region.x, region.y, piece.spriteWidth, piece.spriteHeight],
        {
          left: piece.dx - piece.spriteWidth / 2,
          top: piece.dy - piece.spriteHeight,
          width: piece.spriteWidth,
          height: piece.spriteHeight,
        },
        false,
      );
      const faces = facesFor(image);
      if (faces) appendPiecePlane(faces, prop, piece, elevation);
    }
  }

  private appendRoomProp(
    built: ChunkProps,
    prop: Prop,
    elevation: number,
    room: FirstPersonRoomScene,
    flat: TriangleWriter,
    facesFor: FacesFor,
  ): void {
    if (room.isShell(prop)) {
      room.appendShell(prop, elevation, flat, facesFor);
      return;
    }
    // Room furniture is placed by its anchor; rugs lie on the floor.
    const furniture = room.furniture(prop.type, this.images);
    if (!furniture) {
      this.appendProp(built, prop, elevation, flat, facesFor);
      return;
    }
    prop = room.placement(prop, furniture);
    if (room.appendFlat(prop, furniture, elevation, facesFor)) return;
    // Top-down draws the fixed view's picture: furniture stands as its artwork at
    // its anchor row, where the fixed view sorts it, with the rows below that
    // lying on the floor (`appendLeftover`), not as a volume.
    if (room.topDown) {
      const faces = facesFor(furniture.image(false));
      if (faces) appendLeftover(faces, prop, furniture.frame, elevation);
      built.surfaces.push(...propSurfaces(prop));
      return;
    }
    if (propForm(prop, furniture.frame) === "solid") {
      const image = furniture.image(true);
      const textured = facesFor(image);
      const color = image?.color ?? 0x8a8a8a;
      appendPropGeometry(
        { flat, textured, lines: built.lines },
        prop,
        color,
        elevation,
        furniture.frame,
      );
      built.surfaces.push(...propSurfaces(prop));
      return;
    }
    const card = furniture.image(false);
    if (card) built.billboards.push(artCard(prop, furniture.frame, card.image, elevation));
  }

  private propBillboard(prop: Prop, elevation: number): Billboard | undefined {
    if (!prop.sprite.parts?.length) {
      const sheet = this.images.sheet(prop.sprite.sheetKey);
      if (!sheet) return undefined;
      return {
        ...sheetFrame(sheet, prop.sprite, prop.sprite.frameRow),
        x: prop.position.wx,
        y: prop.position.wy,
        z: elevation,
        width: prop.sprite.spriteWidth,
        height: prop.sprite.spriteHeight,
      };
    }
    const image = this.images.prop(prop, false);
    return image && artCard(prop, image.frame, image.image, elevation);
  }

  dispose(): void {
    for (const material of this.faceMaterials.values()) material.dispose();
    this.faceMaterials.clear();
  }
}
