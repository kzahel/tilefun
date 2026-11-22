import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type SpriteImage, Spritesheet } from "../../assets/Spritesheet.js";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { createPlayer } from "../../entities/Player.js";
import { DECK_Z, treeHousePoint, treeHouseProp } from "../../entities/TreeHouse.js";
import { forestRowProp, forestRowType } from "../../patterns/ForestThicket.js";
import { railCrossingRecipe } from "../../scenarios/RailCrossingRecipe.js";
import { Chunk } from "../../world/Chunk.js";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import { observerInsideRoom, roomObserver } from "../collectScene.js";
import type { SpriteItem } from "../SceneItem.js";
import { REVEAL_OPACITY } from "../SurfacePresentation.js";
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
  const settle = (view: FirstPersonView, f: FirstPersonFrame, output = target) => {
    for (let i = 0; i < 60; i++) {
      view.render(f, output);
      if (!view.stats.builds) return;
    }
    throw Error("chunks kept building");
  };
  const internals = (view: FirstPersonView) =>
    view as unknown as {
      groundRoot: THREE.Group;
      ground: { count: number; meshes: number; root: THREE.Group };
    };

  it("keeps the selected fog distance through missing terrain, movement and chunk arrival", () => {
    const loaded = new Map<string, Chunk>();
    const w = world(loaded);
    const view = new FirstPersonView(new Map());
    const f = { ...frame(w, false), drawRadius: 1600 };
    const { fog } = view as unknown as { fog: THREE.Fog };
    const check = (radius: number) => {
      view.render({ ...f, drawRadius: radius }, target);
      expect(fog.near).toBe(radius * 0.45);
      expect(fog.far).toBe(radius);
      expect(view.stats.fogEnd).toBe(radius);
    };
    // Even the eye's own chunk is missing at first.
    check(1600);
    loaded.set("0,0", new Chunk());
    check(1600);
    f.eye = { ...f.eye, x: 4096 };
    check(1600);
    // Both nearer and farther choices apply on the very next frame.
    check(400);
    check(1600);
    view.dispose();
  });

  it("draws every chunk's ground as one mesh, with walls only where ground is raised", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -1; cy <= 1; cy++)
      for (let cx = -1; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    loaded.get("0,0")?.setHeight(5, 5, 2);
    const view = new FirstPersonView(new Map());
    settle(view, frame(world(loaded), false));
    expect(view.stats.chunks).toBe(9);
    expect(internals(view).ground.count).toBe(9);
    // Nine chunks share one ground mesh; the raised tile adds its textured south
    // face (a ground mesh of its chunk) and its area one of flat walls.
    expect(internals(view).ground.meshes).toBe(2);
    expect(view.stats.meshes).toBe(3);
    const walls = internals(view).groundRoot.children.filter(
      (child) => child instanceof THREE.Mesh,
    ) as THREE.Mesh[];
    expect(walls).toHaveLength(1);
    expect(walls[0]?.geometry.getAttribute("position").count).toBe(3 * 6);
    // Walls and cliffs cast the sun's shadow; ground tops are not drawn into its map.
    expect(walls[0]?.layers.isEnabled(1)).toBe(true);
    const ground = internals(view).ground.root.children as THREE.Mesh[];
    const cliff = ground.find((mesh) => mesh.geometry.getAttribute("position").count < 100);
    const tops = ground.find((mesh) => mesh !== cliff);
    expect(cliff?.geometry.getAttribute("position").count).toBe(6);
    expect(cliff?.layers.isEnabled(1)).toBe(true);
    expect(tops?.layers.isEnabled(1)).toBe(false);
    view.dispose();
  });

  it("draws streamed fixture props even when the fixture has no terrain chunks", () => {
    const view = new FirstPersonView(new Map());
    const f: FirstPersonFrame = {
      ...frame(world(new Map()), true),
      props: [
        {
          id: 1,
          type: "fixture",
          isProp: true,
          position: { wx: 128, wy: 128 },
          sprite: {
            sheetKey: "missing",
            frameCol: 0,
            frameRow: 0,
            spriteWidth: 16,
            spriteHeight: 32,
          },
          collider: { offsetX: 0, offsetY: 0, width: 16, height: 16, zHeight: 32 },
          walls: null,
        },
      ],
    };
    settle(view, f);
    expect(view.stats.meshes).toBeGreaterThan(0);
    expect(view.stats.groundPages).toBe(0);
    view.dispose();
  });

  it("keeps an overlapping forest row through zoom changes and drops it when out of view", () => {
    const row = forestRowProp(forestRowType(1, 9), 1224, 150);
    if (!row) throw Error("missing forest row");
    const sheet = new Spritesheet({ width: 2816, height: 8224 } as SpriteImage, 16, 16);
    const region = { x: 0, y: 0, width: 512, height: 512, layer: 0 };
    const output = { ...target, pages: { ...pages, page: () => region } };
    const f = {
      ...frame(world(new Map()), true),
      eye: { x: 0, y: 0, z: 20, yaw: 0, pitch: 0 },
      props: [row],
    };
    const view = new FirstPersonView(new Map([[row.sprite.sheetKey, sheet]]));
    const draw = (scale: number) => settle(view, { ...f, topDown: { scale } }, output);
    draw(0.5);
    expect(view.stats.cards).toBeGreaterThan(0);
    const count = view.stats.cards;
    // The right edge is now x=640. The art starts at x=608 while its anchor
    // chunk starts at x=1024, well outside the ordinary 128 px render margin.
    draw(1);
    expect(view.stats.cards).toBe(count);
    draw(1.5);
    expect(view.stats.cards).toBe(0);
    draw(1);
    expect(view.stats.cards).toBe(count);
    settle(view, { ...f, topDown: { scale: 1 }, props: [] }, output);
    expect(view.stats.cards).toBe(0);
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
      setExcavator: rig,
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

  it("draws moving bodies into their own shadow map in place of contact shadows (266)", () => {
    const rig = () => {};
    const asset = {
      object: new THREE.Group(),
      setPhysical: rig,
      setTransportRamp: rig,
      setTowLift: rig,
      setTravel: rig,
      setExcavator: rig,
      setDumpBed: rig,
      setEmergency: rig,
    } as unknown as CarMeshAsset;
    const body = (wx: number, wy = 128, more: Partial<SpriteItem> = {}) =>
      ({
        kind: "sprite",
        wx,
        wy,
        zOffset: 0,
        sheetKey: "none",
        mesh: { assetId: "car", orientation: [0, 0, 0, 1], radius: 8 },
        gpuShadow: {
          x: wx,
          y: wy,
          ux: 8,
          uy: 0,
          vx: 0,
          vy: 4,
          plane: [0, 0, 4],
          band: 8,
          support: 0,
          mask: "vehicle",
          casterId: 1,
        },
        ...more,
      }) as unknown as SpriteItem;
    const image: BodyImage = { texture: new THREE.Texture(), depth: null, radius: 8 };
    const withImages = {
      ...target,
      meshes: {
        ready: new Set(["car"]),
        asset: () => asset,
        paint: () => undefined,
        bindPaint: () => () => {},
        bodyImage: (_item: SpriteItem, shows: (radius: number) => boolean) =>
          shows(8) ? image : null,
      },
    } as unknown as View3dTarget;
    const towed = body(110);
    // One world object: a new one would rebuild the chunks and the sun's map.
    const w = world(new Map([["0,0", new Chunk()]]));
    const view = new FirstPersonView(new Map());
    const scene = (topDown: boolean, more: Partial<FirstPersonFrame> = {}): FirstPersonFrame => ({
      ...frame(w, topDown),
      shadows: true,
      // Two bodies in view (one towing a third) and one far beyond any map.
      sprites: [body(100, 128, { towGroup: towed }), body(140), body(128 + 5000)],
      ...more,
    });
    settle(view, scene(true), withImages);

    // Off: no second map, and every body keeps its contact shadow.
    drawn.length = 0;
    view.render(scene(true), withImages);
    expect(view.stats.dynamicTexel).toBe(0);
    expect(view.stats.dynamicBodies).toBe(0);
    expect(view.stats.blobs).toBe(4);
    // The world and every image at once (the sun's own map was drawn while settling).
    const plain = drawn.length;
    expect(plain).toBe(2);

    // On: the bodies in reach are drawn as meshes into the map, although the view
    // itself shows them as images, and only the far one keeps a contact shadow.
    drawn.length = 0;
    view.render(scene(true, { dynamicShadows: true }), withImages);
    expect(view.stats.dynamicTexel).toBe(0.5);
    expect(view.stats.dynamicBodies).toBe(3);
    expect(view.stats.blobs).toBe(1);
    expect(view.stats.bodyImages).toBe(2);
    // The map's renders come before the view's own, through the map's camera:
    // the scene's marked meshes, the actor cards, then each body.
    const mapCamera = (view as unknown as { dynamic: { camera: THREE.Camera } }).dynamic.camera;
    const mapDraws = drawn.flatMap((draw, index) => (draw.camera === mapCamera ? [index] : []));
    expect(mapDraws).toHaveLength(5);
    expect((mapDraws[4] ?? 0) - (mapDraws[0] ?? 0)).toBe(4);
    expect(drawn.slice((mapDraws[4] ?? 0) + 1)).toHaveLength(plain);

    // A mesh without a contact shadow (a boat on water) still casts.
    const boat = body(120, 160);
    delete (boat as { gpuShadow?: unknown }).gpuShadow;
    view.render(scene(true, { dynamicShadows: true, sprites: [boat] }), withImages);
    expect(view.stats.dynamicBodies).toBe(1);
    expect(view.stats.blobs).toBe(0);

    // The sun's shadows off, or a room, leaves nothing for moving bodies to cast.
    view.render(scene(true, { dynamicShadows: true, sun: false }), withImages);
    expect(view.stats.dynamicTexel).toBe(0);
    expect(view.stats.blobs).toBe(4);

    // First person: the map reaches a set distance from the eye, and a body in
    // its fade keeps part of its contact shadow.
    const near = body(128 + 100),
      fading = body(128 + 440),
      beyond = body(128 + 700);
    const eye = { dynamicShadows: true, drawRadius: 1600, sprites: [near, fading, beyond] };
    settle(view, scene(false, eye), withImages);
    view.render(scene(false, eye), withImages);
    expect(view.stats.dynamicTexel).toBe(0.5);
    expect(view.stats.dynamicBodies).toBe(2);
    expect(view.stats.blobs).toBe(2);
    const { blobs } = view as unknown as {
      blobs: { mesh: THREE.Mesh };
    };
    const strengths = blobs.mesh.geometry.getAttribute("mask");
    expect(strengths.getW(0)).toBe(1);
    expect(strengths.getW(4)).toBeGreaterThan(0);
    expect(strengths.getW(4)).toBeLessThan(1);
    view.dispose();
  });

  it("swaps a tree house to its inside picture top-down while the observer is in its cabin", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -2; cy <= 1; cy++)
      for (let cx = -2; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    const house = { ...treeHouseProp(0, 100), id: 7 };
    const props = [house];
    const cabin = treeHousePoint(0, 100, 65, 140);
    const player = (z: number) => {
      const body = { ...createPlayer(cabin.wx, cabin.wy), wz: z };
      // The fixed view's own test, at the body's footprint.
      expect(observerInsideRoom(house, roomObserver(body, 1))).toBe(z === DECK_Z);
      return body;
    };
    const at = (observer: ReturnType<typeof player>, topDown = true): FirstPersonFrame => ({
      ...frame(world(loaded), topDown),
      eye: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      props,
      cutaway: { observer, fades: new Map(), time: 0, alpha: 1 },
    });
    const view = new FirstPersonView(new Map());
    const rooms = () => [
      ...(
        view as unknown as {
          roomViews: Map<string, { solid: THREE.Group; outside: THREE.Group; inside: THREE.Group }>;
        }
      ).roomViews.values(),
    ];
    settle(view, at(player(0)));
    expect(rooms()).toHaveLength(1);
    const room = () => rooms()[0];
    // Each view is its own meshes, under its own group.
    // Without sheets only the volumes have faces (flat); the pictures need artwork.
    expect(room()?.solid.children.length).toBeGreaterThan(0);
    const shown = () => [room()?.solid.visible, room()?.outside.visible, room()?.inside.visible];
    expect(shown()).toEqual([false, true, false]);
    view.render(at(player(DECK_Z)), target);
    expect(shown()).toEqual([false, false, true]);
    // First person shows the volumes.
    const firstPerson = at(player(DECK_Z), false);
    settle(view, firstPerson);
    view.render(firstPerson, target);
    expect(shown()).toEqual([true, false, false]);
    view.dispose();
    expect(rooms()).toHaveLength(0);
  });

  it("fades an overhead deck over the player beneath it, as the fixed view's cutaway does", () => {
    const loaded = new Map<string, Chunk>();
    for (let cy = -2; cy <= 1; cy++)
      for (let cx = -2; cx <= 1; cx++) loaded.set(`${cx},${cy}`, new Chunk());
    const props = railCrossingRecipe().props.filter((p) => p.collider?.surface);
    const fades = new Map<string, { opacity: number; time: number }>();
    // North of the deck's middle: on screen the raised deck covers what stands under its north half.
    const player = (z: number) => ({ ...createPlayer(0, -40), wz: z });
    const at = (observer: ReturnType<typeof player>, time: number) => ({
      ...frame(world(loaded), true),
      eye: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      props,
      cutaway: { observer, fades, time, alpha: 1 },
    });
    const view = new FirstPersonView(new Map());
    settle(view, at(player(64), 0));
    const materials = (
      view as unknown as {
        decks: {
          materials: Map<string, { face: THREE.MeshBasicMaterial; grid: THREE.LineBasicMaterial }>;
        };
      }
    ).decks.materials;
    expect([...materials.keys()].sort()).toEqual(["north-ramp", "road-bridge", "south-ramp"]);
    const bridge = () => materials.get("road-bridge")?.face as THREE.MeshBasicMaterial;
    const grid = () => materials.get("road-bridge")?.grid as THREE.LineBasicMaterial;
    // On the bridge, nothing fades.
    expect(bridge().transparent).toBe(false);
    // Under it, the deck eases to the fixed view's reveal opacity, then back.
    view.render(at(player(0), 1), target);
    view.render(at(player(0), 1.05), target);
    expect(bridge().transparent).toBe(true);
    expect(bridge().opacity).toBeGreaterThan(REVEAL_OPACITY);
    view.render(at(player(0), 1.3), target);
    expect(bridge().opacity).toBeCloseTo(REVEAL_OPACITY, 6);
    // Nearest faces first: the deck blends once, after grass and effects.
    expect(bridge().depthWrite).toBe(true);
    const mesh = (view as unknown as { solidRoot: THREE.Group }).solidRoot.children.find(
      (child) => child instanceof THREE.Mesh && child.material === bridge(),
    );
    expect(mesh?.renderOrder).toBe(4);
    expect(grid().opacity).toBeCloseTo(REVEAL_OPACITY, 6);
    expect(grid().depthWrite).toBe(true);
    view.render(at(player(64), 2), target);
    view.render(at(player(64), 2.3), target);
    expect(bridge().transparent).toBe(false);
    expect(bridge().opacity).toBe(1);
    view.render(at(player(0), 2.4), target);
    view.render(at(player(0), 2.6), target);
    expect(bridge().opacity).toBeCloseTo(REVEAL_OPACITY, 6);
    const all = at(player(0), 2.6);
    view.render({ ...all, cutaway: { ...all.cutaway, visibility: "all" } }, target);
    expect(bridge().opacity).toBe(1); // Explicit views do not inherit an automatic fade.
    expect(grid().opacity).toBe(1);
    const lower = at(player(0), 3);
    view.render({ ...lower, cutaway: { ...lower.cutaway, visibility: "lower" } }, target);
    expect(bridge().visible).toBe(false); // hidden materials cannot occlude the lower floor
    expect(grid().visible).toBe(false);
    view.render({ ...lower, cutaway: { ...lower.cutaway, visibility: "all" } }, target);
    expect(bridge().visible).toBe(true);
    expect(bridge().opacity).toBe(1);
    view.dispose();
  });

  it("draws the sky over the finished view, and nothing on a clear day", () => {
    const view = new FirstPersonView(new Map());
    const f = frame(world(new Map([["0,0", new Chunk()]])), true);
    settle(view, f);
    const clear = { tint: [1, 1, 1], rain: 0, flash: 0, glow: 0 } as const;
    drawn.length = 0;
    view.render({ ...f, atmosphere: clear }, target);
    const plain = drawn.length;
    drawn.length = 0;
    // Night, rain or a flash each add one render after the world's.
    for (const atmosphere of [
      { ...clear, tint: [0.42, 0.48, 0.78] as const },
      { ...clear, rain: 0.5 },
      { ...clear, flash: 0.3 },
    ]) {
      drawn.length = 0;
      view.render({ ...f, atmosphere }, target);
      expect(drawn).toHaveLength(plain + 1);
      const { atmosphere: pass } = view as unknown as { atmosphere: { camera: THREE.Camera } };
      expect(drawn.at(-1)?.camera).toBe(pass.camera);
    }
    view.dispose();
  });
});
