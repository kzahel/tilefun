import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { authoredVehicleForType } from "../../src/rendering/AuthoredVehicleMeshes.js";
import type { WildlifeMeshDefinition } from "../../src/rendering/WildlifeMeshCatalog.js";
import { required } from "../../src/shared/required.js";

export const SPHERE_RADIUS = 8;
export const SPHERE_CHARACTER = "smoke-sphere-character";
export const SPHERE_CAR = "rosso-coupe";
const CAR_MODEL = required(authoredVehicleForType(`vehicle-v1:${SPHERE_CAR}`));

export const sphereCharacterModel = {
  path: "__sphere-character.glb",
  height: 2 * SPHERE_RADIUS,
  animation: { clips: [{ name: "Turn", start: 0, count: 2, frameDuration: 500, loop: true }] },
} satisfies WildlifeMeshDefinition;

function sphereGeometry() {
  return new THREE.SphereGeometry(SPHERE_RADIUS, 48, 24).translate(0, SPHERE_RADIUS, 0);
}

function carSphere() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(sphereGeometry(), new THREE.MeshBasicMaterial({ color: 0xd74635 })));
  // The authored car loader requires the regular wheel hierarchy. Empty pivots
  // exercise its registration and posing without affecting the silhouette.
  for (const id of ["FL", "FR", "RL", "RR"]) {
    const steer = new THREE.Group();
    steer.name = `Wheel_${id}_Steer`;
    const roll = new THREE.Group();
    roll.name = `Wheel_${id}_Roll`;
    roll.userData = { wheel_radius: 1, roll_axis_gltf: [0, 0, 1] };
    steer.add(roll);
    group.add(steer);
  }
  return group;
}

function characterSphere() {
  const geometry = sphereGeometry();
  const vertices = geometry.getAttribute("position").count;
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(new Uint16Array(vertices * 4), 4),
  );
  const weights = new Float32Array(vertices * 4);
  for (let i = 0; i < vertices; i++) weights[i * 4] = 1;
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0x138b76 }));
  const pivot = new THREE.Bone();
  pivot.name = "SpherePivot";
  pivot.position.y = SPHERE_RADIUS;
  mesh.add(pivot);
  mesh.bind(new THREE.Skeleton([pivot]));
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const track = new THREE.QuaternionKeyframeTrack(
    "SpherePivot.quaternion",
    [0, 1],
    [0, 0, 0, 1, ...spin.toArray()],
  );
  const animation = new THREE.AnimationClip("Turn", 1, [track]);
  return { mesh, animation };
}

/** Generated GLBs go through the same loader and rigs as registered game assets. */
export async function sphereFixtures() {
  const writer = new GLTFExporter();
  const car = await writer.parseAsync(carSphere(), { binary: true });
  const { mesh, animation } = characterSphere();
  const character = await writer.parseAsync(mesh, { binary: true, animations: [animation] });
  if (!(car instanceof ArrayBuffer) || !(character instanceof ArrayBuffer))
    throw Error("Expected binary GLBs");
  return {
    assets: {
      [CAR_MODEL.path]: Array.from(new Uint8Array(car)),
      [sphereCharacterModel.path]: Array.from(new Uint8Array(character)),
    },
    characterCatalog: { [SPHERE_CHARACTER]: sphereCharacterModel },
  };
}
