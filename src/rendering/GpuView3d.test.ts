import { describe, expect, it } from "vitest";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import { createView3dHost } from "./GpuView3d.js";

/** A renderer that records the state calls the fixed view depends on. */
function fixture() {
  const calls: string[] = [];
  const worldTarget = { name: "world" };
  let target: unknown = worldTarget;
  const renderer = {
    getRenderTarget: () => target,
    setRenderTarget(next: unknown) {
      target = next;
      calls.push(`target ${next === null ? "canvas" : "world"}`);
    },
    getClearAlpha: () => 0,
    getClearColor: (out: { set(hex: number): void }) => out.set(0x000000),
    setClearColor: (_color: unknown, alpha: number) => calls.push(`clear ${alpha}`),
    setViewport: (...v: number[]) => calls.push(`viewport ${v.join(",")}`),
    setScissor: (...v: number[]) => calls.push(`scissor ${v.join(",")}`),
    setScissorTest: (on: boolean) => calls.push(`scissorTest ${on}`),
  };
  const surface = {
    disposed: false,
    lost: false,
    stats: { recoveries: 3 },
    canvas: { width: 1280, height: 800 },
    renderer,
    flush: () => calls.push("flush"),
  };
  const bodies = { ready: new Set<string>(), paints: {} };
  const host = createView3dHost(
    surface as unknown as GpuRasterSurface,
    bodies as unknown as GpuMeshBodies,
  );
  return { host, calls, surface, target: () => target, worldTarget };
}

const restored = [
  "target canvas",
  "scissorTest false",
  "viewport 0,0,1280,800",
  "clear 0",
  "target world",
];

describe("3D views on the fixed view's renderer (249)", () => {
  it("binds the region with GL rows from the bottom, then restores the host's state", () => {
    const { host, calls, target, worldTarget } = fixture();
    const drawn = host.draw({ x: 640, y: 100, width: 640, height: 300 }, (view) => {
      calls.push(`draw ${view.width}x${view.height} generation ${view.generation}`);
    });
    expect(drawn).toBe(true);
    expect(calls).toEqual([
      "flush", // the fixed view's queued quads first
      "target canvas",
      "viewport 640,400,640,300",
      "scissor 640,400,640,300",
      "scissorTest true",
      "draw 640x300 generation 3",
      ...restored,
    ]);
    expect(target()).toBe(worldTarget);
  });

  it("draws the whole canvas without a region", () => {
    const { host, calls } = fixture();
    host.draw(undefined, () => {});
    expect(calls).toContain("viewport 0,0,1280,800");
  });

  it("restores the host's state when the view's draw throws", () => {
    const { host, calls, target, worldTarget } = fixture();
    expect(() =>
      host.draw(undefined, () => {
        throw Error("scene failed");
      }),
    ).toThrow("scene failed");
    expect(calls.slice(-restored.length)).toEqual(restored);
    expect(target()).toBe(worldTarget);
  });

  it("refuses, touching nothing, while graphics are lost or for a masked region", () => {
    const lost = fixture();
    lost.surface.lost = true;
    expect(lost.host.draw(undefined, () => expect.unreachable())).toBe(false);
    expect(lost.calls).toEqual([]);
    const masked = fixture();
    const region = { x: 0, y: 0, width: 1280, height: 800, mask: [1, 1, 0] as const };
    expect(masked.host.draw(region, () => expect.unreachable())).toBe(false);
    expect(masked.calls).toEqual([]);
    const gone = fixture();
    gone.surface.disposed = true;
    expect(gone.host.draw(undefined, () => expect.unreachable())).toBe(false);
  });
});
