import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { vehiclePaint } from "../traffic/VehiclePaint.js";
import { VehiclePaintResources } from "./VehiclePaintResources.js";

it("shares lazy textures, publishes at frame boundaries and cleans up late loads", async () => {
  const texture = new THREE.Texture();
  const dispose = vi.spyOn(texture, "dispose");
  let finish: ((texture: THREE.Texture) => void) | undefined;
  const loader = vi.fn(
    () =>
      new Promise<THREE.Texture>((resolve) => {
        finish = resolve;
      }),
  );
  const cache = new VehiclePaintResources(loader);
  const paint = required(vehiclePaint("beetle", "teal"));
  expect(cache.request(paint)).toBeUndefined();
  expect(cache.request(paint)).toBeUndefined();
  expect(loader).toHaveBeenCalledTimes(1);
  required(finish)(texture);
  await Promise.resolve();
  expect(cache.request(paint)).toBeUndefined();
  cache.beginFrame();
  expect(cache.request(paint)).toBe(texture);
  cache.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(cache.request(paint)).toBeUndefined();
  const late = new VehiclePaintResources(loader);
  late.request(paint);
  late.dispose();
  const lateTexture = new THREE.Texture();
  const lateDispose = vi.spyOn(lateTexture, "dispose");
  required(finish)(lateTexture);
  await Promise.resolve();
  expect(lateDispose).toHaveBeenCalledTimes(1);
});

it("binds and resets shared materials without cloning geometry or touching shadows", () => {
  const original = new THREE.Texture(),
    red = new THREE.Texture(),
    green = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: original });
  const geometry = new THREE.BoxGeometry();
  const group = new THREE.Group();
  const body = new THREE.Mesh(geometry, material);
  const wheel = new THREE.Mesh(geometry, material);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  group.add(body, wheel, shadow);
  const cache = new VehiclePaintResources();
  for (const paint of [red, green, red]) {
    const reset = cache.bind(group, paint);
    expect(body.material.map).toBe(paint);
    expect(wheel.material.map).toBe(paint);
    expect(shadow.material.map).toBe(null);
    expect(body.geometry).toBe(geometry);
    expect(wheel.geometry).toBe(geometry);
    reset();
    expect(material.map).toBe(original);
  }
  cache.dispose();
  geometry.dispose();
  shadow.geometry.dispose();
  material.dispose();
  shadow.material.dispose();
});

it("keeps failed atlas loads failed until resource teardown", async () => {
  const loader = vi.fn(async () => {
    throw Error("missing atlas");
  });
  const cache = new VehiclePaintResources(loader);
  const paint = required(vehiclePaint("pickup", "cherry"));
  cache.request(paint);
  await Promise.resolve();
  cache.beginFrame();
  expect(cache.request(paint)).toBeUndefined();
  expect(loader).toHaveBeenCalledTimes(1);
  expect(cache.states[paint.atlas]?.state).toBe("failed");
  cache.dispose();
});
