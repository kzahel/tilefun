import { describe, expect, it } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import { createView3dHost, GROUND_UPLOADS_PER_VIEW } from "./GpuView3d.js";

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
    pages: {
      atlas: { texture: { name: "atlas" } },
      pages: new Map<object, { region: object | null }[]>(),
      full: false,
      imageSize: () => ({ width: 2816, height: 8224 }),
      get(image: object, x: number, y: number, size: { width: number; height: number }) {
        let page = this.pages.get(image)?.[0];
        if (!page) {
          calls.push(`upload ${x},${y} ${size.width}x${size.height}`);
          page = { region: this.full ? null : { layer: this.pages.size } };
          this.pages.set(image, [page]);
        }
        return page;
      },
    },
  };
  const bodies = { ready: new Set<string>(), paints: {} };
  // Ground images by chunk; the page store uploads on first sight, as GpuPages does.
  const images = new Map<object, object>();
  const host = createView3dHost(
    surface as unknown as GpuRasterSurface,
    bodies as unknown as GpuMeshBodies,
    (chunk) => (images.get(chunk) as CanvasImageSource | undefined) ?? null,
  );
  return { host, calls, surface, images, target: () => target, worldTarget };
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

  it("lends the page atlas: a chunk's ground page, with paced uploads (250)", () => {
    const { host, calls, surface, images } = fixture();
    const chunks = Array.from({ length: GROUND_UPLOADS_PER_VIEW + 2 }, () => ({}) as Chunk);
    for (const chunk of chunks.slice(1)) images.set(chunk, {});
    const uploads = () => calls.filter((call) => call.startsWith("upload")).length;
    host.draw(undefined, ({ pages }) => {
      expect(pages.atlas).toBe(surface.pages.atlas.texture);
      // No prepared image yet: flat colours, and nothing is uploaded for it.
      expect(pages.ground(chunks[0] as Chunk)).toBeUndefined();
      const got = chunks.slice(1).map((chunk) => pages.ground(chunk));
      // One view uploads a few pages a frame, in the order it asks (nearest first).
      expect(got.map((page) => !!page)).toEqual([
        ...Array(GROUND_UPLOADS_PER_VIEW).fill(true),
        false,
      ]);
      expect(uploads()).toBe(GROUND_UPLOADS_PER_VIEW);
      expect(calls).toContain(`upload 0,0 ${CHUNK_SIZE_PX}x${CHUNK_SIZE_PX}`);
      // A resident page is the same region every time and costs no upload.
      expect(pages.ground(chunks[1] as Chunk)).toBe(got[0]);
      expect(uploads()).toBe(GROUND_UPLOADS_PER_VIEW);
    });
    // The next view (or frame) has its own allowance, so the rest follow.
    host.draw(undefined, ({ pages }) => {
      expect(pages.ground(chunks.at(-1) as Chunk)).toBeDefined();
    });
    expect(uploads()).toBe(GROUND_UPLOADS_PER_VIEW + 1);
  });

  it("gives no ground page when the atlas is full", () => {
    const { host, surface, images } = fixture();
    surface.pages.full = true;
    const chunk = {} as Chunk;
    images.set(chunk, {});
    host.draw(undefined, ({ pages }) => expect(pages.ground(chunk)).toBeUndefined());
  });

  it("lends the pages of any image, uploaded on first use (250)", () => {
    const { host, calls } = fixture();
    const sheet = {} as CanvasImageSource;
    host.draw(undefined, ({ pages }) => {
      expect(pages.pageSize).toBe(512);
      const page = pages.page(sheet, 1024, 512);
      expect(page).toBeDefined();
      // The page store splits by the image's own size.
      expect(calls).toContain("upload 1024,512 2816x8224");
      expect(pages.page(sheet, 1024, 512)).toBe(page);
      expect(calls.filter((call) => call.startsWith("upload"))).toHaveLength(1);
    });
  });
});
