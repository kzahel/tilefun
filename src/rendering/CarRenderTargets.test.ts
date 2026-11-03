import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { CarRenderTargets } from "./CarRenderTargets.js";

it("reuses both exact-size color/depth targets across alternating moving-body sizes", () => {
  const pool = new CarRenderTargets();
  pool.beginFrame();
  const a = pool.get(128),
    b = pool.get(192);
  for (let i = 0; i < 100; i++) {
    pool.beginFrame();
    expect(pool.get(128)).toBe(a);
    expect(pool.get(192)).toBe(b);
  }
  expect([a.source.width, a.outline.width, b.source.width, b.outline.width]).toEqual([
    128, 128, 192, 192,
  ]);
  expect(a.source.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(a.outline.depthTexture?.type).toBe(THREE.UnsignedIntType);
  expect(pool.diagnostics.creates).toBe(2);
  expect(pool.bytes).toBe((128 * 128 + 192 * 192) * 16);
  pool.clear();
});
it("enforces byte/entry LRU bounds and disposes both attachments on eviction, age and reset", () => {
  const pool = new CarRenderTargets(32 * 32 * 16 * 2, 2);
  const a = pool.get(32),
    b = pool.get(16),
    disposeA = vi.spyOn(a.source, "dispose"),
    disposeOutline = vi.spyOn(a.outline, "dispose");
  pool.get(16);
  pool.get(24);
  expect(disposeA).toHaveBeenCalledOnce();
  expect(disposeOutline).toHaveBeenCalledOnce();
  expect(pool.get(16)).toBe(b);
  expect(pool.diagnostics.pairs).toBe(2);
  for (let i = 0; i < 121; i++) pool.beginFrame();
  expect(pool.bytes).toBe(0);
  expect(pool.diagnostics.pairs).toBe(0);
  const c = pool.get(32),
    disposeC = vi.spyOn(c.outline, "dispose");
  pool.clear();
  expect(disposeC).toHaveBeenCalledOnce();
  expect(() => pool.get(1024)).toThrow("budget");
});
