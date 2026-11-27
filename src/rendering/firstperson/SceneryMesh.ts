import * as THREE from "three";
import type { Prop } from "../../entities/Prop.js";
import { required } from "../../shared/required.js";
import type { PropImage } from "./FirstPersonImages.js";
import type { TexturedTriangles } from "./FirstPersonProps.js";
export type Vertex = readonly [x: number, y: number, z: number];
type UV = readonly [u: number, v: number];
type Polygon = readonly Vertex[];
export const faces = (batch: Map<THREE.Texture, TexturedTriangles>, texture: THREE.Texture) => {
  const f = batch.get(texture) ?? { positions: [], colors: [], uvs: [] };
  batch.set(texture, f);
  return f;
};

export class Model {
  constructor(
    readonly prop: Prop,
    readonly z: number,
    readonly art: PropImage,
    readonly colorFaces: TexturedTriangles,
    readonly artFaces: TexturedTriangles,
  ) {}
  face(points: Polygon, color: number, uvs?: readonly UV[]) {
    const f = uvs ? this.artFaces : this.colorFaces;
    const c = new THREE.Color(color);
    for (let i = 1; i + 1 < points.length; i++)
      for (const j of [0, i, i + 1]) {
        const p = required(points[j]);
        f.positions.push(this.prop.position.wx + p[0], this.prop.position.wy + p[1], this.z + p[2]);
        f.colors.push(c.r, c.g, c.b);
        f.uvs.push(...(uvs?.[j] ?? [0, 0]));
      }
  }
  box(x: number, y: number, z: number, w: number, d: number, h: number, color: number) {
    const a = x - w / 2,
      b = x + w / 2,
      n = y - d / 2,
      s = y + d / 2,
      top = z + h;
    const shade = new THREE.Color(color);
    const dim = shade.multiplyScalar(0.77).getHex();
    this.face(
      [
        [a, n, top],
        [b, n, top],
        [b, s, top],
        [a, s, top],
      ],
      color,
    );
    this.face(
      [
        [a, n, z],
        [a, s, z],
        [a, s, top],
        [a, n, top],
      ],
      dim,
    );
    this.face(
      [
        [b, n, z],
        [b, s, z],
        [b, s, top],
        [b, n, top],
      ],
      dim,
    );
    this.face(
      [
        [a, s, z],
        [b, s, z],
        [b, s, top],
        [a, s, top],
      ],
      color,
    );
    this.face(
      [
        [a, n, z],
        [b, n, z],
        [b, n, top],
        [a, n, top],
      ],
      dim,
    );
    if (z > 0)
      this.face(
        [
          [a, n, z],
          [b, n, z],
          [b, s, z],
          [a, s, z],
        ],
        dim,
      );
  }
  panel(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    uv: readonly [number, number, number, number] = [0, 0, 1, 1],
  ) {
    const [u, v, r, b] = uv;
    this.face(
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y, z + h],
        [x - w / 2, y, z + h],
      ],
      0xffffff,
      [
        [u, b],
        [r, b],
        [r, v],
        [u, v],
      ],
    );
  }
}
