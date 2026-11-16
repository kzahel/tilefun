import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { DecalItem, ParticleItem } from "../SceneItem.js";
import { EffectQuads, MARK_LIFT } from "./FirstPersonEffects.js";
import { obliqueScreen } from "./ObliqueCamera.js";

const particle = (extra: Partial<ParticleItem> = {}): ParticleItem => ({
  kind: "particle",
  sortKey: 0,
  wx: 50,
  wy: 60,
  z: 4,
  size: 2,
  color: "#ff0000",
  alpha: 0.5,
  ...extra,
});

describe("particles and surface marks in the 3D scene", () => {
  it("stands a particle as the fixed view's square, facing the camera", () => {
    const effects = new EffectQuads(new THREE.Group());
    effects.fill([particle()], { x: 1, y: 0 });
    expect(effects.count).toBe(1);
    expect(effects.mesh.visible).toBe(true);
    const position = effects.mesh.geometry.getAttribute("position");
    const camera = { x: 50, y: 60, scale: 3 };
    const centre = obliqueScreen(camera, 300, 300, 50, 60, 4);
    // The fixed view fills `size` square world pixels centred on (wx, wy − z).
    const corners = [0, 1, 2, 3].map((i) => {
      const at = obliqueScreen(
        camera,
        300,
        300,
        position.getX(i),
        position.getY(i),
        position.getZ(i),
      );
      return [(at.sx - centre.sx) / 3, (at.sy - centre.sy) / 3];
    });
    expect(corners.map(([x, y]) => [Math.round(x ?? 0), Math.round(y ?? 0)])).toEqual([
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ]);
    const colour = effects.mesh.geometry.getAttribute("color");
    expect([colour.getX(0), colour.getY(0), colour.getW(0)]).toEqual([1, 0, 0.5]);
    effects.fill([], { x: 1, y: 0 });
    expect(effects.mesh.visible).toBe(false);
    effects.dispose();
  });

  it("lays a mark on its surface's plane, just nearer than it", () => {
    const mark: DecalItem = {
      kind: "decal",
      sortKey: 0,
      wx: 10,
      wy: 10,
      z: 5,
      receiverId: "deck",
      // z = 0.5·x + 0 · y + 0: a ramp rising east.
      plane: [0.5, 0, 0],
      polygons: [
        [
          { x: 8, y: 8, u: 0, v: 0 },
          { x: 12, y: 8, u: 1, v: 0 },
          { x: 12, y: 12, u: 1, v: 1 },
          { x: 8, y: 12, u: 0, v: 1 },
        ],
      ],
      mask: "ring",
      alpha: 0.2,
      color: "#b29c73",
    };
    const effects = new EffectQuads(new THREE.Group());
    effects.fill([mark, particle()], { x: 1, y: 0 });
    expect(effects.count).toBe(2);
    const geometry = effects.mesh.geometry;
    const position = geometry.getAttribute("position");
    for (const [i, x] of [8, 12, 12, 8].entries()) {
      expect(position.getX(i)).toBe(x);
      expect(position.getZ(i)).toBeCloseTo(x * 0.5 + MARK_LIFT, 6);
    }
    // Two triangles for the mark, two for the particle.
    expect(geometry.drawRange.count).toBe(12);
    // The ring's cell is the first quarter of the alpha map.
    const uv = geometry.getAttribute("uv");
    expect(uv.getX(1)).toBeLessThan(0.25);
    expect(uv.getX(4)).toBeGreaterThan(0.75);
    effects.dispose();
  });
});
