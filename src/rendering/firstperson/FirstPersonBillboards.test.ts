import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type Billboard, CardArrays, StaticCards } from "./FirstPersonBillboards.js";

const card = (texture: THREE.Texture, x: number, extra: Partial<Billboard> = {}): Billboard => ({
  texture,
  uv: [0.25, 0.1, 0.75, 0.9],
  x,
  y: 20,
  z: 5,
  width: 32,
  height: 48,
  ...extra,
});

describe("first-person cards", () => {
  it("writes each card as a foot centre plus corner offsets for the shader to expand", () => {
    const arrays = new CardArrays(1);
    arrays.push(card(new THREE.Texture(), 10));
    expect(arrays.count).toBe(1);
    // Every vertex carries the same centre; the eye's direction is not baked in.
    expect([...arrays.centres]).toEqual([10, 20, 5, 10, 20, 5, 10, 20, 5, 10, 20, 5]);
    // Bottom-left, bottom-right, top-right, top-left: (across, up).
    expect([...arrays.corners]).toEqual([-16, 0, 16, 0, 16, 48, -16, 48]);
    // v counts from the image top, so the feet take the bottom edge.
    const uvs = [...arrays.uvs].map((v) => Math.round(v * 100) / 100);
    expect(uvs).toEqual([0.25, 0.9, 0.75, 0.9, 0.75, 0.1, 0.25, 0.1]);
  });

  it("merges every chunk's standing cards into one mesh per texture", () => {
    const parent = new THREE.Group(),
      casters = new THREE.Group();
    const material = () => new THREE.MeshBasicMaterial();
    const cards = new StaticCards(parent, material, casters, material);
    const oak = new THREE.Texture(),
      pine = new THREE.Texture();
    cards.set("0,0", [card(oak, 1), card(pine, 2), card(oak, 3)]);
    cards.set("1,0", [card(oak, 4)]);
    expect(cards.flush()).toBe(true);
    expect(cards.count).toBe(4);
    expect(parent.children).toHaveLength(2);
    const drawn = (parent.children as THREE.Mesh[]).map((mesh) => mesh.geometry.drawRange.count);
    expect(drawn.sort((a, b) => a - b)).toEqual([6, 18]); // one pine card, three oak cards
    // The sun's copies share the same buffers.
    expect(casters.children).toHaveLength(2);
    expect((casters.children[0] as THREE.Mesh).geometry).toBe(
      (parent.children[0] as THREE.Mesh).geometry,
    );
    // Nothing changed: nothing is rebuilt, so the sun's map stays valid.
    expect(cards.flush()).toBe(false);
    // Releasing a chunk rebuilds only its textures and drops empty meshes.
    cards.delete("0,0");
    expect(cards.flush()).toBe(true);
    expect(cards.count).toBe(1);
    expect(parent.children).toHaveLength(1);
    expect(casters.children).toHaveLength(1);
    cards.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
