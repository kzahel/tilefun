import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpriteCatalog } from "../assets/SpriteCatalog.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import type { GameContext } from "../core/GameScene.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { CanvasRenderBackend } from "../rendering/CanvasRenderBackend.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import type { SpriteItem } from "../rendering/SceneItem.js";
import { renderInterior } from "../scenes/renderInterior.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { InteriorPresentation } from "./InteriorPresentation.js";
import { createLayeredInteriorMap } from "./LayeredInteriorMap.js";

afterEach(() => vi.unstubAllGlobals());
const plan = parseFloorPlan("####\n#LL#\n#LL#\n#+##");
function room() {
  const map = createLayeredInteriorMap(8, 8);
  map.contentOffsetY = 8;
  const cell = map.cells[2]?.[0];
  if (cell) cell.wall.push({ key: "fixture-wall" });
  return new InteriorPresentation(map, plan, () => true, true);
}
const actor = (depth: number): SpriteItem => ({
  kind: "sprite",
  sortKey: depth,
  wx: 32,
  wy: depth,
  zOffset: 0,
  sheetKey: "player",
  frameCol: 0,
  frameRow: 0,
  spriteWidth: 16,
  spriteHeight: 16,
  flipX: false,
  drawOffsetY: 0,
  hasShadow: true,
  shadowFeetWy: depth,
  shadowWidth: 10,
  shadowTerrainZ: 0,
  flashHidden: false,
});

describe("neutral interior frames", () => {
  it("preserves wall ties and inline shadows, reuses actor records, and releases scene references", () => {
    const r = room(),
      player = actor(64);
    const draws = r.collect([], [player]);
    expect(draws.map((d) => d.kind)).toEqual(["layer", "layer", "scene", "scene", "wall-band"]);
    expect(draws[2]).toMatchObject({ shadow: true, item: player, offsetY: 8 });
    expect(draws[3]).toMatchObject({ shadow: false, item: player });
    expect(draws[4]).toMatchObject({ row: 2, y: 24 });
    const body = draws[3];
    r.release();
    expect(draws).toEqual([]);
    expect(body).toMatchObject({ item: null });
    expect(r.collect([], [player])[3]).toBe(body);
    player.sortKey = 65;
    expect(r.collect([], [player]).map((d) => d.kind)).toEqual([
      "layer",
      "layer",
      "wall-band",
      "scene",
      "scene",
    ]);
    expect(room().content.id).not.toBe(r.content.id);
  });

  it("runs the real indoor entry point with a recording backend and client-owned room state", () => {
    const model = room();
    const assets = new Map([
      [
        "modern-interiors",
        { width: 16, height: 16, tileWidth: 16, tileHeight: 16, cols: 1, rows: 1 },
      ],
    ]);
    let prepared = 0,
      submissions = 0;
    const renderer: RenderBackend = {
      assets,
      prepareTerrain() {},
      collectTerrain() {
        return [];
      },
      collectElevationItems() {
        return [];
      },
      clear() {},
      prepareInterior(content) {
        prepared = content.id;
      },
      submit(_view, pass) {
        expect(pass.kind).toBe("interior");
        if (pass.kind !== "interior") return;
        expect(pass.contentId).toBe(prepared);
        expect(pass.draws.some((d) => d.kind === "scene")).toBe(true);
        submissions++;
      },
    };
    const camera = new Camera();
    camera.setViewport(256, 256);
    const make = () =>
      ({
        camera,
        renderer,
        spriteCatalog: assets,
        sceneFrame: new SceneFrame(),
        editorMode: {
          getRoomPreview: () => ({
            room: { map: model.content.map, plan, furnitureFloor: () => true, legacy: false },
          }),
        },
        stateView: {
          interior: { version: "interior-v1", floor: 0, buildingType: "prop-country-house" },
          entities: [createPlayer(32, 32)],
          props: [],
          world: { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 },
        },
      }) as unknown as GameContext;
    const first = make(),
      second = make();
    renderInterior(first, 1, []);
    const firstId = prepared;
    renderInterior(first, 1, []);
    expect(prepared).toBe(firstId);
    renderInterior(second, 1, []);
    expect(prepared).not.toBe(firstId);
    expect(submissions).toBe(3);
    expect(first.sceneFrame.interior?.draws).toEqual([]);
    expect(first.sceneFrame.items).toEqual([]);
    first.sceneFrame.clear();
    expect(first.sceneFrame.interior).toBeNull();
  });

  it("keeps room resources per backend, reuses static content and rejects stale submissions after reset", () => {
    let surfaces = 0;
    vi.stubGlobal("document", {
      createElement: () => {
        surfaces++;
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            save() {},
            restore() {},
            translate() {},
            clearRect() {},
            drawImage() {},
          }),
        };
      },
    });
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const sheets = new Map([
      ["modern-interiors", new Spritesheet({ width: 16, height: 16 } as HTMLCanvasElement, 16, 16)],
    ]);
    expect(createSpriteCatalog(sheets).size).toBe(1);
    const a = new CanvasRenderBackend(ctx, sheets),
      b = new CanvasRenderBackend(ctx, sheets);
    // Empty shell isolates resource ownership from atlas loading/raster rules.
    const r = new InteriorPresentation(createLayeredInteriorMap(2, 2), plan, undefined, true);
    const camera = new Camera();
    camera.setViewport(100, 100);
    a.prepareInterior(r.content);
    const firstCount = surfaces;
    a.prepareInterior(r.content);
    expect(surfaces).toBe(firstCount);
    b.prepareInterior(r.content);
    expect(surfaces).toBe(firstCount * 2);
    const pass = { kind: "interior" as const, contentId: r.content.id, draws: r.collect([], []) };
    a.clear();
    a.submit(camera, pass);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    b.submit(camera, pass);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    b.setAssets(sheets);
    vi.mocked(ctx.drawImage).mockClear();
    b.submit(camera, pass);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    b.prepareInterior(r.content);
    expect(surfaces).toBe(firstCount * 3);
    b.submit(camera, pass);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });
});
