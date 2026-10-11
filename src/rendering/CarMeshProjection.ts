import type * as THREE from "three";
import type { MeshInstance } from "./MeshPresentation.js";

/** Retained compact-final-setup.json camera metrics. The sprite's side views
 * use 42 degrees; front/rear use 70 degrees and a wider horizontal scale.
 * Blend the affine metrics continuously through turns. World anchors still
 * use the ordinary game projection; only the authored body uses this camera.
 */
export function setCarMeshProjection(
  matrix: THREE.Matrix4,
  radius: number,
  [x, y, z, w]: MeshInstance["orientation"],
) {
  const forwardX = 1 - 2 * (y * y + z * z);
  const forwardY = 2 * (x * y + z * w);
  const lengthSquared = forwardX * forwardX + forwardY * forwardY;
  const front = lengthSquared > 1e-12 ? (forwardY * forwardY) / lengthSquared : 0;
  const sideScale = 1.04;
  const frontScale = 1.3;
  const sideVertical = sideScale * 1.21;
  const frontVertical = frontScale * 0.8186;
  const sideElevation = (42 * Math.PI) / 180;
  const frontElevation = (70 * Math.PI) / 180;
  const blend = (side: number, head: number) => side + (head - side) * front;
  const horizontal = blend(sideScale, frontScale);
  const ground = blend(
    sideVertical * Math.sin(sideElevation),
    frontVertical * Math.sin(frontElevation),
  );
  const height = blend(
    sideVertical * Math.cos(sideElevation),
    frontVertical * Math.cos(frontElevation),
  );
  matrix.set(
    horizontal / radius,
    0,
    0,
    0,
    0,
    -ground / radius,
    height / radius,
    0,
    0,
    -height / (radius * 4),
    -ground / (radius * 4),
    0,
    0,
    0,
    0,
    1,
  );
}
