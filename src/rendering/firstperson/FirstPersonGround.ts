import * as THREE from "three";
import type { PageRegion } from "../View3dHost.js";
import type { ColoredTriangles } from "./FirstPersonTerrain.js";

/**
 * A chunk's ground mesh (250). Besides position and flat colour, every vertex
 * carries its place in the chunk's ground image (`groundTexel`) and where that
 * image's page sits in the page atlas (`groundPage`: corner x, corner y, layer).
 * The page is the same for the whole chunk; it is a vertex attribute rather than
 * a uniform so that chunks can later share one mesh and one draw.
 */
export function groundMesh(triangles: ColoredTriangles, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const count = triangles.positions.length / 3;
  geometry.setAttribute("position", new THREE.BufferAttribute(triangles.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(triangles.colors, 3));
  geometry.setAttribute(
    "groundTexel",
    new THREE.BufferAttribute(triangles.texels ?? new Float32Array(count * 2).fill(-1), 2),
  );
  geometry.setAttribute(
    "groundPage",
    new THREE.BufferAttribute(new Float32Array(count * 3).fill(-1), 3),
  );
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

/** Point a ground mesh at its chunk's page, or back at its flat colours. */
export function bindGroundPage(mesh: THREE.Mesh, page: PageRegion | undefined): void {
  const attribute = mesh.geometry.getAttribute("groundPage") as THREE.BufferAttribute;
  const values = attribute.array as Float32Array;
  for (let i = 0; i < values.length; i += 3) {
    values[i] = page?.x ?? -1;
    values[i + 1] = page?.y ?? -1;
    values[i + 2] = page?.layer ?? -1;
  }
  attribute.needsUpdate = true;
}
