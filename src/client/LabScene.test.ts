import { expect, it, vi } from "vitest";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { followSeat, View } from "../session/View.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { drawLabFrame, labPresentationDiagnostics } from "./LabScene.js";

it("prepares one lab's terrain and invokes its unified draw without fixed passes", () => {
  const view = new View(followSeat());
  view.setRegion({ x: 0, y: 0, width: 320, height: 240 });
  const device = new DeviceSession(new RemoteStateView(new World()));
  const prepare = vi.fn();
  const submit = vi.fn();
  const beginFrame = vi.fn();
  const host = {
    renderer: { prepareTerrainViews: prepare, submit },
    beginFrame,
  } as unknown as RenderHost;
  const draw3d = vi.fn(() => true);
  drawLabFrame(host, view, device.replica.world, "throughput", draw3d);
  expect(beginFrame).toHaveBeenCalledOnce();
  expect(draw3d).toHaveBeenCalledWith(view, 0);
  expect(prepare).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});

it("reports shared mesh resources without assuming a graphics host", () => {
  const device = new DeviceSession(new RemoteStateView(new World()));
  expect(labPresentationDiagnostics(undefined, device, new ParticleSystem())).toMatchObject({
    terrain: undefined,
    meshDraws: 0,
    bedMeshDraws: 0,
  });
});
