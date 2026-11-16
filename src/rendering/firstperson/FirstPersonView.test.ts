import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { Chunk } from "../../world/Chunk.js";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import type { SpriteItem } from "../SceneItem.js";
import type { BodyImage, View3dTarget } from "../View3dHost.js";
import { chunksInReach, terrainStale } from "./FirstPersonChunks.js";
import {
  type FirstPersonFrame,
  FirstPersonView,
  type FirstPersonWorld,
} from "./FirstPersonView.js";

describe("first-person chunk residency", () => {
  it("rebuilds ground for a replaced chunk object even with the same revisions", () => {
    // A freshly loaded world's chunk at the same coordinates usually arrives with the
    // same revision pair, so the object identity must be part of the cache key.
    const first = { revision: 3, visualRevision: 1 };
    const cached = { chunk: first, key: "3:1" };
    expect(terrainStale(cached, first)).toBe(false);
    expect(terrainStale(cached, { revision: 3, visualRevision: 1 })).toBe(true);
    first.visualRevision = 2;
    expect(terrainStale(cached, first)).toBe(true);
    expect(terrainStale(undefined, first)).toBe(true);
  });

  it("lists chunks inside the reach circle, nearest first", () => {
    const size = CHUNK_SIZE * TILE_SIZE;
    const chunks = chunksInReach(size / 2, size / 2, size);
    expect(chunks[0]).toMatchObject({ cx: 0, cy: 0, key: "0,0" });
    expect(chunks.map((c) => c.key)).toEqual(
      expect.arrayContaining(["1,0", "-1,0", "0,1", "0,-1"]),
    );
    // Diagonal neighbours' nearest corners are √2·size/2 ≈ 0.71·size away: inside.
    expect(chunks.map((c) => c.key)).toContain("1,1");
    expect(chunks.map((c) => c.key)).not.toContain("2,0");
  });
});

