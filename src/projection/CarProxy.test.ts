import { expect, it } from "vitest";
import bank from "../traffic/vehicles-v1.json" with { type: "json" };
import { CAR_PROXY, carProxyPatches, liftSource, projectSource, sourceUV } from "./CarProxy.js";

it("keeps texture registration fixed as proxy depth changes", () => {
  for (const pixel of [
    [0, 24],
    [32, 42],
    [64, 64],
  ] as const)
    for (const depth of [-10, 0, 11]) {
      const point = liftSource(pixel, depth);
      expect(projectSource(point)).toEqual(pixel);
      expect(sourceUV(point)).toEqual([pixel[0] / 64, 1 - (pixel[1] - 24) / 40]);
    }
});
it("connects finite nondegenerate proxy patches and explicitly labels unseen surfaces", () => {
  const patches = carProxyPatches();
  expect(patches.filter((p) => p.textured)).toHaveLength(8);
  expect(patches.filter((p) => !p.textured)).toHaveLength(10);
  for (const patch of patches) {
    expect(patch.vertices).toHaveLength(4);
    expect(patch.vertices.flat().every(Number.isFinite)).toBe(true);
    const [a, b, c] = patch.vertices;
    if (!a || !b || !c) throw Error("missing vertices");
    const u = b.map((v, i) => v - (a[i] ?? 0)),
      v = c.map((v, i) => v - (a[i] ?? 0));
    const area = Math.hypot(
      (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
      (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
      (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
    );
    expect(area).toBeGreaterThan(0);
    if (patch.textured)
      for (const vertex of patch.vertices)
        expect(sourceUV(vertex).every((n) => n >= 0 && n <= 1)).toBe(true);
  }
  // Every shell edge is shared twice: texture seams cannot conceal open geometry.
  const edges = new Map<string, number>();
  for (const p of patches)
    for (let i = 0; i < 4; i++) {
      const edge = [JSON.stringify(p.vertices[i]), JSON.stringify(p.vertices[(i + 1) % 4])]
        .sort()
        .join("|");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  expect([...edges.values()].every((n) => n === 2)).toBe(true);
});
it("uses exact approved collision dimensions without promoting the fitted mesh", () => {
  const view = bank.views.find((v) => v.id === CAR_PROXY.sourceView),
    c = view?.metadata.colliders[0];
  expect(CAR_PROXY.collision).toEqual({ width: c?.width, depth: c?.height, height: c?.zHeight });
  expect(CAR_PROXY.sourceFingerprint).toBe(bank.sourceFingerprint);
  expect(CAR_PROXY.rect).toEqual([96, 1176, 64, 40]);
  expect(CAR_PROXY.collision).toEqual({ width: 56, depth: 20, height: 24 });
});
