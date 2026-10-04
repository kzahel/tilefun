import { describe, expect, it } from "vitest";
import type { GameContext } from "../core/GameScene.js";
import { createPlayer } from "../entities/Player.js";
import { renderEntities, renderWorld } from "../scenes/renderWorld.js";
import { Camera } from "./Camera.js";
import { collectSceneOrder, type RenderBackend, type RenderPass } from "./RenderFrame.js";
import { SceneFrame } from "./SceneFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";

describe("backend-independent frame submission", () => {
  it("specifies ground shadows before the scene and elevated shadows immediately before their sprite", () => {
    const sprite = (terrain: number, hidden = false) =>
      ({
        kind: "sprite",
        hasShadow: true,
        flashHidden: hidden,
        shadowTerrainZ: terrain,
      }) as SpriteItem;
    const items: SceneItem[] = [
      sprite(0),
      sprite(16),
      sprite(0, true),
      { kind: "particle" } as SceneItem,
      sprite(0),
    ];
    const order: number[] = [999];
    expect(collectSceneOrder(items, order)).toBe(order);
    expect(order).toEqual([-1, -5, 0, -2, 1, 2, 3, 4]);
    expect(collectSceneOrder([], order)).toEqual([]);
  });

  it("runs real outdoor orchestration without Canvas and releases borrowed state even if submission fails", () => {
    const camera = new Camera();
    camera.setViewport(256, 256);
    const frame = new SceneFrame();
    const passes: string[] = [];
    let fail = false;
    const assets = new Map([
      ["player", { width: 16, height: 16, tileWidth: 16, tileHeight: 16, cols: 1, rows: 1 }],
    ]);
    const renderer: RenderBackend = {
      assets,
      isTerrainReady() {
        return true;
      },
      hasTerrain() {
        return true;
      },
      releaseChunk() {},
      getDiagnostics() {
        return {
          resident: 0,
          schedulerRecordsCreated: 0,
          queuedJobs: 0,
          building: 0,
          pending: 0,
          oldestMs: 0,
          rowsLastFrame: 0,
          surfaceBytes: 0,
        };
      },
      resize() {},
      invalidateAssets() {},
      recover() {},
      dispose() {},
      prepareInterior() {},
      prepareTerrain() {
        passes.push("prepare");
      },
      collectTerrain() {
        return [];
      },
      collectElevationItems() {
        return [];
      },
      clear() {},
      submit(_view, pass: RenderPass) {
        passes.push(pass.kind);
        expect(JSON.stringify(pass)).not.toContain("canvas");
        if (pass.kind === "scene") {
          expect(pass.items.some((i) => i.kind === "sprite")).toBe(true);
          expect(pass.order.length).toBeGreaterThan(0);
          if (fail) throw Error("device lost");
        }
      },
    };
    const gc = {
      debugPanel: { terrainPacing: "throughput" },
      camera,
      renderer,
      spriteCatalog: assets,
      sceneFrame: frame,
      console: { cvars: { get: () => undefined } },
      stateView: {
        entities: [createPlayer(0, 0)],
        props: [],
        world: { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 },
      },
    } as unknown as GameContext;
    renderWorld(gc);
    renderEntities(gc);
    expect(passes).toEqual(["clear", "prepare", "terrain", "scene"]);
    expect(frame.items).toEqual([]);
    expect(frame.drawOrder).toEqual([]);
    fail = true;
    expect(() => renderEntities(gc)).toThrow("device lost");
    expect(frame.items).toEqual([]);
    expect(frame.drawOrder).toEqual([]);
  });
});
