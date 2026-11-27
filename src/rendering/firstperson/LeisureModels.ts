import type * as THREE from "three";
import type { Prop } from "../../entities/Prop.js";
import { required } from "../../shared/required.js";
import type { BuildingFaces } from "./BuildingMeshes.js";
import type { FirstPersonImages } from "./FirstPersonImages.js";
import { appendLeftover } from "./FirstPersonProps.js";

import { faces, Model, type Vertex } from "./SceneryMesh.js";

type UV = readonly [number, number];
function tent(m: Model) {
  const blue = m.prop.type.endsWith("blue"),
    light = blue ? 0x6592bc : 0x80a16e,
    dark = blue ? 0x45658c : 0x526c4b;
  const front = 0,
    back = -32,
    peak = 38;
  for (const [x, color] of [
    [-28, light],
    [28, dark],
  ] as const) {
    m.face(
      [
        [x, back, 0],
        [x, front, 0],
        [0, front, peak],
        [0, back, peak],
      ],
      color,
    );
    m.box(x, -16, 0, 2, 33, 2, 0x6b4e40);
  }
  for (const y of [front, back]) {
    m.face(
      [
        [-28, y, 0],
        [28, y, 0],
        [0, y, peak],
      ],
      dark,
    );
    m.face(
      [
        [-11, y + 0.2, 0],
        [11, y + 0.2, 0],
        [0, y + 0.2, 24],
      ],
      0x3f3540,
    );
  }
  // Keep the stitched door flaps from the front of the original tent.
  m.face(
    [
      [-28, 0.35, 0],
      [28, 0.35, 0],
      [0, 0.35, peak],
    ],
    0xffffff,
    [
      [0.06, 0.985],
      [0.94, 0.985],
      [0.5, 0.49],
    ],
  );
  m.box(0, -16, peak - 1, 2, 34, 2, 0x765b4b);
}

function umbrella(m: Model) {
  m.box(0, -3, 0, 2.5, 2.5, 32, 0x676372);
  for (let i = 0; i < 12; i++) {
    const edge = (j: number): Vertex => {
      const a = (j * Math.PI) / 6;
      return [23 * Math.cos(a), -3 + 20 * Math.sin(a), 27 + (j % 2)];
    };
    const a = edge(i),
      b = edge(i + 1);
    const color = i % 4 < 2 ? 0x75bce7 : 0xf3eee3;
    m.face([[0, -3, 37], a, b], color);
    m.face([a, b, [b[0], b[1], b[2] - 2], [a[0], a[1], a[2] - 2]], color);
  }
}
function table(m: Model) {
  for (const x of [-15, 15]) for (const y of [-17, -5]) m.box(x, y, 0, 3, 3, 14, 0x685048);
  for (const y of [-22, -2]) {
    m.box(0, y, 7, 44, 5, 3, 0x976c51);
    for (const x of [-15, 15]) m.box(x, y, 0, 3, 4, 7, 0x69493e);
  }
  m.box(0, -12, 13, 43, 13, 3, 0xb48663);
  m.face(
    [
      [-21, -19, 16.1],
      [21, -19, 16.1],
      [21, -5, 16.1],
      [-21, -5, 16.1],
    ],
    0xffffff,
    [
      [0.03, 0.28],
      [0.97, 0.28],
      [0.97, 0.62],
      [0.03, 0.62],
    ],
  );
}
function fort(m: Model) {
  for (const x of [-22, 22]) {
    for (const dx of [-12, 12]) for (const y of [-34, -4]) m.box(x + dx, y, 0, 4, 4, 47, 0xac743c);
    m.box(x, -19, 28, 28, 34, 4, 0xcb8741);
    for (const y of [-35, -3]) {
      m.box(x, y, 40, 28, 3, 3, 0xe5b94b);
      for (const dx of [-9, -3, 3, 9]) m.box(x + dx, y, 32, 2, 2, 8, 0xe5b94b);
    }
    const rim: Vertex[] = [
      [x - 16, -38, 46],
      [x + 16, -38, 46],
      [x + 16, 0, 46],
      [x - 16, 0, 46],
    ];
    for (let i = 0; i < 4; i++)
      m.face(
        [required(rim[i]), required(rim[(i + 1) % 4]), [x, -19, 60]],
        i % 2 ? 0xc53c37 : 0xd95341,
      );
  }
  m.box(0, -22, 28, 17, 12, 3, 0x6897bb);
  m.face(
    [
      [-30, -4, 31],
      [-14, -4, 31],
      [-14, 13, 1],
      [-30, 13, 1],
    ],
    0x438ccc,
  );
}
function arch(m: Model) {
  // Walkable steps rise towards the middle, matching the gameplay colliders.
  const big = m.prop.type === "prop-climb-arch",
    depth = big ? 24 : 16;
  const height = (x: number) => (big ? 12 : 8) * (1 - Math.abs(x) / 20);
  for (let x = -20; x < 20; x += 4) {
    const a = height(x),
      b = height(x + 4);
    m.face(
      [
        [x, -depth, a],
        [x + 4, -depth, b],
        [x + 4, 0, b],
        [x, 0, a],
      ],
      big ? 0x4f9acc : 0x5c9742,
    );
    for (const y of [-depth, 0]) {
      const c = big ? 0xc45143 : 0x386aa0;
      m.box(x, y, a, 1.6, 1.6, 9, c);
      m.face(
        [
          [x, y, a + 9],
          [x + 4, y, b + 9],
          [x + 4, y, b + 11],
          [x, y, a + 11],
        ],
        c,
      );
    }
  }
}
function hoop(m: Model) {
  m.box(0, -4, 0, 3, 4, 40, 0x6c6773);
  m.box(0, -4, 32, 30, 2, 18, 0xe4dcd2);
  m.panel(0, -2.8, 32, 30, 18, [0.16, 0.03, 0.83, 0.4]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    const point = (angle: number, r: number, z: number): Vertex => [
      r * Math.cos(angle),
      4 + r * Math.sin(angle),
      z,
    ];
    m.face([point(a, 6, 33), point(b, 6, 33), point(b, 6, 31.7), point(a, 6, 31.7)], 0xcb5c3c);
    if (i % 2 === 0)
      m.face(
        [point(a, 6, 32), point(a + 0.13, 6, 32), point(b + 0.13, 4, 26), point(b, 4, 26)],
        0xeae4d6,
      );
  }
}

