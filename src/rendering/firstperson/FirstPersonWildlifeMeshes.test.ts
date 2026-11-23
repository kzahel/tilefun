import * as THREE from "three";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it, vi } from "vitest";
import { RABBIT_TYPE } from "../../wildlife/Rabbit.js";
import type { SpriteItem } from "../SceneItem.js";
import { WILDLIFE_MESHES } from "../WildlifeMeshCatalog.js";
import { FirstPersonWildlifeMeshes } from "./FirstPersonWildlifeMeshes.js";

it("draws a crowd past the old wildlife cap and preserves the early instance transforms", async () => {
  const root = new THREE.Group();
  const wildlife = new FirstPersonWildlifeMeshes(root, () => {});
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.BoxGeometry()));
  const catalog = vi.spyOn(WILDLIFE_MESHES, "get").mockReturnValue({
    path: "rabbit.glb",
    height: 1,
  });
  const load = vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockResolvedValue({ scene: source, animations: [] } as unknown as GLTF);
  const rabbit: SpriteItem = {
    kind: "sprite",
    wx: 100,
    wy: 200,
    zOffset: 0,
    sortKey: 0,
    sheetKey: RABBIT_TYPE,
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 32,
    spriteHeight: 32,
    flipX: false,
    drawOffsetY: 0,
    hasShadow: false,
    shadowFeetWy: 200,
    shadowWidth: 0,
    shadowTerrainZ: 0,
    flashHidden: false,
  };
  try {
    wildlife.begin(true, false);
    expect(wildlife.push(rabbit)).toBe("unavailable");
    expect(wildlife.end()).toBe(0);
    await vi.waitFor(() => expect(root.children[0]?.children).toHaveLength(1));

    wildlife.begin(true, false);
    for (let i = 0; i < 35; i++) {
      expect(wildlife.push({ ...rabbit, wx: rabbit.wx + i })).toBe("drawn");
    }
    expect(wildlife.end()).toBe(35);
    const [mesh] = root.children[0]?.children ?? [];
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    if (!(mesh instanceof THREE.InstancedMesh)) throw new Error("Missing instanced model");
    expect(mesh.count).toBe(35);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBe(100);
    mesh.getMatrixAt(34, matrix);
    expect(matrix.elements[12]).toBe(134);
  } finally {
    wildlife.dispose();
    load.mockRestore();
    catalog.mockRestore();
  }
});
