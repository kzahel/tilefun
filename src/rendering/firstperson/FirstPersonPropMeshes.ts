import * as THREE from "three";
import { ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import type { Prop } from "../../entities/Prop.js";
import { artCard, type Billboard, sheetUv } from "./FirstPersonBillboards.js";
import type { FirstPersonImages, PropImage } from "./FirstPersonImages.js";
import {
  appendPropGeometry,
  type PropGeometry,
  type PropSurface,
  propForm,
  propImageFrame,
  propSlices,
  propSurfaces,
} from "./FirstPersonProps.js";
import type { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { type ColoredTriangles, TriangleWriter } from "./FirstPersonTerrain.js";

type TexturedFaces = NonNullable<PropGeometry["textured"]>;
type FacesFor = (image: PropImage | undefined) => TexturedFaces | undefined;

/** One chunk's props as drawn: solid meshes, standing cards and walkable surfaces. */
export interface ChunkProps {
  group: THREE.Group;
  billboards: Billboard[];
  surfaces: PropSurface[];
}

export function coloredMesh(triangles: ColoredTriangles, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(triangles.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(triangles.colors, 3));
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
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
  private readonly faceMaterials = new Map<THREE.Texture, THREE.MeshBasicMaterial>();

  constructor(
    private readonly images: FirstPersonImages,
    private readonly flatMaterial: THREE.Material,
    private readonly shade: (material: THREE.MeshBasicMaterial) => THREE.MeshBasicMaterial,
  ) {}

  faceMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    let material = this.faceMaterials.get(texture);
    if (!material) {
      // Opaque compositions have no holes; floor decals (rugs) cut out their padding.
      // Vertex colours carry each face's baked shade.
      material = this.shade(
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          alphaTest: 0.5,
          vertexColors: true,
        }),
      );
      this.faceMaterials.set(texture, material);
    }
    return material;
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
    const built: ChunkProps = { group: new THREE.Group(), billboards: [], surfaces: [] };
    const flat = new TriangleWriter();
    const textured = new Map<THREE.Texture, TexturedFaces>();
    const facesFor: FacesFor = (image) => {
      if (!image) return undefined;
      const faces = textured.get(image.texture) ?? { positions: [], uvs: [], colors: [] };
      textured.set(image.texture, faces);
      return faces;
    };
    for (const prop of props) {
      const elevation = propElevation(prop, heightAt);
      if (room) this.appendRoomProp(built, prop, elevation, room, flat, facesFor);
      else this.appendProp(built, prop, elevation, flat, facesFor);
    }
    if (flat.vertexCount) built.group.add(coloredMesh(flat.finish(), this.flatMaterial));
    for (const [texture, faces] of textured)
      if (faces.positions.length) built.group.add(texturedMesh(faces, this.faceMaterial(texture)));
    return built;
  }

  private appendProp(
    built: ChunkProps,
    prop: Prop,
    elevation: number,
    flat: TriangleWriter,
    facesFor: FacesFor,
  ): void {
    const frame = propImageFrame(prop);
    const form = propForm(prop, frame);
    if (form === "cards") built.billboards.push(...this.propCards(prop, elevation));
    else if (form === "billboard") {
      const billboard = this.propBillboard(prop, elevation);
      if (billboard) built.billboards.push(billboard);
    } else {
      const image = this.images.prop(prop, true);
      const textured = facesFor(image);
      appendPropGeometry({ flat, textured }, prop, image?.color ?? 0x8a8a8a, elevation, frame);
      built.surfaces.push(...propSurfaces(prop));
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
    if (room.appendFlat(prop, furniture, elevation, facesFor)) return;
    if (propForm(prop, furniture.frame) === "solid") {
      const image = furniture.image(true);
      const textured = facesFor(image);
      const color = image?.color ?? 0x8a8a8a;
      appendPropGeometry({ flat, textured }, prop, color, elevation, furniture.frame);
      built.surfaces.push(...propSurfaces(prop));
      return;
    }
    const card = furniture.image(false);
    if (card) built.billboards.push(artCard(prop, furniture.frame, card.texture, elevation));
  }

  /** A forest row's slices as cards on its sheet's texture. */
  private propCards(prop: Prop, elevation: number): Billboard[] {
    const sheet = this.images.sheet(prop.sprite.sheetKey);
    if (!sheet) return [];
    const { width, height } = sheet.sheet.image;
    return propSlices(prop, (col, row) => sheet.sheet.getRegion(col, row)).map((slice) => ({
      texture: sheet.texture,
      uv: [
        slice.sheetX / width,
        slice.sheetY / height,
        (slice.sheetX + slice.width) / width,
        (slice.sheetY + slice.height) / height,
      ],
      x: slice.x,
      y: slice.y,
      z: elevation,
      width: slice.width,
      height: slice.height,
    }));
  }

  private propBillboard(prop: Prop, elevation: number): Billboard | undefined {
    if (!prop.sprite.parts?.length) {
      const sheet = this.images.sheet(prop.sprite.sheetKey);
      if (!sheet) return undefined;
      return {
        texture: sheet.texture,
        uv: sheetUv(sheet.sheet, prop.sprite, prop.sprite.frameRow, false),
        x: prop.position.wx,
        y: prop.position.wy,
        z: elevation,
        width: prop.sprite.spriteWidth,
        height: prop.sprite.spriteHeight,
      };
    }
    const image = this.images.prop(prop, false);
    return image && artCard(prop, image.frame, image.texture, elevation);
  }

  dispose(): void {
    for (const material of this.faceMaterials.values()) material.dispose();
    this.faceMaterials.clear();
  }
}
