import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { CarBodyImageCache, carBodyImageKey } from "./CarBodyImageCache.js";
import type { MeshInstance } from "./MeshPresentation.js";

const mesh: MeshInstance = { assetId: "car", orientation: [0, 0, 0, 1], radius: 80 };

it("invalidates every local rig/paint input, ignoring an inactive light clock", () => {
  const key = carBodyImageKey(mesh, 1);
  const changes: Partial<MeshInstance>[] = [
    { assetId: "other" },
    { radius: 81 },
    { orientation: [0, 0, 1, 0] },
    { wheelTravel: 1 },
    { bedTilt: 0.2 },
    { bedGateAngle: 0.3 },
    { towActive: true },
    { towPitch: 0.1 },
    { towOffsetX: 2 },
    { towOffsetZ: 3 },
  ];
  for (const change of changes) expect(carBodyImageKey({ ...mesh, ...change }, 1)).not.toBe(key);
  expect(carBodyImageKey(mesh, 2)).not.toBe(key);
  expect(carBodyImageKey({ ...mesh, presentationTime: 10 }, 1)).toBe(key);
  const paint = new THREE.Texture();
  const painted = carBodyImageKey(mesh, 1, paint);
  expect(painted).not.toBe(key);
  paint.needsUpdate = true;
  expect(carBodyImageKey(mesh, 1, paint)).not.toBe(painted);
  expect(carBodyImageKey(mesh, 1, new THREE.Texture())).not.toBe(painted);
});

it("admits recurring poses across frames and disposes on budget eviction, age and reset", () => {
  const cache = new CarBodyImageCache(8 * 8 * 4 * 2, 2);
  cache.beginFrame();
  expect(cache.get("a")).toBeUndefined();
  expect(cache.admit("a", 8)).toBeUndefined();
  expect(cache.get("a")).toBeUndefined(); // Same-frame duplicates do not admit moving fleets.
  cache.get("b");
  cache.get("c");
  cache.beginFrame();
  const a = cache.admit("a", 8);
  if (!a) throw Error("Expected admission");
  const disposeA = vi.spyOn(a, "dispose");
  cache.admit("b", 8);
  expect(cache.get("a")).toBe(a.texture); // a is now most recently used.
  const c = cache.admit("c", 8);
  if (!c) throw Error("Expected admission");
  const disposeC = vi.spyOn(c, "dispose");
  expect(cache.get("b")).toBeUndefined();
  expect(cache.bytes).toBe(512);
  expect(disposeA).not.toHaveBeenCalled();
  cache.clear();
  expect(disposeA).toHaveBeenCalledOnce();
  expect(disposeC).toHaveBeenCalledOnce();
  expect(cache.bytes).toBe(0);
  expect(cache.admit("a", 8)).toBeUndefined();
  cache.get("a");
  cache.beginFrame();
  const aged = cache.admit("a", 8);
  if (!aged) throw Error("Expected admission");
  const disposeAged = vi.spyOn(aged, "dispose");
  for (let frame = 0; frame < 121; frame++) cache.beginFrame();
  expect(disposeAged).toHaveBeenCalledOnce();
  expect(cache.size).toBe(0);
});
