import { afterEach, expect, it, vi } from "vitest";
import type { GameLoop } from "../core/GameLoop.js";
import { XRSessionManager } from "./XRSessionManager.js";

afterEach(() => vi.unstubAllGlobals());

it("uploads the composed frame after the XR tick and restores the normal loop on exit", async () => {
  const canvas = { width: 640, height: 480, style: { visibility: "visible" } };
  const composed = { width: 640, height: 480 };
  const upload = vi.fn();
  const gl = new Proxy(
    { texImage2D: upload },
    {
      get(target, key) {
        if (key === "texImage2D") return target.texImage2D;
        return typeof key === "string" && key === key.toUpperCase() ? 1 : vi.fn(() => ({}));
      },
    },
  );
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => gl }) });
  let draw: XRFrameRequestCallback | undefined;
  let end: (() => void) | undefined;
  const session = {
    inputSources: [],
    requestReferenceSpace: async () => ({}),
    updateRenderState: vi.fn(),
    requestAnimationFrame: (callback: XRFrameRequestCallback) => {
      draw = callback;
      return 1;
    },
    addEventListener: (event: string, callback: () => void) => {
      if (event === "end") end = callback;
    },
    end: async () => end?.(),
  };
  vi.stubGlobal("navigator", { xr: { requestSession: async () => session } });
  vi.stubGlobal("XRRigidTransform", class {});
  vi.stubGlobal(
    "XRWebGLBinding",
    class {
      createQuadLayer() {
        return {};
      }
      getSubImage() {
        return { colorTexture: {}, viewport: { x: 0, y: 0, width: 640, height: 480 } };
      }
    },
  );
  const loop = { stop: vi.fn(), start: vi.fn(), externalTick: vi.fn() };
  const source = vi.fn(() => {
    expect(loop.externalTick).toHaveBeenCalledWith(100);
    return composed as HTMLCanvasElement;
  });
  const manager = new XRSessionManager();
  await manager.enterVR(canvas as HTMLCanvasElement, loop as unknown as GameLoop, source);
  expect(loop.stop).toHaveBeenCalledOnce();
  expect(canvas.style.visibility).toBe("hidden");
  draw?.(100, {} as XRFrame);
  expect(source).toHaveBeenCalledOnce();
  expect(upload.mock.calls[0]?.at(-1)).toBe(composed);
  manager.exitVR();
  expect(loop.start).toHaveBeenCalledOnce();
  expect(canvas.style.visibility).toBe("visible");
  expect(manager.active).toBe(false);
});
