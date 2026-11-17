import { describe, expect, it, vi } from "vitest";
import { spriteMetadata } from "../assets/SpriteCatalog.js";
import type { GameContext } from "../core/GameScene.js";
import type { EditorMode } from "../editor/EditorMode.js";
import { EditorModel } from "../editor/EditorModel.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import type { OverlayDraw } from "../rendering/OverlayFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { World } from "../world/World.js";
import { EditScene } from "./EditScene.js";

const drawn3d = vi.hoisted(() => ({ result: true, calls: 0 }));
vi.mock("./firstPersonPlay.js", () => ({
  renderFirstPerson: () => {
    drawn3d.calls++;
    return drawn3d.result;
  },
}));

function setup(topDown: boolean, look: object | null = null) {
  const backend = new RecordingBackend(new Map([["player", spriteMetadata(64, 64, 16, 16)]]));
  const camera = new Camera();
  camera.snapTo(128, 128);
  camera.setViewport(256, 256);
  const region = { x: 0, y: 0, width: 256, height: 256 };
  const view = {
    camera,
    fades: new Map(),
    region,
    look,
    interestRange: () => camera.getVisibleChunkRange(),
  };
  const entities = [createPlayer(64, 64)];
  const regions: number[] = [];
  const uiOverlays: OverlayDraw[][] = [];
  const gc = {
    debugPanel: { terrainPacing: "throughput" },
    camera,
    view,
    canvas: { width: 256, height: 256 },
    session: {
      views: [view],
      seats: { list: () => [{ seat: 0 }] },
      layoutViews: (width: number) => {
        regions.push(width);
        return [view];
      },
    },
    renderer: backend,
    spriteCatalog: backend.assets,
    sceneFrame: new SceneFrame(),
    editorMode: {
      cursorTileX: 3,
      cursorTileY: 4,
      getPatternPreview: () => null,
    } as unknown as EditorMode,
    editorModel: new EditorModel(),
    firstPerson: { topDown, sync: () => {} },
    beginView: () => {},
    endView: () => {},
    drawUiOverlay: (items: readonly OverlayDraw[]) => {
      uiOverlays.push(items.map((item) => ({ ...item })));
    },
    transport: {},
    console: { cvars: { get: () => undefined } },
    stateView: {
      world: new World(),
      entities,
      props: [],
      playerEntity: entities[0],
      playerNames: {},
      remoteCursors: [],
      interior: null,
    },
    ctx: {},
  } as unknown as GameContext;
  return { backend, gc, regions, uiOverlays };
}

describe("building mode", () => {
  it("draws in the unified top-down view with its overlays on the UI canvas", () => {
    drawn3d.result = true;
    drawn3d.calls = 0;
    const { backend, gc, regions, uiOverlays } = setup(true);
    new EditScene().render(1, gc);
    expect(drawn3d.calls).toBe(1);
    // Laid out for this canvas, as play lays its views out.
    expect(regions).toEqual([256]);
    // No fixed view: only the overlays, drawn above the 3D view.
    expect(backend.passes.map((p) => p.kind)).toEqual([]);
    expect(uiOverlays).toHaveLength(1);
    expect(uiOverlays[0]?.some((item) => item.kind === "rect")).toBe(true);
    expect(gc.sceneFrame.overlays.items).toEqual([]);
  });

  it("uses top-down drawing while a seat has a first-person look", () => {
    drawn3d.result = true;
    drawn3d.calls = 0;
    const { backend, gc, uiOverlays } = setup(true, { yaw: 0, pitch: 0 });
    new EditScene().render(1, gc);
    expect(drawn3d.calls).toBe(1);
    expect(backend.passes).toEqual([]);
    expect(uiOverlays).toHaveLength(1);
    expect(gc.view.look).toEqual({ yaw: 0, pitch: 0 });
  });
});
