import { expect, it, vi } from "vitest";
import { type SpriteImage, Spritesheet } from "../assets/Spritesheet.js";
import { Camera } from "./Camera.js";
import { drawSceneEntry2D } from "./Canvas2DRenderer.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

it("keeps a roof rider on its fitted body only while that exact mesh is drawable", () => {
  const drawImage = vi.fn();
  const ready = new Set<string>();
  const surface = {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage,
    meshReady: ready,
  } as unknown as RasterSurface;
  const sheet = new Spritesheet({ width: 32, height: 32 } as SpriteImage, 32, 32);
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.setViewport(300, 200);
  const rider: SpriteItem = {
    kind: "sprite",
    sortKey: 0,
    wx: 0,
    wy: 0,
    zOffset: 24,
    sheetKey: "rider",
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 32,
    spriteHeight: 32,
    flipX: false,
    drawOffsetY: 0,
    hasShadow: false,
    shadowFeetWy: 0,
    shadowWidth: 0,
    shadowTerrainZ: 0,
    flashHidden: false,
    meshRoofSupport: { assetId: "compact-1-authored-v7", heightDelta: 9 },
  };
  const before = structuredClone(rider);
  const sheets = new Map([["rider", sheet]]);
  const draw = () => {
    drawSceneEntry2D(surface, camera, rider, sheets, undefined);
    return drawImage.mock.lastCall?.[6];
  };
  const fallback = draw();
  ready.add("another-model");
  expect(draw()).toBe(fallback);
  ready.add("compact-1-authored-v7");
  expect(draw()).toBe(Number(fallback) + 9);
  ready.clear(); // Disabled/failed/recovered resources use their original sprite.
  expect(draw()).toBe(fallback);
  expect(rider).toEqual(before);
});

it("requires both the roof mesh and its carrier before applying inherited XY/Z offsets", () => {
  const drawImage = vi.fn();
  const ready = new Set<string>();
  const surface = {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage,
    meshReady: ready,
  } as unknown as RasterSurface;
  const camera = new Camera();
  camera.zoom = 1 / 3;
  const rider = {
    kind: "sprite",
    wx: 0,
    wy: 0,
    zOffset: 48,
    sheetKey: "rider",
    spriteWidth: 32,
    spriteHeight: 32,
    frameCol: 0,
    frameRow: 0,
    drawOffsetY: 0,
    meshRoofSupport: {
      assetId: "compact-1-authored-v7",
      ownerAssetId: "car-transporter-authored-v2",
      heightDelta: 8,
      offsetX: -3,
      offsetY: 4,
    },
  } as SpriteItem;
  const sheets = new Map([
    ["rider", new Spritesheet({ width: 32, height: 32 } as SpriteImage, 32, 32)],
  ]);
  const draw = () => {
    drawSceneEntry2D(surface, camera, rider, sheets, undefined);
    return [drawImage.mock.lastCall?.[5], drawImage.mock.lastCall?.[6]];
  };
  const fallback = draw();
  ready.add("compact-1-authored-v7");
  expect(draw()).toEqual(fallback);
  ready.add("car-transporter-authored-v2");
  expect(draw()).toEqual([Number(fallback[0]) - 3, Number(fallback[1]) + 12]);
  ready.delete("compact-1-authored-v7");
  expect(draw()).toEqual(fallback);
});
