import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { vehiclePaintSchemes } from "../../traffic/VehiclePaint.js";
import { AUTHORED_VEHICLE_MESHES } from "../AuthoredVehicleMeshes.js";
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

  it("binds a painted vehicle's atlas for the draw and restores it afterwards", () => {
    // A registered vehicle with a paint scheme, so the draw itself asks for the atlas.
    const painted = AUTHORED_VEHICLE_MESHES.find((m) => vehiclePaintSchemes(m.vehicle).length);
    const scheme = painted && vehiclePaintSchemes(painted.vehicle)[0];
    if (!painted || !scheme) throw Error("No painted vehicle is registered");
    const { asset, mesh, body, stock } = sharedAsset();
    const paint = new THREE.Texture();
    const vehicles = new FirstPersonVehicles(() => {});
    const order: string[] = [];
    let drawnMap: THREE.Texture | null = null;
    const renderer = {
      render() {
        order.push("render");
        drawnMap = (mesh.material as THREE.MeshBasicMaterial).map;
      },
    } as unknown as THREE.WebGLRenderer;
    const meshes: SharedMeshAssets = {
      ...host(asset),
      paint: (asked) => (asked === scheme ? paint : undefined),
      // The fixed view's binding: the atlas goes onto the asset's own material.
      bindPaint: (object, texture) => {
        expect(object).toBe(asset.object);
        expect(mesh.material).toBe(body); // bound before the lit copies are swapped in
        order.push("bind");
        body.map = texture;
        return () => {
          order.push("restore");
          body.map = stock;
        };
      },
    };
    const car = {
      ...item(),
      mesh: { ...item().mesh, assetId: painted.assetId, paintSchemeId: scheme.id },
    } as unknown as SpriteItem;
    expect(vehicles.draw(renderer, new THREE.Camera(), meshes, car)).toBe(true);
    expect(order).toEqual(["bind", "render", "restore"]);
    expect(drawnMap).toBe(paint);
    expect(body.map).toBe(stock);
  });

  it("leaves the shared asset as it found it when a draw throws", () => {
    const painted = AUTHORED_VEHICLE_MESHES.find((m) => vehiclePaintSchemes(m.vehicle).length);
    const scheme = painted && vehiclePaintSchemes(painted.vehicle)[0];
    if (!painted || !scheme) throw Error("No painted vehicle is registered");
    const { asset, mesh, body, stock } = sharedAsset();
    const vehicles = new FirstPersonVehicles(() => {});
    const renderer = {
      render() {
        throw Error("context lost mid-draw");
      },
    } as unknown as THREE.WebGLRenderer;
    const meshes: SharedMeshAssets = {
      ...host(asset),
      paint: () => new THREE.Texture(),
      bindPaint: (_object, texture) => {
        body.map = texture;
        return () => {
          body.map = stock;
        };
      },
    };
    const car = {
      ...item(),
      mesh: { ...item().mesh, assetId: painted.assetId, paintSchemeId: scheme.id },
    } as unknown as SpriteItem;
    expect(() => vehicles.draw(renderer, new THREE.Camera(), meshes, car)).toThrow("mid-draw");
    // What the fixed view draws next: its own material, stock atlas, no parent.
    expect(mesh.material).toBe(body);
    expect(body.map).toBe(stock);
    expect(asset.object.parent).toBeNull();
  });
});
