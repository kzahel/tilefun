import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import type { SpriteItem } from "../SceneItem.js";
import type { SharedMeshAssets } from "../View3dHost.js";
import { FirstPersonVehicles } from "./FirstPersonVehicles.js";

/** A host asset with a painted body and a contact disc, posed by no-op rig calls. */
function sharedAsset() {
  const stock = new THREE.Texture();
  const body = new THREE.MeshBasicMaterial({ map: stock });
  const object = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), body);
  const disc = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  disc.name = "Game-contact-shadow";
  object.add(mesh, disc);
  const rig = () => {};
  const asset = {
    object,
    setPhysical: rig,
    setTransportRamp: rig,
    setTowLift: rig,
    setTravel: rig,
    setDumpBed: rig,
    // The shared pose changes the asset's own material, as emergency lights do.
    setEmergency: (on: boolean) => body.color.setRGB(on ? 2 : 1, 1, 1),
  } as unknown as CarMeshAsset;
  return { asset, object, mesh, disc, body, stock };
}

function host(asset: CarMeshAsset | undefined, paint?: THREE.Texture): SharedMeshAssets {
  return {
    ready: new Set(asset ? ["car"] : []),
    asset: () => asset,
    paint: () => paint,
    bindPaint: () => () => {},
  };
}

const item = (emergencyEnabled = false) =>
  ({
    wx: 10,
    wy: 20,
    zOffset: 3,
    mesh: { assetId: "car", orientation: [0, 0, 0, 1], radius: 8, emergencyEnabled },
  }) as unknown as SpriteItem;

describe("first-person vehicles on the host's shared assets", () => {
  it("draws lit copies and leaves the shared materials as it found them", () => {
    const { asset, mesh, disc, body, stock } = sharedAsset();
    const shaded: THREE.Material[] = [];
    const vehicles = new FirstPersonVehicles((material) => shaded.push(material));
    const drawn: { material: THREE.Material; map: THREE.Texture | null; red: number }[] = [];
    const renderer = {
      render() {
        const material = mesh.material as THREE.MeshBasicMaterial;
        drawn.push({ material, map: material.map, red: material.color.r });
      },
    } as unknown as THREE.WebGLRenderer;
    const compile = body.onBeforeCompile;

    expect(vehicles.draw(renderer, new THREE.Camera(), host(asset), item())).toBe(true);
    expect(vehicles.draw(renderer, new THREE.Camera(), host(asset), item(true))).toBe(true);

    // One lit copy, shaded once, sharing the body's texture; the disc is untouched.
    expect(shaded).toHaveLength(1);
    expect(drawn[0]?.material).toBe(shaded[0]);
    expect(drawn[0]?.material).not.toBe(body);
    expect(drawn[0]?.map).toBe(stock);
    expect(disc.material).not.toBe(shaded[0]);
    // The copy follows what the shared pose set on the asset's own material.
    expect(drawn.map((d) => d.red)).toEqual([1, 2]);
    // The fixed view still compiles and draws the original material.
    expect(mesh.material).toBe(body);
    expect(body.onBeforeCompile).toBe(compile);
    expect(asset.object.parent).toBeNull();
  });

  it("draws nothing until the host's asset is ready", () => {
    const vehicles = new FirstPersonVehicles(() => {});
    const renderer = { render: () => expect.unreachable() } as unknown as THREE.WebGLRenderer;
    expect(vehicles.drawable(host(undefined), "car")).toBe(false);
    expect(vehicles.draw(renderer, new THREE.Camera(), host(undefined), item())).toBe(false);
  });

  it("follows a paint atlas bound to the shared material for the draw", () => {
    const { asset, mesh, body, stock } = sharedAsset();
    const paint = new THREE.Texture();
    const vehicles = new FirstPersonVehicles(() => {});
    let drawnMap: THREE.Texture | null = null;
    const renderer = {
      render() {
        drawnMap = (mesh.material as THREE.MeshBasicMaterial).map;
      },
    } as unknown as THREE.WebGLRenderer;
    const meshes: SharedMeshAssets = {
      ...host(asset),
      // The fixed view's binding: the atlas goes onto the asset's own material.
      bindPaint: (_object, texture) => {
        body.map = texture;
        return () => {
          body.map = stock;
        };
      },
    };
    // An unregistered asset ID has no paint scheme, so bind directly.
    const restore = meshes.bindPaint(asset.object, paint);
    vehicles.draw(renderer, new THREE.Camera(), meshes, item());
    restore();
    expect(drawnMap).toBe(paint);
    expect(body.map).toBe(stock);
  });
});
