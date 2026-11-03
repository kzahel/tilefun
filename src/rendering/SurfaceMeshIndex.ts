import type { Point3, SurfaceMesh } from "./SurfaceReceivers.js";

interface Bounds {
  min: Point3;
  max: Point3;
}
interface Node extends Bounds {
  left?: Node;
  right?: Node;
  indices?: number[];
}
const indexes = new WeakMap<SurfaceMesh, SurfaceMeshIndex>();
const overlaps = (a: Bounds, b: Bounds) =>
  a.min.every((n, i) => n <= (b.max[i] ?? 0) + 1e-6 && (a.max[i] ?? 0) >= (b.min[i] ?? 0) - 1e-6);
/** Retained local triangle BVH. Moving instances query it in local coordinates,
 * then transform only the small selected set; parked/moving bodies share it. */
export class SurfaceMeshIndex {
  private readonly root: Node;
  private readonly bounds: Bounds[];
  static for(mesh: SurfaceMesh) {
    let index = indexes.get(mesh);
    if (!index) {
      index = new SurfaceMeshIndex(mesh);
      indexes.set(mesh, index);
    }
    return index;
  }
  private constructor(mesh: SurfaceMesh) {
    this.bounds = mesh.triangles.map((t) => ({
      min: [
        Math.min(...t.map((p) => p[0])),
        Math.min(...t.map((p) => p[1])),
        Math.min(...t.map((p) => p[2])),
      ],
      max: [
        Math.max(...t.map((p) => p[0])),
        Math.max(...t.map((p) => p[1])),
        Math.max(...t.map((p) => p[2])),
      ],
    }));
    this.root = this.build(mesh.triangles.map((_, i) => i));
  }
  private build(indices: number[]): Node {
    const low = (axis: number) => Math.min(...indices.map((i) => this.bounds[i]?.min[axis] ?? 0));
    const high = (axis: number) => Math.max(...indices.map((i) => this.bounds[i]?.max[axis] ?? 0));
    const min: Point3 = [low(0), low(1), low(2)],
      max: Point3 = [high(0), high(1), high(2)];
    if (indices.length <= 8) return { min, max, indices };
    let axis = 0;
    for (let i = 1; i < 3; i++)
      if ((max[i] ?? 0) - (min[i] ?? 0) > (max[axis] ?? 0) - (min[axis] ?? 0)) axis = i;
    indices.sort(
      (a, b) =>
        (this.bounds[a]?.min[axis] ?? 0) +
        (this.bounds[a]?.max[axis] ?? 0) -
        ((this.bounds[b]?.min[axis] ?? 0) + (this.bounds[b]?.max[axis] ?? 0)),
    );
    const mid = Math.floor(indices.length / 2);
    return {
      min,
      max,
      left: this.build(indices.slice(0, mid)),
      right: this.build(indices.slice(mid)),
    };
  }
  query(min: Point3, max: Point3): number[] {
    const out: number[] = [],
      bounds = { min, max };
    const visit = (node: Node) => {
      if (!overlaps(node, bounds)) return;
      if (node.indices) {
        for (const i of node.indices) {
          const b = this.bounds[i];
          if (b && overlaps(b, bounds)) out.push(i);
        }
      } else {
        if (node.left) visit(node.left);
        if (node.right) visit(node.right);
      }
    };
    visit(this.root);
    return out;
  }
}
