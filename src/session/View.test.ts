import { describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import type { RenderPass } from "../rendering/RenderFrame.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { layoutViews, type RenderRegion } from "../rendering/ViewLayout.js";
import { WorldRasterFrame } from "../rendering/WorldRasterFrame.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { DeviceSession } from "./DeviceSession.js";
import { fixedCamera, followSeat, View } from "./View.js";
import { renderViews } from "./ViewRender.js";

function session(player = { ...createPlayer(100, 200), id: 3 }) {
  const replica = {
    playerEntity: player,
    presentedPlayerEntity: player,
    cameraPresentation: { time: 0, domain: "remote" as const },
    setPredictor: vi.fn(),
  };
  return new DeviceSession(replica as unknown as RemoteStateView);
}

describe("camera policies", () => {
  it("follow seat 0, skipping a placeholder, optionally lifted by its height", () => {
    const device = session();
    const camera = new Camera();
    camera.snapTo(0, 0);
    const follow = followSeat();
    follow.tick(camera, device);
    expect(camera.x).toBeGreaterThan(0); // eased toward the player
    camera.snapTo(0, 0);
    device.replica.playerEntity.id = -1;
    follow.tick(camera, device);
    expect([camera.x, camera.y]).toEqual([0, 0]);
    // Presentation interpolates toward the presented body; vertical follow lifts it.
    device.replica.playerEntity.id = 3;
    device.replica.playerEntity.wz = 40;
    camera.snapTo(100, 200);
    followSeat().present(camera, device, 1);
    const flat = camera.y;
    camera.restoreActual();
    camera.snapTo(100, 200);
    followSeat({ verticalFollow: () => true }).present(camera, device, 1);
    expect(camera.y).toBeLessThan(flat);
    camera.restoreActual();
  });

  it("place a fixed camera on ticks and at the presented pose's alpha", () => {
    const device = session();
    const camera = new Camera();
    const framing = vi.fn((player: { position: { wx: number } }, alpha: number) => ({
      wx: player.position.wx + alpha,
      wy: -5,
    }));
    const policy = fixedCamera(framing);
    policy.tick(camera, device);
    expect([camera.x, camera.y]).toEqual([101, -5]);
    camera.savePrev();
    policy.present(camera, device, 0.25);
    expect(framing).toHaveBeenLastCalledWith(device.replica.presentedPlayerEntity, 0.25);
    expect([camera.x, camera.y]).toEqual([100.25, -5]);
    camera.restoreActual(); // back to the ticked placement
    expect([camera.x, camera.y]).toEqual([101, -5]);
    fixedCamera({ wx: 7, wy: 8 }).tick(camera, device);
    expect([camera.x, camera.y]).toEqual([7, 8]);
    // A fixed frame is placed before the step's input; following waits for prediction.
    expect([policy.beforeInput, followSeat().beforeInput]).toEqual([true, false]);
  });

  it("a view's camera viewport is its region", () => {
    const view = new View(followSeat());
    view.setRegion({ x: 640, y: 0, width: 641, height: 800 });
    expect([view.camera.viewportWidth, view.camera.viewportHeight]).toEqual([641, 800]);
  });
});

describe("renderViews", () => {
  const world = new World();
  for (let cy = -3; cy <= 3; cy++)
    for (let cx = -3; cx <= 3; cx++) world.chunks.put(cx, cy, new Chunk());
  const views = layoutViews("4", 768, 512).map(({ region }, i) => {
    const view = new View(followSeat());
    view.setRegion(region);
    view.camera.zoom = 1 / 3;
    view.camera.snapTo(i * 300 - 450, i * 200 - 300);
    return view;
  });

  it("prepares every view's world-frame range once, then draws each view in its region", () => {
    const backend = new RecordingBackend(new Map());
    const prepared: unknown[] = [];
    const prepare = vi.spyOn(backend, "prepareTerrainViews").mockImplementation((list) => {
      // The list is borrowed for the call only; copy what preparation saw.
      prepared.push(list.map(({ view, visible }) => ({ view, visible: { ...visible } })));
    });
    const opened: RenderRegion[] = [];
    let open = 0;
    const host = {
      renderer: backend,
      beginView: (camera: Camera, region: RenderRegion) => {
        expect(open++).toBe(0);
        expect(camera.worldRaster).toBe(false); // the host's own frame scope sets it
        opened.push(region);
      },
      endView: () => {
        open--;
      },
    };
    const drawn: number[] = [];
    renderViews(host, views, { world, pacing: "throughput" }, (view, i) => {
      expect(view).toBe(views[i]);
      drawn.push(i);
    });
    expect(drawn).toEqual([0, 1, 2, 3]);
    expect(opened).toEqual(views.map((v) => v.region));
    expect(prepare).toHaveBeenCalledTimes(1);
    const scope = new WorldRasterFrame();
    const expected = views.map(({ camera }) => {
      scope.begin(camera);
      const visible = camera.getVisibleChunkRange();
      scope.end();
      return { view: camera, visible };
    });
    expect(prepared).toEqual([expected]);
    expect(prepare.mock.calls[0]?.[0]).toHaveLength(0); // released after the call
    // Indoors (no terrain) nothing is prepared.
    renderViews(host, views.slice(0, 1), undefined, () => {});
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("ends a view whose drawing throws and leaves no camera in world scope", () => {
    const backend = new RecordingBackend(new Map());
    const end = vi.fn();
    const host = { renderer: backend, beginView: vi.fn(), endView: end };
    expect(() =>
      renderViews(host, views, { world, pacing: "throughput" }, (_view, i) => {
        if (i === 1) throw Error("lost");
      }),
    ).toThrow("lost");
    expect(end).toHaveBeenCalledTimes(2);
    expect(views.every((v) => !v.camera.worldRaster && !v.camera.pixelSnap)).toBe(true);
    // A range that cannot be read leaves no camera in world scope either.
    const camera = views[2]?.camera;
    if (!camera) throw Error("Missing view");
    vi.spyOn(camera, "getVisibleChunkRange").mockImplementationOnce(() => {
      throw Error("range");
    });
    expect(() => renderViews(host, views, { world, pacing: "throughput" }, () => {})).toThrow(
      "range",
    );
    expect(camera.worldRaster).toBe(false);
    // Preparation failing midway also releases the scope and the borrowed cameras.
    vi.spyOn(backend, "prepareTerrainViews").mockImplementationOnce(() => {
      throw Error("prepare");
    });
    expect(() => renderViews(host, views, { world, pacing: "throughput" }, () => {})).toThrow(
      "prepare",
    );
    const passes: RenderPass[] = [];
    backend.preparations = 0;
    renderViews(host, views.slice(0, 2), { world, pacing: "throughput" }, (view) =>
      backend.submit(view.camera, { kind: "clear", color: "#000" }),
    );
    passes.push(...backend.passes);
    expect(passes).toHaveLength(2);
    expect(backend.preparations).toBe(1);
  });
});
