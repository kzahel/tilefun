import * as THREE from "three";
import type { BuildingExterior, BuildingTrim } from "../../buildings/BuildingExteriors.js";
import { type Point3, sectionCorners } from "../../buildings/BuildingSection.js";
import type { Prop } from "../../entities/Prop.js";
import type { FacePart } from "./FirstPersonFaces.js";
import type { FirstPersonImages, PropImage } from "./FirstPersonImages.js";
import { appendLeftover, type TexturedTriangles } from "./FirstPersonProps.js";
import { srgbToLinear } from "./FirstPersonTerrain.js";

import { signEdges } from "./SignEdges.js";

type Batch = Map<THREE.Texture, TexturedTriangles>;
export interface BuildingFaces {
  sprite: Batch;
  model: Batch;
}

function faces(batch: Batch, image: PropImage) {
  let out = batch.get(image.texture);
  if (!out) {
    out = { positions: [], uvs: [], colors: [] };
    batch.set(image.texture, out);
  }
  return out;
}

function quad(
  out: TexturedTriangles,
  prop: Prop,
  elevation: number,
  points: [Point3, Point3, Point3, Point3],
  uv: (p: Point3) => [number, number],
  shade: number,
) {
  const grey = srgbToLinear(shade);
  for (const i of [0, 1, 2, 0, 2, 3] as const) {
    const p = points[i];
    out.positions.push(prop.position.wx + p[0], prop.position.wy + p[1], elevation + p[2]);
    out.uvs.push(...uv(p));
    out.colors.push(grey, grey, grey);
  }
}

function appendTrim(
  batch: Batch,
  images: FirstPersonImages,
  prop: Prop,
  elevation: number,
  trim: BuildingTrim,
) {
  const { piece, plane } = trim;
  const frame = {
    left: piece.dx - piece.spriteWidth / 2,
    top: piece.dy - piece.spriteHeight,
    width: piece.spriteWidth,
    height: piece.spriteHeight,
  };
  const sheet = images.sheet(prop.sprite.sheetKey);
  if (!sheet) return;
  const { x, y } = sheet.getRegion(piece.frameCol, piece.frameRow);
  const image = images.region(
    prop.sprite.sheetKey,
    [x, y, frame.width, frame.height],
    frame,
    false,
  );
  if (!image) return;
  const left = frame.left,
    right = left + frame.width;
  // A hotel mat projects past the front wall. The empty part within the wall
  // stays hidden, and the south half lies on the pavement.
  const at = (x: number, row: number): Point3 =>
    plane === "ground" ? [x, row, 0.25] : [x, plane, plane - row];
  const bottom = piece.dy,
    top = frame.top;
  quad(
    faces(batch, image),
    prop,
    elevation,
    [at(left, top), at(right, top), at(right, bottom), at(left, bottom)],
    ([x, y, z]) => [
      (x - left) / frame.width,
      ((plane === "ground" ? y : plane - z) - top) / frame.height,
    ],
    1,
  );
  if (plane === "ground") return;
  const out = faces(batch, image);
  const thickness = 3;
  const point = (u: number, v: number, back: boolean): Point3 => [
    left + u,
    plane - (back ? thickness : 0),
    plane - top - v,
  ];
  const uv = ([x, , z]: Point3): [number, number] => [
    (x - left) / frame.width,
    (plane - top - z) / frame.height,
  ];
  quad(
    out,
    prop,
    elevation,
    [
      point(0, 0, true),
      point(frame.width, 0, true),
      point(frame.width, frame.height, true),
      point(0, frame.height, true),
    ],
    uv,
    0.8,
  );
  for (const e of signEdges(image.image)) {
    const x = e.x + e.dx,
      y = e.y + e.dy;
    quad(
      out,
      prop,
      elevation,
      [point(e.x, e.y, false), point(x, y, false), point(x, y, true), point(e.x, e.y, true)],
      (p) => {
        const [u, v] = uv(p);
        return [e.dy ? e.u / frame.width : u, e.dx ? e.v / frame.height : v];
      },
      0.76,
    );
  }
}

/** The original sprite, with depth for a passing actor. Above the eaves its
 * rows recede over the footprint, so a character on the roof stays visible.
 * Each row still projects to exactly its original y - z in the top-down camera. */
