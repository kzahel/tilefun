import { describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { layoutViews } from "../rendering/ViewLayout.js";
import { createVehicle } from "../traffic/Vehicle.js";
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

  it("give a seat's 3D eye: its own eyes on foot, a chase camera when it drives (249)", () => {
    const player = { ...createPlayer(100, 200), id: 3 };
    const car = { ...createVehicle("compact-1", 100, 200, Direction.Right), id: 9 };
    const replica = {
      playerEntity: player,
      presentedPlayerEntity: player,
      entities: [player, car],
      setPredictor: vi.fn(),
    };
    const device = new DeviceSession(replica as unknown as RemoteStateView);
    const look = { yaw: 0, pitch: 0 }; // facing east
    const eye = followSeat().eye?.(device, look, 1);
    // On foot: at the player, above its feet, and its own body is not drawn.
    expect(eye).toMatchObject({ x: 100, y: 200, yaw: 0, own: 3 });
    expect(eye?.z).toBeGreaterThan(0);
    // Driving: behind and above the vehicle, looking down at it; the driver is drawn.
    player.parentId = car.id;
    const chase = followSeat().eye?.(device, look, 1);
    expect(chase?.own).toBeUndefined();
    expect(chase?.x).toBeLessThan(100);
    expect(chase?.pitch).toBeLessThan(0);
    // No body yet (the placeholder), and a fixed diagnostic camera has no eye.
    replica.presentedPlayerEntity = { ...player, id: -1 };
    expect(followSeat().eye?.(device, look, 1)).toBeUndefined();
    expect(fixedCamera({ wx: 0, wy: 0 }).eye).toBeUndefined();
  });

  it("a view's camera viewport is its region", () => {
    const view = new View(followSeat());
    view.setRegion({ x: 640, y: 0, width: 641, height: 800 });
    expect([view.camera.viewportWidth, view.camera.viewportHeight]).toEqual([641, 800]);
  });
});

describe("renderViews", () => {
  const world = new World();
  const views = layoutViews("4", 768, 512).map(({ region }) => {
    const v = new View(followSeat());
    v.setRegion(region);
    return v;
  });
  it("prepares the union of every view's interest once and shows UI only for undrawn views", () => {
    const backend = new RecordingBackend(new Map());
    const prepared: unknown[] = [];
    const prepare = vi.spyOn(backend, "prepareTerrainViews").mockImplementation((list) => {
      prepared.push(list.map(({ view, visible }) => ({ view, visible: { ...visible } })));
    });
    const host = { renderer: backend, beginView: vi.fn(), endView: vi.fn() };
    const drawn: number[] = [];
    const waiting: number[] = [];
    renderViews(
      host,
      views,
      { world, pacing: "throughput" },
      (_v, i) => waiting.push(i),
      (_v, i) => {
        drawn.push(i);
        return i % 2 === 1;
      },
    );
    expect(drawn).toEqual([0, 1, 2, 3]);
    expect(waiting).toEqual([0, 2]);
    expect(prepared).toEqual([
      views.map((view) => ({ view: view.camera, visible: view.interestRange() })),
    ]);
    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0]?.[0]).toHaveLength(0);
    expect(host.beginView).not.toHaveBeenCalled();
    expect(host.endView).not.toHaveBeenCalled();
  });
  it("does not prepare outdoor terrain indoors", () => {
    const backend = new RecordingBackend(new Map());
    const prepare = vi.spyOn(backend, "prepareTerrainViews");
    renderViews(
      { renderer: backend, beginView() {}, endView() {} },
      views,
      undefined,
      () => {},
      () => true,
    );
    expect(prepare).not.toHaveBeenCalled();
  });
  it("releases borrowed preparation even when it fails without changing cameras", () => {
    const backend = new RecordingBackend(new Map());
    const prepare = vi.spyOn(backend, "prepareTerrainViews").mockImplementationOnce(() => {
      throw Error("prepare");
    });
    const host = { renderer: backend, beginView() {}, endView() {} };
    expect(() =>
      renderViews(
        host,
        views,
        { world, pacing: "throughput" },
        () => {},
        () => true,
      ),
    ).toThrow("prepare");
    expect(prepare.mock.calls[0]?.[0]).toHaveLength(0);
    expect(views.every((v) => !v.camera.worldRaster)).toBe(true);
  });
});
