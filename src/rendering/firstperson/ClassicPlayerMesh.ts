import * as THREE from "three";
import { PLAYER_FRAME_DURATION } from "../../config/constants.js";
import type { WildlifeMeshDefinition } from "../WildlifeMeshCatalog.js";

/** Standing Classic faces +Z in glTF. Use the same reviewed bytes as the orbit viewer. */
export const CLASSIC_PLAYER_MESH: WildlifeMeshDefinition = {
  path: "demos/classic-player-3d/v1/classic-player.glb",
  height: 16,
  topDown: { width: 1.1, height: 0.89 },
  forwardYaw: Math.PI,
  animation: {
    clips: [
      { name: "Idle", start: 0, count: 1, frameDuration: PLAYER_FRAME_DURATION, loop: true },
      { name: "Walk", start: 0, count: 4, frameDuration: PLAYER_FRAME_DURATION, loop: true },
    ],
  },
  prepare(scene) {
    // The studio GLB has a rough PBR material. Tilefun lights palette meshes
    // with its own sun shader. Retain soft volume even on a shadowless map.
    const key = new THREE.Vector3(-0.4, 0.8, 0.5).normalize();
    const normal = new THREE.Vector3();
    scene.traverse((part) => {
      if (!(part instanceof THREE.Mesh) || !(part.material instanceof THREE.MeshStandardMaterial))
        return;
      const original = part.material;
      const normals = part.geometry.getAttribute("normal");
      const colors = new Float32Array(normals.count * 3);
      for (let i = 0; i < normals.count; i++) {
        const diffuse = 0.77 + 0.2 * normal.fromBufferAttribute(normals, i).dot(key);
        colors.fill(diffuse, i * 3, i * 3 + 3);
      }
      part.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      part.material = new THREE.MeshBasicMaterial({
        map: original.map,
        color: original.color,
        side: original.side,
        vertexColors: true,
      });
      original.dispose();
    });
  },
};
