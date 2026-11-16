import * as THREE from "three";

/** One owner's triangles for one merged mesh: non-indexed, in game axes, with a
 * linear colour per vertex and, for faces wearing artwork, a UV per vertex. */
export interface FacePart {
  /** Parts with the same bucket share a mesh: a name, or the texture they wear. */
  readonly bucket: unknown;
  /** Used when the bucket's mesh is first made. */
  readonly material: THREE.Material;
  readonly parent: THREE.Object3D;
  readonly positions: ArrayLike<number>;
  readonly colors: ArrayLike<number>;
  readonly uvs?: ArrayLike<number> | undefined;
  /** Line segments in pairs of points instead of triangles (surface grids). */
  readonly lines?: boolean | undefined;
}

interface Bucket {
  readonly parts: Map<string, FacePart>;
  mesh: THREE.Mesh | THREE.LineSegments | undefined;
  dirty: boolean;
}

/**
 * Static faces of many chunks merged into few meshes (251): cliff walls, and the
 * solid volumes of props. Each owner (a chunk's walls, a chunk's props) hands in
 * its triangles sorted into buckets, and every bucket draws as one mesh. Only
 * the buckets an owner touched are put together again, so the caller chooses
 * buckets small enough to rebuild: an area of the map for flat-coloured faces,
 * one artwork texture for faces that wear it.
 */
export class MergedFaces {
  private readonly buckets = new Map<unknown, Bucket>();
  /** The buckets each owner has a part in. */
  private readonly owners = new Map<string, unknown[]>();

  /** Meshes these faces draw as. */
  get count(): number {
    return this.buckets.size;
  }

  /** Replace everything `owner` contributes. Empty parts are ignored. */
  replace(owner: string, parts: readonly FacePart[]): void {
    this.remove(owner);
    const keys: unknown[] = [];
    for (const part of parts) {
      if (!part.positions.length) continue;
      let bucket = this.buckets.get(part.bucket);
      if (!bucket) {
        bucket = { parts: new Map(), mesh: undefined, dirty: true };
        this.buckets.set(part.bucket, bucket);
      }
      bucket.parts.set(owner, part);
      bucket.dirty = true;
      keys.push(part.bucket);
    }
    if (keys.length) this.owners.set(owner, keys);
  }

  remove(owner: string): void {
    for (const key of this.owners.get(owner) ?? []) {
      const bucket = this.buckets.get(key);
      if (bucket?.parts.delete(owner)) bucket.dirty = true;
    }
    this.owners.delete(owner);
  }

  /**
   * Put together the buckets that changed and drop the empty ones; returns the
   * vertices written. `made` sees each new or rebuilt mesh (shadow casting).
   */
  flush(made?: (mesh: THREE.Mesh) => void): number {
    let written = 0;
    for (const [key, bucket] of this.buckets) {
      if (!bucket.dirty) continue;
      bucket.dirty = false;
      bucket.mesh?.geometry.dispose();
      const [first] = bucket.parts.values();
      if (!first) {
        bucket.mesh?.removeFromParent();
        this.buckets.delete(key);
        continue;
      }
      let vertices = 0;
      for (const part of bucket.parts.values()) vertices += part.positions.length / 3;
      const positions = new Float32Array(vertices * 3),
        colors = new Float32Array(vertices * 3),
        uvs = first.uvs ? new Float32Array(vertices * 2) : undefined;
      let at = 0;
      for (const part of bucket.parts.values()) {
        positions.set(part.positions, at * 3);
        colors.set(part.colors, at * 3);
        if (uvs && part.uvs) uvs.set(part.uvs, at * 2);
        at += part.positions.length / 3;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      if (uvs) geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.computeBoundingSphere();
      if (bucket.mesh) {
        bucket.mesh.geometry = geometry;
        // A rebuilt owner may hand in a new parent (a room prop's view group).
        if (bucket.mesh.parent !== first.parent) first.parent.add(bucket.mesh);
      } else {
        bucket.mesh = first.lines
          ? new THREE.LineSegments(geometry, first.material)
          : new THREE.Mesh(geometry, first.material);
        first.parent.add(bucket.mesh);
      }
      if (bucket.mesh instanceof THREE.Mesh) made?.(bucket.mesh);
      written += vertices;
    }
    return written;
  }

  dispose(): void {
    for (const bucket of this.buckets.values()) {
      bucket.mesh?.geometry.dispose();
      bucket.mesh?.removeFromParent();
    }
    this.buckets.clear();
    this.owners.clear();
  }
}
