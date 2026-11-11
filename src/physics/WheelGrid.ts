import type RAPIER from "@dimforge/rapier3d-compat";
import type { SceneBody } from "./SceneBody.js";

/** Metres. Most bodies fit one cell; a wheel ray is far shorter than one. */
const CELL = 2;
const key = (x: number, z: number) => (x + 32768) * 65536 + (z + 32768);
const NONE: readonly SceneBody[] = [];

/**
 * Bodies by ground cell for one step's wheel rays, built from the poses captured
 * before any impulse. A ray then meets the few bodies whose bounding spheres reach
 * its cells instead of every body in the scene.
 */
export class WheelGrid {
  private readonly cells = new Map<number, SceneBody[]>();
  private readonly spare: SceneBody[][] = [];
  private readonly found = new Set<SceneBody>();
  private built = false;

  /** Poses are about to change: the next ray rebuilds the grid. */
  reset() {
    this.built = false;
    this.found.clear();
    // Retire travelled cells and release body references even if no next ray is cast.
    for (const cell of this.cells.values()) {
      const small = cell.length <= 64;
      cell.length = 0;
      if (small && this.spare.length < 1024) this.spare.push(cell);
    }
    this.cells.clear();
  }

  /** Every body whose bounding sphere can touch the ray segment, and possibly more. */
  near(
    bodies: Iterable<SceneBody>,
    origin: RAPIER.Vector,
    direction: RAPIER.Vector,
    length: number,
  ): Iterable<SceneBody> {
    if (!this.built) this.build(bodies);
    const endX = origin.x + direction.x * length,
      endZ = origin.z + direction.z * length;
    const x0 = Math.floor(Math.min(origin.x, endX) / CELL),
      x1 = Math.floor(Math.max(origin.x, endX) / CELL),
      z0 = Math.floor(Math.min(origin.z, endZ) / CELL),
      z1 = Math.floor(Math.max(origin.z, endZ) / CELL);
    if (x0 === x1 && z0 === z1) return this.cells.get(key(x0, z0)) ?? NONE;
    const found = this.found;
    found.clear();
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (const body of this.cells.get(key(x, z)) ?? NONE) found.add(body);
    return found;
  }

  private build(bodies: Iterable<SceneBody>) {
    this.built = true;
    for (const body of bodies) {
      const p = body.queryCenter,
        r = body.queryRadius;
      const x1 = Math.floor((p.x + r) / CELL),
        z1 = Math.floor((p.z + r) / CELL);
      for (let x = Math.floor((p.x - r) / CELL); x <= x1; x++)
        for (let z = Math.floor((p.z - r) / CELL); z <= z1; z++) {
          const address = key(x, z);
          let cell = this.cells.get(address);
          if (!cell) {
            cell = this.spare.pop() ?? [];
            this.cells.set(address, cell);
          }
          cell.push(body);
        }
    }
  }
}
