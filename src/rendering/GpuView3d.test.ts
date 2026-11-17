import { describe, expect, it } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { GpuMeshBodies } from "./GpuMeshBodies.js";
import type { GpuSceneSurface } from "./GpuSceneSurface.js";
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
      pages: new Map<object, { x: number; y: number; region: object | null }[]>(),
      full: false,
      imageSize: () => ({ width: 2816, height: 8224 }),
      get(image: object, x: number, y: number, size: { width: number; height: number }) {
        const list = this.pages.get(image) ?? [];
        this.pages.set(image, list);
        let page = list.find((p) => p.x === x && p.y === y);
        if (!page) {
          calls.push(`upload ${x},${y} ${size.width}x${size.height}`);
          page = { x, y, region: this.full ? null : { layer: this.pages.size, x, y } };
          list.push(page);
        }
        return page;
      },
    },
  };
  const bodies = { ready: new Set<string>(), paints: {} };
  // Ground images by chunk; the page store uploads on first sight, as GpuPages does.
  const images = new Map<object, object>();
  const host = createView3dHost(
    surface as unknown as GpuSceneSurface,
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
      // Another page of the same image is another region and another upload.
      expect(pages.page(sheet, 0, 0)).not.toBe(page);
      expect(calls).toContain("upload 0,0 2816x8224");
    });
  });

  it("keeps a chunk in its old ground image while the replacement waits its turn", () => {
    const { host, calls, surface, images } = fixture();
    const edited = {} as Chunk,
      old = {},
      replacement = {};
    images.set(edited, old);
    let worn: unknown;
    host.draw(undefined, ({ pages }) => {
      worn = pages.ground(edited);
    });
    expect(worn).toBeDefined();
    // The chunk is rastered again, in a frame whose uploads are already spent.
    images.set(edited, replacement);
    const others = Array.from({ length: GROUND_UPLOADS_PER_VIEW }, () => ({}) as Chunk);
    for (const chunk of others) images.set(chunk, {});
    const uploads = () => calls.filter((call) => call.startsWith("upload")).length;
    host.draw(undefined, ({ pages }) => {
      for (const chunk of others) pages.ground(chunk);
      const before = uploads();
      expect(pages.ground(edited)).toBe(worn); // not flat, and no upload
      expect(uploads()).toBe(before);
    });
    // Its turn comes: the new image's page.
    host.draw(undefined, ({ pages }) => {
      const page = pages.ground(edited);
      expect(page).toBeDefined();
      expect(page).not.toBe(worn);
    });
    // An old image whose page is gone (aged out, restored context) is not worn.
    const second = {} as Chunk;
    images.set(second, {});
    host.draw(undefined, ({ pages }) => void pages.ground(second));
    surface.pages.pages.clear();
    images.set(second, {});
    host.draw(undefined, ({ pages }) => {
      for (const chunk of others) pages.ground(chunk);
      expect(pages.ground(second)).toBeUndefined();
    });
  });
});