describe("the view's merged static world (251)", () => {
  /** A renderer that draws nothing; the view only needs its calls to exist. */
  const renderer = {
    info: { autoReset: true, reset() {}, render: { calls: 0 } },
    initRenderTarget() {},
    getRenderTarget: () => null,
    setRenderTarget() {},
    setClearColor() {},
    clear() {},
    render(_scene: THREE.Scene, camera: THREE.Camera) {
      drawn.push({ camera, planes: [...(renderer.clippingPlanes ?? [])] });
    },
    xr: { enabled: false },
    clippingPlanes: [] as THREE.Plane[],
  } as unknown as THREE.WebGLRenderer;
  /** Every render the view asked for: its camera and the cut in force. */
  const drawn: { camera: THREE.Camera; planes: THREE.Plane[] }[] = [];
  const pages = { atlas: null, pageSize: 512, ground: () => undefined, page: () => undefined };
  const target = {
    renderer,
    width: 1280,
    height: 800,
    generation: 0,
    meshes: { ready: new Set<string>(), asset: () => undefined },
    pages,
  } as unknown as View3dTarget;
  /** Loaded chunks by key; raised chunks have one cliff around a raised tile. */
  function world(loaded: Map<string, Chunk>): FirstPersonWorld {
    return {
      getChunkIfLoaded: (cx: number, cy: number) => loaded.get(`${cx},${cy}`),
      getHeightAt: () => 0,
    } as unknown as FirstPersonWorld;
  }
  const frame = (w: FirstPersonWorld, topDown: boolean): FirstPersonFrame => ({
    eye: { x: 128, y: 128, z: 20, yaw: 0, pitch: 0 },
    world: w,
    realm: "test",
    props: [],
    sprites: [],
    drawRadius: 300,
    shadows: false,
    topDown: topDown ? { scale: 3 } : undefined,
  });
  const settle = (view: FirstPersonView, f: FirstPersonFrame) => {
    for (let i = 0; i < 60; i++) {
      view.render(f, target);
      if (!view.stats.builds) return;
    }
    throw Error("chunks kept building");
  };
  const internals = (view: FirstPersonView) =>
    view as unknown as { groundRoot: THREE.Group; ground: { count: number; meshes: number } };

  it("draws every chunk's ground as one mesh, with walls only where ground is raised", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    loaded.get("0,0")?.setHeight(5, 5, 2);
    const view = new FirstPersonView(new Map());
    settle(view, frame(world(loaded), false));
    expect(view.stats.chunks).toBe(9);
    expect(internals(view).ground.count).toBe(9);
    // Nine chunks share one ground mesh; the raised tile's area adds one of walls.
    expect(internals(view).ground.meshes).toBe(1);
    expect(view.stats.meshes).toBe(2);
    const walls = internals(view).groundRoot.children.filter(
      (child) => child instanceof THREE.Mesh,
    ) as THREE.Mesh[];
    expect(walls).toHaveLength(1);
    expect(walls[0]?.geometry.getAttribute("position").count).toBe(4 * 6);
    // Walls cast the sun's shadow; ground tops are not drawn into its map.
    expect(walls[0]?.layers.isEnabled(1)).toBe(true);
    view.dispose();
  });

  it("keeps the same chunks when a seat switches to the top-down camera, and frees those that leave", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    const w = world(loaded);
    const view = new FirstPersonView(new Map());
    settle(view, frame(w, false));
    view.render(frame(w, true), target);
    // The top-down ground on screen is inside the chunks already built.
    expect(view.stats.builds).toBe(0);
    expect(internals(view).ground.count).toBe(9);
    // An edited chunk is rebuilt in its own slot.
    const chunk = loaded.get("0,0") as Chunk;
    chunk.visualRevision++;
    view.render(frame(w, true), target);
    expect(view.stats.builds).toBe(1);
    expect(internals(view).ground.count).toBe(9);
    // Another world: nothing of the old one is left.
    settle(view, { ...frame(world(new Map([["0,0", new Chunk()]])), true), realm: "other" });
    expect(view.stats.chunks).toBe(1);
    expect(internals(view).ground.count).toBe(1);
    expect(view.stats.meshes).toBe(1);
    view.dispose();
    expect(internals(view).ground.meshes).toBe(0);
  });

  it("draws a headset frame through the room's place in the world (252)", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -2; cy <= 2; cy++)
      for (let cx = -2; cx <= 2; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    const view = new FirstPersonView(new Map());
    const w = world(loaded);
    const rig = { x: 100, y: 140, z: 0, yaw: -Math.PI / 2, pixelsPerMetre: 18 };
    settle(view, { ...frame(w, false), headset: { rig } });
    drawn.length = 0;
    view.render({ ...frame(w, false), headset: { rig } }, target);
    const camera = drawn[0]?.camera as THREE.PerspectiveCamera;
    // The eyes' poses are relative to the camera's parent: the room, in scene axes.
    const room = camera.parent;
    expect(room?.matrix.elements.slice(12, 15)).toEqual([100, -140, 0]);
    expect(
      new THREE.Vector3().setFromMatrixScale(room?.matrix ?? new THREE.Matrix4()).x,
    ).toBeCloseTo(18, 6);
    // Metres, like the poses: the far plane covers the draw radius.
    expect(camera.near).toBeLessThan(0.1);
    expect(camera.far).toBeGreaterThanOrEqual((300 + CHUNK_SIZE * TILE_SIZE) / 18);
    const { fog } = view as unknown as { fog: THREE.Fog };
    expect(fog.far).toBeCloseTo(300 / 18, 6);
    expect(drawn[0]?.planes).toEqual([]);

    // A tabletop: chunks around its middle, cut to its square, no fog.
    const table = { x: 128, y: 128, half: 100 };
    const tabletop = { ...frame(w, false), drawRadius: 141, headset: { rig, table } };
    settle(view, tabletop);
    drawn.length = 0;
    view.render(tabletop, target);
    const planes = drawn[0]?.planes ?? [];
    expect(planes).toHaveLength(4);
    const inside = (x: number, y: number) =>
      planes.every((plane) => plane.distanceToPoint(new THREE.Vector3(x, -y, 5)) >= 0);
    expect(inside(128, 128)).toBe(true);
    expect(inside(227, 29)).toBe(true);
    expect(inside(229, 128)).toBe(false);
    expect(inside(128, 27)).toBe(false);
    expect((view as unknown as { scene: THREE.Scene }).scene.fog).toBeNull();
    // The cut is the frame's own: the host's other draws are not clipped.
    expect(renderer.clippingPlanes).toEqual([]);
    view.dispose();
  });
  it("draws top-down vehicles as the host's images, and as meshes where it has none", () => {
    const rig = () => {};
    const asset = {
      object: new THREE.Group(),
      setPhysical: rig,
      setTransportRamp: rig,
      setTowLift: rig,
      setTravel: rig,
      setDumpBed: rig,
      setEmergency: rig,
    } as unknown as CarMeshAsset;
    const body = (wx: number, more: Partial<SpriteItem> = {}) =>
      ({
        kind: "sprite",
        wx,
        wy: 128,
        zOffset: 0,
        sheetKey: "none",
        mesh: { assetId: "car", orientation: [0, 0, 0, 1], radius: 8 },
        ...more,
      }) as unknown as SpriteItem;
    const image: BodyImage = { texture: new THREE.Texture(), depth: null, radius: 8 };
    const asked: SpriteItem[] = [];
    /** The host has an image for every body in view west of x = 150. */
    const withImages = {
      ...target,
      meshes: {
        ready: new Set(["car"]),
        asset: () => asset,
        paint: () => undefined,
        bindPaint: () => () => {},
        bodyImage(item: SpriteItem, shows: (radius: number) => boolean) {
          asked.push(item);
          if (!shows(8)) return null;
          return item.wx < 150 ? image : undefined;
        },
      },
    } as unknown as View3dTarget;
    const towed = body(110);
    const truck = body(100, { towGroup: towed });
    const lone = body(120);
    const unready = body(160);
    const hidden = body(130, { alpha: 0 });
    // The view is 1280 × 800 at 3×: 427 world pixels wide around x = 128.
    const offScreen = body(128 + 214 + 9, { towGroup: body(128 + 214 + 20) });
    const loaded = new Map([["0,0", new Chunk()]]);
    const view = new FirstPersonView(new Map());
    const scene = (topDown: boolean, more: Partial<FirstPersonFrame> = {}): FirstPersonFrame => ({
      ...frame(world(loaded), topDown),
      sprites: [truck, lone, unready, hidden, offScreen],
      ...more,
    });
    settle(view, scene(true));

    asked.length = 0;
    drawn.length = 0;
    view.render(scene(true), withImages);
    // Shown bodies only, and not the towed car: it is in its truck's image.
    expect(asked).toEqual([truck, lone, unready, offScreen]);
    // Nothing is drawn for the group off screen, as an image or as meshes.
    expect(view.stats.bodyImages).toBe(2);
    expect(view.stats.cars).toBe(3);
    // The world, the one body without an image as a mesh, then every image at once.
    expect(drawn).toHaveLength(3);

    // Switched off, every body is a mesh again, the towed car included.
    asked.length = 0;
    drawn.length = 0;
    view.render(scene(true, { pixelBodies: false }), withImages);
    expect(asked).toEqual([]);
    expect(view.stats.bodyImages).toBe(0);
    expect(view.stats.cars).toBe(6);
    expect(drawn).toHaveLength(7);

    // An image is the body seen by the top-down camera: no other camera shows one.
    settle(view, scene(false));
    asked.length = 0;
    view.render(scene(false), withImages);
    expect(asked).toEqual([]);
    expect(view.stats.bodyImages).toBe(0);
    expect(view.stats.cars).toBe(6);
    view.dispose();
  });
});
