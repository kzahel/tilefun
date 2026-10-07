import { expect, it } from "vitest";
import { spriteMetadata } from "../assets/SpriteCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import type { GameContext } from "../core/GameScene.js";
import type { EditorMode } from "../editor/EditorMode.js";
import { EditorModel } from "../editor/EditorModel.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { parseFloorPlan } from "../interiors/ApartmentFloorPlan.js";
import { createLayeredInteriorMap } from "../interiors/LayeredInteriorMap.js";
import { EditScene } from "../scenes/EditScene.js";
import { renderEntities, renderWorld } from "../scenes/renderWorld.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { SceneFrame } from "./SceneFrame.js";
import { RecordingBackend } from "./testing/RecordingBackend.js";

it("runs production outdoor/editor/indoor presentation on another backend without mutating simulation", () => {
  const assets = new Map(
    ["player", "grass-blades", "modern-interiors", "me-complete"].map((key) => [
      key,
      spriteMetadata(4096, 4096, 16, 16),
    ]),
  );
  const backend = new RecordingBackend(assets),
    other = new RecordingBackend(assets);
  const world = new World(),
    chunk = new Chunk();
  chunk.setHeight(3, 3, 1);
  chunk.autotileComputed = true;
  chunk.blendBase.fill(TerrainId.Grass);
  world.chunks.put(0, 0, chunk);
  const entities = [createPlayer(64, 64)],
    props = [createProp("prop-country-house", 120, 100)];
  const snapshot = () => structuredClone({ chunk, entities, props });
  const camera = new Camera();
  camera.pixelSnap = true;
  camera.zoom = 1 / 3;
  camera.snapTo(128, 128);
  camera.setViewport(256, 256);
  const editor = {
    cursorTileX: 3,
    cursorTileY: 4,
    cursorSubgridX: 6,
    cursorSubgridY: 8,
    cursorCornerX: 6,
    cursorCornerY: 8,
    getRoomPreview: () => null,
    getPatternPreview: () => null,
  } as unknown as EditorMode;
  const gc = {
    debugPanel: { terrainPacing: "throughput" },
    camera,
    renderer: backend,
    spriteCatalog: assets,
    sceneFrame: new SceneFrame(),
    editorMode: editor,
    editorModel: new EditorModel(),
    transport: {},
    console: { cvars: { get: () => undefined } },
    stateView: { world, entities, props, remoteCursors: [], interior: null },
  } as unknown as GameContext;
  Object.defineProperty(gc, "ctx", {
    get() {
      throw Error("presentation reached Canvas UI");
    },
  });
  const before = snapshot();
  renderWorld(gc);
  renderEntities(gc, 1, [
    { kind: "particle", sortKey: 80, wx: 80, wy: 80, color: "red", z: 0, size: 2, alpha: 1 },
  ]);
  expect(backend.passes.map((p) => p.kind)).toEqual(["clear", "terrain", "scene"]);
  expect(backend.views.every((view) => view.pixelSnap === true)).toBe(true);
  const scene = backend.passes.at(-1);
  if (scene?.kind !== "scene") throw Error("missing scene");
  expect(scene.items.map((i) => i.kind)).toContain("elevation");
  expect(scene.items.map((i) => i.kind)).toContain("sprite");
  expect(scene.items.map((i) => i.kind)).toContain("particle");
  expect(scene.items.map((i) => i.kind)).toContain("grass");
  expect(gc.sceneFrame.items).toEqual([]);
  const terrainId = backend.resourceId(chunk, 0, 0);
  const uploads = backend.uploads;
  camera.x += 2;
  renderWorld(gc);
  renderEntities(gc);
  expect(backend.uploads).toBe(uploads);
  expect(backend.resourceId(chunk, 0, 0)).toBe(terrainId);
  expect(backend.elevation.getDiagnostics().layoutBuilds).toBe(1);
  backend.passes.length = 0;
  new EditScene().render(1, gc);
  expect(backend.passes.map((p) => p.kind)).toEqual(["clear", "terrain", "overlay", "scene"]);
  expect(gc.sceneFrame.overlays.items).toEqual([]);
  expect(snapshot()).toEqual(before);
  other.prepareTerrain(camera, world, camera.getVisibleChunkRange());
  expect(other.resourceId(chunk, 0, 0)).not.toBe(terrainId);
  backend.invalidateAssets();
  renderWorld(gc);
  expect(backend.resourceId(chunk, 0, 0)).not.toBe(terrainId);
  expect(other.resourceId(chunk, 0, 0)).not.toBeNull();
  chunk.invalidateVisuals();
  renderWorld(gc);
  expect(backend.uploads).toBe(uploads + 2);
  const replacement = new Chunk();
  world.chunks.put(0, 0, replacement);
  renderWorld(gc);
  expect(backend.hasTerrain(chunk)).toBe(false);
  expect(backend.hasTerrain(replacement)).toBe(true);
  // Native room shell fixture goes through the actual indoor entry point.
  const plan = parseFloorPlan("####\n#LL#\n#LL#\n#+##"),
    map = createLayeredInteriorMap(8, 8);
  const state = gc.stateView as unknown as { interior: unknown; props: unknown[] };
  state.interior = { version: "interior-v1", floor: 0, buildingType: "prop-country-house" };
  state.props = [];
  editor.getRoomPreview = () =>
    ({ room: { map, plan, furnitureFloor: () => true, legacy: false } }) as unknown as ReturnType<
      EditorMode["getRoomPreview"]
    >;
  backend.passes.length = 0;
  renderEntities(gc);
  expect(backend.passes[0]?.kind).toBe("interior");
  const content = gc.sceneFrame.interior?.content;
  camera.y += 2;
  renderEntities(gc);
  expect(gc.sceneFrame.interior?.content).toBe(content);
  expect(backend.contents.size).toBe(1);
  expect(gc.sceneFrame.interior?.draws).toEqual([]);
  backend.recover();
  gc.sceneFrame.clear();
  expect(backend.getDiagnostics().resident).toBe(0);
  expect(backend.contents.size).toBe(0);
  renderEntities(gc);
  expect(backend.contents.size).toBe(1);
  backend.dispose();
  backend.dispose();
  expect(() => renderWorld(gc)).toThrow("disposed");
  expect(other.hasTerrain(chunk)).toBe(true);
});