function buildingSprite(
  out: TexturedTriangles,
  prop: Prop,
  elevation: number,
  image: PropImage,
  building: BuildingExterior,
) {
  const { left, top, width, height } = image.frame;
  if (building.facadeOnly) return appendLeftover(out, prop, image.frame, elevation);
  const back = Math.min(...building.sections.map((s) => s.back));
  const front = Math.max(...building.sections.map((s) => Math.max(s.front, s.frontRight)));
  const eave = Math.min(
    ...building.sections.filter((s) => s.back <= back + 4).map((s) => Math.min(s.top, s.topRight)),
  );
  const rows = [
    top,
    ...[back - eave, front - eave, front].filter((row) => row > top && row < top + height),
    top + height,
  ];
  const point = (x: number, row: number, lift: number): Point3 => {
    const y = row > front ? row : Math.min(front, Math.max(back, row + eave));
    return [x, y + lift, y - row + lift];
  };
  let previous = top;
  for (const row of rows.slice(1)) {
    const lift = previous >= front ? 0.25 : 0;
    quad(
      out,
      prop,
      elevation,
      [
        point(left, previous, lift),
        point(left + width, previous, lift),
        point(left + width, row, lift),
        point(left, row, lift),
      ],
      ([x, y, z]) => [(x - left) / width, (y - z - top) / height],
      1,
    );
    previous = row;
  }
}

export function appendBuilding(
  out: BuildingFaces,
  images: FirstPersonImages,
  prop: Prop,
  exterior: BuildingExterior,
  elevation: number,
): void {
  const picture = images.prop(prop, false);
  if (!picture) return;
  buildingSprite(faces(out.sprite, picture), prop, elevation, picture, exterior);
  const body = exterior.bodyParts
    ? { ...prop, sprite: { ...prop.sprite, parts: exterior.bodyParts } }
    : prop;
  const paint = images.prop(body, true);
  if (!paint) return;
  const frame = paint.frame;
  const projected = ([x, y, z]: Point3): [number, number] => [
    (x - frame.left) / frame.width,
    (y - z - frame.top) / frame.height,
  ];
  const [sx, sy, w, h] = exterior.siding;
  const siding = images.region(
    prop.sprite.sheetKey,
    [sx, sy, w, h],
    { left: 0, top: 0, width: w, height: h },
    true,
  );
  if (!siding) return;
  siding.texture.wrapS = THREE.RepeatWrapping;
  siding.texture.wrapT = exterior.windowBand ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  const span = exterior.windowBand?.span ?? w;
  const wallV = (z: number) =>
    exterior.windowBand ? (exterior.windowBand.top - z) / exterior.windowBand.height : (48 - z) / h;
  const porch = exterior.porchWall;
  const wall = faces(out.model, siding),
    face = faces(out.model, paint);
  for (const s of exterior.sections) {
    const c = sectionCorners(s);
    type Corner = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const ring = (a: Corner, b: Corner, d: Corner, e: Corner): [Point3, Point3, Point3, Point3] => [
      c[a],
      c[b],
      c[d],
      c[e],
    ];
    quad(face, prop, elevation, ring(4, 5, 6, 7), projected, 1);
    const [a, b, c1, d] = ring(3, 2, 6, 7);
    if (porch && s.front === porch.front && s.base === 0) {
      const seamLeft: Point3 = [a[0], a[1], porch.height],
        seamRight: Point3 = [b[0], b[1], porch.height];
      const [u, v, width, height] = porch.crop;
      quad(
        face,
        prop,
        elevation,
        [a, b, seamRight, seamLeft],
        ([x, , z]) => [
          (u + (width * (x - porch.left)) / (porch.right - porch.left)) / frame.width,
          (v + height * (1 - z / porch.height)) / frame.height,
        ],
        1,
      );
      quad(face, prop, elevation, [seamLeft, seamRight, c1, d], projected, 1);
    } else quad(face, prop, elevation, [a, b, c1, d], projected, 1);
    const sideUV = ([, y, z]: Point3): [number, number] => [(y - s.back) / span, wallV(z)];
    quad(wall, prop, elevation, ring(0, 3, 7, 4), sideUV, 0.8);
    quad(wall, prop, elevation, ring(2, 1, 5, 6), sideUV, 0.92);
    quad(
      wall,
      prop,
      elevation,
      ring(1, 0, 4, 5),
      ([x, , z]) => [(x - s.left) / span, wallV(z)],
      0.86,
    );
    if (s.base || s.baseRight)
      quad(wall, prop, elevation, ring(0, 1, 2, 3), ([x, y]) => [x / w, y / h], 0.65);
  }
  for (const trim of exterior.trim ?? []) appendTrim(out.model, images, prop, elevation, trim);
}

/** Both forms stay chunk-batched. Switching cameras only swaps group visibility. */
export class BuildingViews {
  readonly sprite = new THREE.Group();
  readonly model = new THREE.Group();

  show(topDown: boolean) {
    const changed = this.model.visible === topDown || this.sprite.visible !== topDown;
    this.sprite.visible = topDown;
    this.model.visible = !topDown;
    return changed;
  }

  parts(
    buildings: BuildingFaces,
    material: (texture: THREE.Texture) => THREE.Material,
  ): FacePart[] {
    const parts: FacePart[] = [];
    for (const form of ["sprite", "model"] as const)
      for (const [texture, faces] of buildings[form])
        parts.push({
          bucket: `building:${form}:${texture.uuid}`,
          parent: this[form],
          material: material(texture),
          ...faces,
        });
    return parts;
  }
}
