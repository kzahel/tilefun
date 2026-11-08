import { expect, it, vi } from "vitest";
import { spriteMetadata } from "../assets/SpriteCatalog.js";
import type { GameContext } from "../core/GameScene.js";
import { createPlayer } from "../entities/Player.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { followSeat, View } from "../session/View.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { renderPlayViews } from "./renderWorld.js";

function context(graphics: boolean) {
  const assets = new Map([["player", spriteMetadata(64, 64, 16, 16)]]);
  const backend = new RecordingBackend(assets);
  const world = new World();
  for (let cy = -2; cy <= 2; cy++)
    for (let cx = -2; cx <= 2; cx++) world.chunks.put(cx, cy, new Chunk());
  const player = createPlayer(0, 0);
  const view = new View(followSeat());
  view.setRegion({ x: 0, y: 0, width: 512, height: 384 });
  view.camera.zoom = 1 / 3;
  const beginView = vi.fn();
  const endView = vi.fn();
  const gc = {
    debugPanel: { terrainPacing: "throughput" },
    camera: view.camera,
    view,
    session: { views: [view] },
    renderer: backend,
    spriteCatalog: assets,
    sceneFrame: new SceneFrame(),
    time: { presentationSeconds: 0 },
    stateView: { world, entities: [player], props: [], playerEntity: player, interior: null },
    ...(graphics ? { beginView, endView } : {}),
  } as unknown as GameContext;
  return { gc, backend, view, beginView, endView };
}

it("draws play through the view frame: one terrain preparation, then the view's passes", () => {
  const { gc, backend, view, beginView, endView } = context(true);
  renderPlayViews(gc, 1, []);
  expect(backend.preparations).toBe(1);
  expect(beginView).toHaveBeenCalledWith(view.camera, view.region);
  expect(endView).toHaveBeenCalledTimes(1);
  expect(backend.passes.map((p) => p.kind)).toEqual(["clear", "terrain", "scene"]);
});

it("headless fixtures without graphics still prepare and draw seat 0's view", () => {
  const { gc, backend } = context(false);
  renderPlayViews(gc, 1, []);
  expect(backend.preparations).toBe(1);
  expect(backend.passes.map((p) => p.kind)).toEqual(["clear", "terrain", "scene"]);
});
