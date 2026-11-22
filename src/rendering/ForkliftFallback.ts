import * as THREE from "three";
import { FORKLIFT, FORKLIFT_SCALE as SCALE } from "../traffic/Forklift.js";
import { CarMeshAsset } from "./CarMeshAsset.js";

/** Keep the two powered joints visible if the textured forklift cannot load.
 * These plain volumes use the same ground pivot and blade dimensions. */
export function forkliftFallback() {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  scene.add(root);
  root.scale.setScalar(SCALE);
  const yellow = new THREE.MeshBasicMaterial({ color: 0xe8ac45 });
  const gray = new THREE.MeshBasicMaterial({ color: 0x798591 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x3b424c });
  const box = (
    parent: THREE.Object3D,
    x: number,
    z: number,
    y: number,
    l: number,
    h: number,
    w: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(l / SCALE, h / SCALE, w / SCALE), material);
    mesh.position.set(-x / SCALE, z / SCALE, y / SCALE);
    parent.add(mesh);
  };
  const group = (parent: THREE.Object3D, name: string) => {
    const node = new THREE.Group();
    node.name = name;
    parent.add(node);
    return node;
  };
  box(root, -4, 8.8, 0, 38, 9, 20, yellow);
  box(root, -16, 15, 0, 14, 12, 22, yellow);
  box(root, -5, 13, 0, 8, 2.5, 10, dark);
  for (const y of [-10, 10]) {
    for (const x of [-13, 7]) box(root, x, 24, y, 1.3, 24, 1.3, dark);
    box(root, -3, 36, y, 21, 1.3, 1.3, dark);
  }
  for (const x of [-13, 7]) box(root, x, 36, 0, 1.3, 1.3, 21, dark);

  const mast = group(root, "Forklift_Mast");
  const { mastX, mastZ, deck, tines } = FORKLIFT;
  mast.position.set(-mastX / SCALE, mastZ / SCALE, 0);
  const inner = group(mast, "Forklift_InnerMast");
  const carriage = group(mast, "Forklift_Carriage");
  for (const y of [-6.8, 6.8]) {
    box(mast, 0, 16.5, y, 2.1, 33, 1.6, dark);
    box(inner, 0.8, 16, y, 0.9, 28, 0.8, gray);
  }
  box(carriage, 1.4, 4.2, 0, 1.6, 3.7, 15, dark);
  for (const y of [-tines.y, tines.y]) {
    box(carriage, deck.back - mastX, 1.9, y, 1.4, 8, 2 * tines.halfWidth, gray);
    box(
      carriage,
      (deck.back + deck.tip) / 2 - mastX,
      (deck.bottom + deck.top) / 2 - mastZ,
      y,
      deck.tip - deck.back,
      deck.top - deck.bottom,
      2 * tines.halfWidth,
      gray,
    );
  }

  for (const front of [true, false]) {
    for (const left of [true, false]) {
      const id = `${front ? "F" : "R"}${left ? "L" : "R"}`;
      const radius = front ? 5.5652 : 4.3478;
      const steer = group(root, `Wheel_${id}_Steer`);
      steer.position.set(
        (front ? -13.5652 : 16) / SCALE,
        radius / SCALE,
        ((left ? 1 : -1) * (front ? 10.7826 : 9.913)) / SCALE,
      );
      const roll = group(steer, `Wheel_${id}_Roll`);
      roll.userData = { wheel_radius: radius, roll_axis_gltf: [0, 0, -1] };
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(radius / SCALE, radius / SCALE, 3.8 / SCALE, 12),
        dark,
      );
      wheel.rotation.x = Math.PI / 2;
      roll.add(wheel);
    }
  }
  return new CarMeshAsset(scene, 1, { batch: true });
}