/** Cut-outs keep the original transparent detail on both faces. Join their actual
 * silhouette edges with textured strips, including holes under signs and arches. */
interface Edge {
  x: number;
  y: number;
  endX: number;
  endY: number;
  u: number;
  v: number;
}
function edgeSegment(
  horizontal: boolean,
  start: number,
  i: number,
  fixed: number,
  side: number,
  w: number,
  h: number,
): Edge {
  return horizontal
    ? { x: start, y: fixed, endX: i, endY: fixed, u: 0, v: (-side * 0.5) / h }
    : { x: fixed, y: start, endX: fixed, endY: i, u: (-side * 0.5) / w, v: 0 };
}
const contours = new WeakMap<HTMLCanvasElement, Edge[]>();
function silhouette(image: HTMLCanvasElement) {
  const cached = contours.get(image);
  if (cached) return cached;
  const { width: w, height: h } = image;
  const rgba = required(image.getContext("2d")).getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) =>
    x >= 0 && x < w && y >= 0 && y < h && (rgba[(y * w + x) * 4 + 3] ?? 0) >= 160;
  const edges: Edge[] = [];
  function exposed(i: number, line: number, side: number, horizontal: boolean) {
    return horizontal
      ? solid(i, line) && !solid(i, line + side)
      : solid(line, i) && !solid(line + side, i);
  }
  function traceLine(horizontal: boolean, side: number, line: number) {
    const fixed = line + (side > 0 ? 1 : 0);
    let start = -1;
    for (let i = 0; i <= (horizontal ? w : h); i++) {
      const edge = exposed(i, line, side, horizontal);
      if (edge && start < 0) start = i;
      if (edge || start < 0) continue;
      edges.push(edgeSegment(horizontal, start, i, fixed, side, w, h));
      start = -1;
    }
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < h; row++) traceLine(true, side, row);
    for (let col = 0; col < w; col++) traceLine(false, side, col);
  }
  contours.set(image, edges);
  return edges;
}
function relief(m: Model, depth: number, heightScale: number) {
  const { width: w, height: h } = m.art.frame;
  const world = (x: number, y: number, d: number): Vertex => [x - w / 2, d, (h - y) * heightScale];
  for (const d of [0, -depth]) m.panel(0, d, 0, w, h * heightScale);
  for (const e of silhouette(m.art.image)) {
    const uv = (x: number, y: number): UV => [
      Math.min((w - 0.5) / w, x / w + e.u),
      Math.min((h - 0.5) / h, y / h + e.v),
    ];
    const a = uv(e.x, e.y),
      b = uv(e.endX, e.endY);
    m.face(
      [
        world(e.x, e.y, 0),
        world(e.endX, e.endY, 0),
        world(e.endX, e.endY, -depth),
        world(e.x, e.y, -depth),
      ],
      0xd0c4b8,
      [a, b, b, a],
    );
  }
}
const models: Record<string, (m: Model) => void> = {
  "prop-tent-blue": tent,
  "prop-tent-green": tent,
  "prop-beach-umbrella": umbrella,
  "prop-picnic-table": table,
  "prop-play-fort": fort,
  "prop-climb-arch": arch,
  "prop-seesaw": arch,
  "prop-basketball-hoop": hoop,
  "prop-park-boatBar": (m) => relief(m, 28, 0.75),
  "prop-park-hedgeArch": (m) => relief(m, 11, 0.87),
  "prop-park-volleyNet": (m) => relief(m, 2, 0.85),
  "prop-park-campSign": (m) => relief(m, 5, 0.93),
  "prop-park-flowers": (m) => relief(m, 10, 0.74),
  "prop-park-cookingPot": (m) => relief(m, 8, 0.85),
  "prop-park-logLong": (m) => relief(m, 8, 0.65),
  "prop-garden-fountain": (m) => relief(m, 18, 0.75),
};
export function appendLeisureModel(
  groups: BuildingFaces,
  images: FirstPersonImages,
  white: THREE.Texture,
  prop: Prop,
  elevation: number,
): boolean {
  const build = models[prop.type];
  if (!build) return false;
  const image = images.prop(prop, false);
  if (image) {
    appendLeftover(faces(groups.sprite, image.texture), prop, image.frame, elevation);
    build(
      new Model(
        prop,
        elevation,
        image,
        faces(groups.model, white),
        faces(groups.model, image.texture),
      ),
    );
  }
  return true;
}

/** The lab pier's plank artwork is horizontal. Piles stand outside the walking strip. */
export function appendPierPiles(
  groups: BuildingFaces,
  images: FirstPersonImages,
  white: THREE.Texture,
  prop: Prop,
  elevation: number,
) {
  const art = images.prop(prop, false);
  if (!art) return;
  const color = faces(groups.model, white);
  const m = new Model(prop, elevation, art, color, color);
  for (const x of [-53, 53])
    for (const y of [-41, -18]) {
      m.box(x, y, 0, 4, 4, 8, 0x805638);
      m.box(x, y, 7, 5, 5, 2, 0xbd9062);
    }
}
