import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const identity = new THREE.Matrix4();

/** Compile compatible opaque siblings once, without baking transforms or changing
 * vertex values. Parent groups keep wheel/steer/bogie motion and visibility. Tagged
 * effects, custom draws and unsupported geometry keep their original meshes.
 */
export function batchVehicleGeometry(
  scene: THREE.Object3D,
  retain: (geometry: THREE.BufferGeometry) => void,
  preserveParts: ReadonlySet<string> = new Set(),
): number {
  const parents = new Map<THREE.Object3D, Map<THREE.Material, Map<string, THREE.Mesh[]>>>();
  scene.traverse((node) => {
    if (
      !(node instanceof THREE.Mesh) ||
      node.type !== "Mesh" ||
      !node.parent ||
      node.children.length ||
      !node.visible ||
      node.userData.tilefun_role ||
      preserveParts.has(node.name) ||
      Array.isArray(node.material) ||
      node.material.transparent ||
      !(
        node.material instanceof THREE.MeshBasicMaterial ||
        node.material instanceof THREE.MeshStandardMaterial
      ) ||
      (node.material instanceof THREE.MeshPhysicalMaterial && node.material.transmission > 0) ||
      node.onBeforeRender !== THREE.Mesh.prototype.onBeforeRender ||
      node.onAfterRender !== THREE.Mesh.prototype.onAfterRender ||
      node.customDepthMaterial ||
      node.customDistanceMaterial
    )
      return;
    if (node.matrixAutoUpdate) node.updateMatrix();
    if (!node.matrix.equals(identity)) return;
    const geometry = node.geometry;
    if (
      geometry instanceof THREE.InstancedBufferGeometry ||
      geometry.drawRange.start !== 0 ||
      geometry.drawRange.count !== Infinity ||
      Object.keys(geometry.morphAttributes).length ||
      !geometry.getAttribute("position")
    )
      return;
    const attributes: [string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute][] = [];
    for (const name of Object.keys(geometry.attributes).sort()) {
      const attribute = geometry.getAttribute(name);
      if (
        !(
          attribute instanceof THREE.BufferAttribute ||
          attribute instanceof THREE.InterleavedBufferAttribute
        )
      )
        return;
      attributes.push([name, attribute]);
    }
    if (
      attributes.some(([, attribute]) => {
        const array =
          attribute instanceof THREE.InterleavedBufferAttribute
            ? attribute.data.array
            : attribute.array;
        return (
          !(array instanceof Float32Array) ||
          attribute instanceof THREE.InstancedBufferAttribute ||
          (attribute instanceof THREE.BufferAttribute && attribute.gpuType !== THREE.FloatType)
        );
      })
    )
      return;
    const key = [
      !!geometry.index,
      node.renderOrder,
      node.layers.mask,
      node.frustumCulled,
      node.castShadow,
      node.receiveShadow,
      ...attributes.map(
        ([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`,
      ),
    ].join("|");
    let materials = parents.get(node.parent);
    if (!materials) {
      materials = new Map();
      parents.set(node.parent, materials);
    }
    let layouts = materials.get(node.material);
    if (!layouts) {
      layouts = new Map();
      materials.set(node.material, layouts);
    }
    let meshes = layouts.get(key);
    if (!meshes) {
      meshes = [];
      layouts.set(key, meshes);
    }
    meshes.push(node);
  });
  for (const [parent, materials] of parents)
    for (const layouts of materials.values())
      for (const meshes of layouts.values()) {
        if (meshes.length < 2) continue;
        const first = meshes[0];
        if (!first) continue;
        const geometry = mergeGeometries(meshes.map((mesh) => mesh.geometry));
        if (!geometry) continue;
        retain(geometry);
        const batch = new THREE.Mesh(geometry, first.material);
        batch.name = `Batch:${parent.name || "body"}`;
        batch.renderOrder = first.renderOrder;
        batch.layers.mask = first.layers.mask;
        batch.frustumCulled = first.frustumCulled;
        batch.castShadow = first.castShadow;
        batch.receiveShadow = first.receiveShadow;
        // Insert where the first source sibling lived; unrelated/effect nodes keep
        // their relative traversal order. Opaque depth testing remains native.
        const index = parent.children.indexOf(first);
        for (const mesh of meshes) parent.remove(mesh);
        parent.add(batch);
        parent.children.splice(parent.children.indexOf(batch), 1);
        parent.children.splice(index, 0, batch);
      }
  let meshes = 0;
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes++;
  });
  return meshes;
}
