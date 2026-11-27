import * as THREE from "three";
import { expect, it } from "vitest";
import { createProp } from "../../entities/PropFactories.js";
import { required } from "../../shared/required.js";
import type { DeckMaterials } from "./FirstPersonDecks.js";
import type { FirstPersonImages } from "./FirstPersonImages.js";
import { PropMeshes } from "./FirstPersonPropMeshes.js";

it("switches a resident farmhouse between its exact sprite projection and textured solid faces", () => {
  const sprite = new THREE.Texture(),
    paint = new THREE.Texture(),
    siding = new THREE.Texture();
  const prop = createProp("prop-country-house", -93, 271);
  const frame = { left: -144, top: -256, width: 288, height: 256 };
  const images = {
    prop: (_p: unknown, opaque: boolean) => ({ frame, texture: opaque ? paint : sprite }),
    region: () => ({ texture: siding }),
  } as unknown as FirstPersonImages;
  const meshes = new PropMeshes(images, (m) => m);
  const built = meshes.build([prop], () => 2, undefined);
  expect(built.billboards).toHaveLength(0);
  expect([...built.buildings.sprite.keys()]).toEqual([sprite]);
  expect([...built.buildings.model.keys()]).toEqual([siding, paint]);
  const art = required(built.buildings.sprite.get(sprite));
  for (let v = 0; v < art.uvs.length / 2; v++) {
    const [x = 0, y = 0, z = 0] = art.positions.slice(v * 3, v * 3 + 3);
    const [u = 0, t = 0] = art.uvs.slice(v * 2, v * 2 + 2);
    expect(x - prop.position.wx).toBeCloseTo(frame.left + u * frame.width);
    expect(y - z - prop.position.wy + 16).toBeCloseTo(frame.top + t * frame.height);
  }
  const group = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  const parts = meshes.faceParts(built, "0,0", group, material, material, {} as DeckMaterials);
  for (const topDown of [true, false, true]) {
    meshes.buildings.show(topDown);
    const shown = parts.filter((p) => p.positions.length > 0 && p.parent.visible);
    expect(
      shown.every((p) => p.parent === (topDown ? meshes.buildings.sprite : meshes.buildings.model)),
    ).toBe(true);
    expect(shown).toHaveLength(topDown ? 1 : 2);
  }
  meshes.dispose();
  material.dispose();
});
