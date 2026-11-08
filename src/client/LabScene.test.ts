import { beforeEach, expect, it, vi } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { followSeat, View } from "../session/View.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";

const draws = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("../session/ViewRender.js", () => ({
  renderViews: vi.fn((_host, views: View[], _terrain, draw: (view: View, i: number) => void) => {
    draws.order.push("views");
    draw(views[0] as View, 0);
  }),
  drawViewTerrain: vi.fn(() => draws.order.push("terrain")),
  drawViewScene: vi.fn(() => draws.order.push("scene")),
}));

import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import { drawLabFrame, type LabSceneOptions, labPresentationDiagnostics } from "./LabScene.js";

function host(assets: string[] = [], gpu?: { meshDraws: number; vehicleBedDraws: number }) {
  return {
    renderer: {
      assets: new Map(assets.map((key) => [key, {}])),
      getDiagnostics: () => ({ resident: 0, ...(gpu ? { gpu } : {}) }),
    },
    beginFrame: vi.fn(() => draws.order.push("frame")),
  } as unknown as RenderHost;
}
const device = new DeviceSession(new RemoteStateView(new World()));
const view = new View(followSeat());
const particles = new ParticleSystem();
const observer = createPlayer(4, 4);
const options = (extra: Partial<LabSceneOptions> = {}): LabSceneOptions => ({
  terrain: true,
  background: "#123456",
  pacing: "throughput",
  visibility: "upper",
  alpha: 0.25,
  fadeSeconds: 9,
  presentationTime: 3,
  pixelExactShadows: true,
  entities: [observer],
  collectObserver: observer,
  underlay: () => draws.order.push("underlay"),
  overlay: () => draws.order.push("overlay"),
  ...extra,
});
beforeEach(() => {
  draws.order.length = 0;
  vi.clearAllMocks();
});

it("draws one lab view: terrain, underlay, the device's scene with the view's fades, overlay", () => {
  const h = host(["grass-blades"]);
  drawLabFrame(h, view, device, particles, options());
  expect(draws.order).toEqual(["frame", "views", "terrain", "underlay", "scene", "overlay"]);
  const { replica } = device;
  expect(vi.mocked(renderViews).mock.calls[0]?.[2]).toEqual({
    world: replica.world,
    pacing: "throughput",
  });
  expect(vi.mocked(drawViewTerrain)).toHaveBeenCalledWith(h.renderer, view.camera, replica.world, {
    background: "#123456",
    pacing: "throughput",
    prepared: true,
  });
  expect(vi.mocked(drawViewScene)).toHaveBeenCalledWith(
    h.renderer,
    view.camera,
    device.frame,
    view.fades,
    {
      world: replica.world,
      props: replica.props,
      entities: [observer],
      collectObserver: observer,
      surfaceObserver: replica.playerEntity,
    },
    {
      alpha: 0.25,
      particles,
      grass: true,
      visibility: "upper",
      presentationTime: 3,
      fadeSeconds: 9,
      pixelExactShadows: true,
    },
  );
});

it("without terrain draws the background alone and no grass; a room presents its own slabs", () => {
  const h = host(["grass-blades"]);
  const room = { drawProps: new Set([7]), present: vi.fn() };
  drawLabFrame(h, view, device, particles, options({ terrain: false, room }));
  expect(vi.mocked(renderViews).mock.calls[0]?.[2]).toBeUndefined();
  expect(vi.mocked(drawViewTerrain).mock.calls[0]?.[2]).toBeUndefined();
  expect(vi.mocked(drawViewScene).mock.calls[0]?.[5]).toMatchObject({
    grass: false,
    drawProps: room.drawProps,
    present: room.present,
  });
  // Terrain without loaded grass blades draws no grass either.
  drawLabFrame(host(), view, device, particles, options());
  expect(vi.mocked(drawViewScene).mock.calls[1]?.[5]).toMatchObject({ grass: false });
});

it("reports backend mesh counts when the backend has them", () => {
  const gpu = labPresentationDiagnostics(
    host([], { meshDraws: 3, vehicleBedDraws: 2 }),
    device,
    particles,
  );
  expect(gpu).toMatchObject({ meshDraws: 3, bedMeshDraws: 2, playerGrounded: false });
  expect(labPresentationDiagnostics(undefined, device, particles)).toMatchObject({
    terrain: undefined,
    meshDraws: 0,
    bedMeshDraws: 0,
  });
});
