import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { setCarMeshProjection } from "../CarMeshProjection.js";
import type { BodyImage } from "../View3dHost.js";
import { BodyImageCards, bodyImageDepth, bodyImagePixels } from "./FirstPersonBodyImages.js";
import type { SunUniforms } from "./FirstPersonMaterials.js";
import { obliqueProjection, obliqueScreen } from "./ObliqueCamera.js";

describe("vehicle images in the top-down camera", () => {
  it("turns an image's depth into the depth the camera gives the same point", () => {
    const radius = 80,
      scale = 3,
      width = 1280,
      height = 800;
    const camera = { x: 500, y: 300, scale };
    const anchor = { x: 540, y: 260, z: 6 };
    // The image's camera, as GpuMeshBodies sets it: the body at its origin, game axes.
    const local = new THREE.Matrix4();
    setCarMeshProjection(local, radius);
    const northDepth = obliqueProjection(scale, width, height)[9] ?? 0;
    const centre = obliqueScreen(camera, width, height, anchor.x, anchor.y, anchor.z).depth;
    for (const [dx, dy, dz] of [
      [0, 0, 0],
      [30, -20, 0],
      [-12, 40, 25],
      [5, -70, 60],
    ] as const) {
      const sample = new THREE.Vector3(dx, dy, dz).applyMatrix4(local).z * 0.5 + 0.5;
      const expected = obliqueScreen(
        camera,
        width,
        height,
        anchor.x + dx,
        anchor.y + dy,
        anchor.z + dz,
      ).depth;
      expect(bodyImageDepth(centre, sample, radius, northDepth)).toBeCloseTo(expected, 9);
    }
  });

  it("covers a whole number of screen pixels, as the fixed view's actor images do", () => {
    expect(bodyImagePixels(80, 3)).toBe(480);
    expect(bodyImagePixels(80, 0.3)).toBe(48);
    expect(bodyImagePixels(64, 1.37)).toBe(175);
    expect(bodyImagePixels(1, 0.1)).toBe(1);
  });

  it("draws the frame's images in one render, farthest first, and lets go of them after", () => {
    const sun = {} as SunUniforms;
    const cards = new BodyImageCards(sun);
    const shown: { centre: number[]; side: number; halfSide: number; image: unknown }[][] = [];
    const renderer = {
      render(scene: THREE.Scene) {
        const meshes = scene.children.filter(
          (child): child is THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> =>
            child.visible && child instanceof THREE.Mesh,
        );
        meshes.sort((a, b) => a.renderOrder - b.renderOrder);
        shown.push(
          meshes.map((mesh) => {
            const u = mesh.material.uniforms as Record<string, THREE.IUniform>;
            const centre = u.centre?.value as THREE.Vector3 | undefined;
            return {
              centre: centre?.toArray() ?? [],
              side: u.side?.value,
              halfSide: u.halfSide?.value,
              image: u.image?.value,
            };
          }),
        );
      },
    } as unknown as THREE.WebGLRenderer;
    const image = (radius: number): BodyImage => ({
      texture: new THREE.Texture(),
      depth: new THREE.Texture(),
      radius,
    });
    const near = image(80),
      far = image(64),
      raised = image(64);
    cards.begin();
    cards.push({ wx: 10, wy: 200, zOffset: 0 }, near);
    cards.push({ wx: 30, wy: 100, zOffset: 0 }, far);
    // Height brings a body nearer, as distance south does.
    cards.push({ wx: 50, wy: 100, zOffset: 40 }, raised);
    cards.draw(renderer, new THREE.Camera(), 1.5);
    expect(cards.count).toBe(3);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.map((card) => card.image)).toEqual([
      far.texture,
      raised.texture,
      near.texture,
    ]);
    // Scene axes: game Y mirrored. The square is its whole pixels wide in the world.
    expect(shown[0]?.[0]).toMatchObject({ centre: [30, -100, 0], side: 192, halfSide: 64 });
    expect(shown[0]?.[2]).toMatchObject({ centre: [10, -200, 0], side: 240, halfSide: 80 });

    // A frame with fewer bodies hides the rest; one with none draws nothing.
    cards.begin();
    cards.push({ wx: 10, wy: 200, zOffset: 0 }, near);
    cards.draw(renderer, new THREE.Camera(), 1.5);
    expect(shown[1]).toHaveLength(1);
    cards.begin();
    cards.draw(renderer, new THREE.Camera(), 1.5);
    expect(shown).toHaveLength(2);
    expect(cards.count).toBe(0);
    const { scene } = cards as unknown as { scene: THREE.Scene };
    for (const child of scene.children) {
      const { uniforms } = (child as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>)
        .material;
      expect(uniforms.image?.value).toBeNull();
      expect(uniforms.imageDepth?.value).toBeNull();
    }
    cards.dispose();
  });
});
