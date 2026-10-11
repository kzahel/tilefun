import type * as THREE from "three";
/** Same fixed x, y-z projection as projectWorld. Asset proportions belong in
 * the body registration, before entity rotation, never in a heading-dependent lens.
 */
export function setCarMeshProjection(matrix: THREE.Matrix4, radius: number) {
  matrix.set(
    1 / radius,
    0,
    0,
    0,
    0,
    -1 / radius,
    1 / radius,
    0,
    0,
    -1 / (radius * 4),
    -1 / (radius * 4),
    0,
    0,
    0,
    0,
    1,
  );
}
