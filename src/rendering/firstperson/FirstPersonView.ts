import * as THREE from "three";
import { MODERN_INTERIORS_SHEET_KEY } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import type { Prop } from "../../entities/Prop.js";
import { vehiclePaint } from "../../traffic/VehiclePaint.js";
import type { World } from "../../world/World.js";
import { applyMeshInstance, loadAuthoredMesh } from "../AuthoredMeshPose.js";
import { authoredVehicleForAsset } from "../AuthoredVehicleMeshes.js";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import { ResourceSlot } from "../ResourceSlot.js";
import type { SpriteItem } from "../SceneItem.js";
import { VehiclePaintResources } from "../VehiclePaintResources.js";
import {
  actorBillboard,
  artCard,
  type Billboard,
  BillboardBatches,
  sheetUv,
} from "./FirstPersonBillboards.js";
import {
  cameraRight,
  type FirstPersonEye,
  lookDirection,
  nextFogEnd,
} from "./FirstPersonCamera.js";
import { FirstPersonImages, type PropImage } from "./FirstPersonImages.js";
import { type FirstPersonInterior, INTERIOR_BACKGROUND } from "./FirstPersonInterior.js";
import {
  appendPropGeometry,
  type PropGeometry,
  propForm,
  propImageFrame,
} from "./FirstPersonProps.js";
import { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { buildTerrainChunk, type ColoredTriangles, TriangleWriter } from "./FirstPersonTerrain.js";

export type FirstPersonWorld = Pick<World, "getChunkIfLoaded" | "getHeightAt">;
type FirstPersonChunkSource = NonNullable<ReturnType<FirstPersonWorld["getChunkIfLoaded"]>>;

/** One view frame. All positions are game axes (X east, Y south, Z up, world pixels). */
export interface FirstPersonFrame {
  readonly eye: FirstPersonEye;
  readonly world: FirstPersonWorld;
  /** Realm/world identity: the client keeps one World object across world loads. */
  readonly realm: string | null;
  readonly props: readonly Prop[];
  /** Shared world-space actor presentation (collectWorldSprites), unsorted. */
  readonly sprites: readonly SpriteItem[];
  /** Fog end and chunk residency radius in world pixels. */
  readonly drawRadius: number;
  /** Set inside a room: its floor and walls replace outdoor ground, without fog. */
  readonly interior?: FirstPersonInterior | undefined;
}

const SKY = 0x9fd3f0;
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;
const CHUNK_BUILDS_PER_FRAME = 3;
/** The fog never closes in nearer than this while chunks arrive. */
const MIN_FOG_END = 96;

type TexturedFaces = NonNullable<PropGeometry["textured"]>;

interface TerrainEntry {
  readonly chunk: object;
  readonly key: string;
}

interface ChunkScene {
  terrain?: TerrainEntry & { mesh: THREE.Mesh };
  props?: { group: THREE.Group; signature: string; billboards: Billboard[] };
}

/** Ground rebuilds for a replaced chunk object as well as for edited content. */
export function terrainStale(
  cached: TerrainEntry | undefined,
  chunk: { revision: number; visualRevision: number },
): boolean {
  return cached?.chunk !== chunk || cached.key !== `${chunk.revision}:${chunk.visualRevision}`;
}

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Chunk coordinates within `reach` of the eye, nearest first. */
export function chunksInReach(
  x: number,
  y: number,
  reach: number,
): { cx: number; cy: number; key: string; distance: number }[] {
  const wanted: { cx: number; cy: number; key: string; distance: number }[] = [];
  const min = (v: number) => Math.floor((v - reach) / CHUNK_PX);
  const max = (v: number) => Math.floor((v + reach) / CHUNK_PX);
  for (let cy = min(y); cy <= max(y); cy++)
    for (let cx = min(x); cx <= max(x); cx++) {
      const nx = Math.max(cx * CHUNK_PX, Math.min(x, (cx + 1) * CHUNK_PX));
      const ny = Math.max(cy * CHUNK_PX, Math.min(y, (cy + 1) * CHUNK_PX));
      const distance = Math.hypot(nx - x, ny - y);
      if (distance <= reach) wanted.push({ cx, cy, key: chunkKey(cx, cy), distance });
    }
  return wanted.sort((a, b) => a.distance - b.distance);
}

function coloredMesh(triangles: ColoredTriangles, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(triangles.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(triangles.colors, 3));
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function texturedMesh(faces: TexturedFaces, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(faces.positions), 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(faces.uvs), 2));
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry.dispose();
  });
  group.removeFromParent();
}

function propElevation(prop: Prop, world: FirstPersonWorld): number {
  return (
    world.getHeightAt(
      Math.floor(prop.position.wx / TILE_SIZE),
      Math.floor(prop.position.wy / TILE_SIZE),
    ) * ELEVATION_PX
  );
}

/**
 * Experimental first-person world view (tactical 229). Flat-coloured terrain,
 * prop collision volumes wearing their projected fixed-view artwork, upright
 * billboards for actors and narrow props, and the authored vehicle meshes.
 * Reads shared presentation output only; it never advances simulation.
 *
 * Owns its own canvas between the GPU world canvas and the UI canvas. The 226
 * multi-viewport work should let it share the host's WebGL renderer and assets.
 */
export class FirstPersonView {
  readonly canvas: HTMLCanvasElement;
  readonly stats = { chunks: 0, builds: 0, billboards: 0, cars: 0, calls: 0, fogEnd: 0 };
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly worldRoot = new THREE.Group();
  private readonly carScene = new THREE.Scene();
  private readonly carHolder = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 2, 4000);
  private readonly fog = new THREE.Fog(SKY, 200, 600);
  private readonly flatMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  private readonly faceMaterials = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
  private readonly billboards: BillboardBatches;
  private readonly chunks = new Map<string, ChunkScene>();
  private readonly vehicles = new Map<string, ResourceSlot<CarMeshAsset>>();
  private readonly paints = new VehiclePaintResources();
  private readonly images: FirstPersonImages;
  private readonly observer: ResizeObserver;
  private world: FirstPersonWorld | null = null;
  private realm: string | null | undefined;
  private propsSource: readonly Prop[] | null = null;
  private propsByChunk = new Map<string, { props: Prop[]; signature: string }>();
  /** Fog end, pulled in while in-reach chunks are still arriving. */
  private fogEnd: number | undefined;
  private room: { scene: FirstPersonRoomScene; mesh: THREE.Mesh } | null = null;
  private disposed = false;

  constructor(
    private readonly host: HTMLCanvasElement,
    private readonly sheets: ReadonlyMap<string, Spritesheet>,
  ) {
    this.images = new FirstPersonImages(sheets, (texture) => {
      this.faceMaterials.get(texture)?.dispose();
      this.faceMaterials.delete(texture);
    });
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.view = "first-person";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText = "position:fixed;pointer-events:none;image-rendering:pixelated;";
    host.before(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(SKY, 1);
    // Game axes are X east, Y south, Z up (left-handed seen from above). Mirroring
    // Y once at this boundary makes the world right-handed for Three, so east stays
    // on the right when looking north; Three flips face winding for det < 0.
    this.worldRoot.scale.set(1, -1, 1);
    this.scene.add(this.worldRoot);
    this.scene.fog = this.fog;
    this.billboards = new BillboardBatches(this.worldRoot);
    const carRoot = new THREE.Group();
    carRoot.scale.set(1, -1, 1);
    carRoot.add(this.carHolder);
    this.carScene.add(carRoot);
    this.carScene.fog = this.fog;
    this.camera.up.set(0, 0, 1);
    this.observer = new ResizeObserver(() => this.align());
    this.observer.observe(host);
    this.align();
  }

  set visible(value: boolean) {
    this.canvas.style.display = value ? "" : "none";
  }

  private align(): void {
    const rect = this.host.getBoundingClientRect();
    this.canvas.style.left = `${rect.left}px`;
    this.canvas.style.top = `${rect.top}px`;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  render(frame: FirstPersonFrame): void {
    if (this.disposed) return;
    this.resize();
    if (frame.world !== this.world || frame.realm !== this.realm) this.resetWorld(frame);
    this.syncRoom(frame.interior);
    if (frame.props !== this.propsSource) this.groupProps(frame.props);
    this.updateChunks(frame);
    this.placeCamera(frame.eye, frame.drawRadius);
    this.paints.beginFrame();
    const ready = new Set<string>();
    for (const [assetId, slot] of this.vehicles) if (slot.state === "ready") ready.add(assetId);
    const cars = this.fillBillboards(frame, ready);
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.stats.cars = 0;
    for (const item of cars) if (this.drawVehicle(item)) this.stats.cars++;
    this.stats.calls = this.renderer.info.render.calls;
  }

  private resize(): void {
    const width = this.host.clientWidth || this.host.width;
    const height = this.host.clientHeight || this.host.height;
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.align();
  }

  private placeCamera(eye: FirstPersonEye, drawRadius: number): void {
    const fogEnd = this.fogEnd ?? drawRadius;
    this.fog.near = fogEnd * 0.45;
    this.fog.far = fogEnd;
    this.camera.far = drawRadius + CHUNK_PX;
    this.camera.updateProjectionMatrix();
    const dir = lookDirection(eye.yaw, eye.pitch);
    this.camera.position.set(eye.x, -eye.y, eye.z);
    this.camera.lookAt(eye.x + dir.x, -(eye.y + dir.y), eye.z + dir.z);
  }

  private resetWorld(frame: FirstPersonFrame): void {
    this.dropChunks();
    this.world = frame.world;
    this.realm = frame.realm;
    this.propsSource = null;
    this.fogEnd = undefined;
  }

  private dropChunks(): void {
    for (const chunk of this.chunks.values()) this.dropChunk(chunk);
    this.chunks.clear();
  }

  /** Entering or leaving a room rebuilds every chunk (outdoor ground is not drawn
   * indoors). Editing the room keeps the old walls and furniture until each chunk
   * is rebuilt against the new artwork, so nothing flashes away. */
  private syncRoom(interior: FirstPersonInterior | undefined): void {
    const atlas = this.sheets.get(MODERN_INTERIORS_SHEET_KEY)?.image as
      | CanvasImageSource
      | undefined;
    const key = interior && `${interior.key}|${atlas ? "art" : "plain"}`;
    if (this.room?.scene.key === key) return;
    if (this.room && interior) {
      for (const chunk of this.chunks.values()) if (chunk.props) chunk.props.signature = "\0stale";
    } else this.dropChunks();
    this.disposeRoom();
    this.scene.fog = this.carScene.fog = interior ? null : this.fog;
    this.renderer.setClearColor(interior ? INTERIOR_BACKGROUND : SKY, 1);
    if (!interior || !key) return;
    const scene = new FirstPersonRoomScene(interior, key, atlas);
    scene.adoptShell(this.propsSource);
    const mesh = texturedMesh(scene.floorFaces(), this.faceMaterial(scene.floor));
    this.worldRoot.add(mesh);
    this.room = { scene, mesh };
  }

  private disposeRoom(): void {
    const room = this.room;
    if (!room) return;
    this.room = null;
    disposeGroup(room.mesh);
    for (const texture of [room.scene.floor, room.scene.walls]) {
      this.faceMaterials.get(texture)?.dispose();
      this.faceMaterials.delete(texture);
    }
    room.scene.dispose();
  }

  /** Replicated prop lists are replaced, never mutated, so identity marks a change. */
  private groupProps(props: readonly Prop[]): void {
    this.propsSource = props;
    this.room?.scene.adoptShell(props);
    this.propsByChunk.clear();
    for (const prop of props) {
      const key = chunkKey(
        Math.floor(prop.position.wx / CHUNK_PX),
        Math.floor(prop.position.wy / CHUNK_PX),
      );
      let entry = this.propsByChunk.get(key);
      if (!entry) {
        entry = { props: [], signature: "" };
        this.propsByChunk.set(key, entry);
      }
      entry.props.push(prop);
      entry.signature += `${prop.id}@${prop.position.wx},${prop.position.wy}:${prop.type}|`;
    }
  }

  /** Nearest missing or stale chunks first, a few per frame; far chunks are released. */
  private updateChunks(frame: FirstPersonFrame): void {
    const keep = new Set<string>();
    let builds = 0;
    let nearestMissing: number | undefined;
    for (const { cx, cy, key, distance } of chunksInReach(
      frame.eye.x,
      frame.eye.y,
      frame.drawRadius + CHUNK_PX,
    )) {
      keep.add(key);
      if (nearestMissing === undefined && !frame.world.getChunkIfLoaded(cx, cy))
        nearestMissing = distance;
      if (builds < CHUNK_BUILDS_PER_FRAME) builds += this.refreshChunk(frame.world, cx, cy, key);
    }
    // Rooms have no fog; outdoors the fog hides chunks that have not arrived yet.
    this.fogEnd = nextFogEnd(this.fogEnd, frame.drawRadius, nearestMissing, MIN_FOG_END);
    this.stats.fogEnd = Math.round(this.fogEnd);
    for (const [key, chunk] of this.chunks)
      if (!keep.has(key)) {
        this.dropChunk(chunk);
        this.chunks.delete(key);
      }
    this.stats.chunks = this.chunks.size;
    this.stats.builds = builds;
  }

  /** Rebuild a loaded chunk's stale ground or props; returns the number of builds. */
  private refreshChunk(world: FirstPersonWorld, cx: number, cy: number, key: string): number {
    const chunk = world.getChunkIfLoaded(cx, cy);
    if (!chunk) return 0;
    let scene = this.chunks.get(key);
    if (!scene) {
      scene = {};
      this.chunks.set(key, scene);
    }
    let builds = 0;
    if (!this.room && terrainStale(scene.terrain, chunk)) {
      if (scene.terrain) disposeGroup(scene.terrain.mesh);
      scene.terrain = this.buildTerrain(chunk, cx, cy, world);
      this.worldRoot.add(scene.terrain.mesh);
      builds++;
    }
    const { props, signature } = this.propsByChunk.get(key) ?? { props: [], signature: "" };
    if (scene.props?.signature !== signature) {
      if (scene.props) disposeGroup(scene.props.group);
      scene.props = { signature, ...this.buildProps(props, world) };
      this.worldRoot.add(scene.props.group);
      builds++;
    }
    return builds;
  }

  private buildTerrain(
    chunk: FirstPersonChunkSource,
    cx: number,
    cy: number,
    world: FirstPersonWorld,
  ): TerrainEntry & { mesh: THREE.Mesh } {
    const triangles = buildTerrainChunk(chunk, cx, cy, (tx, ty) => world.getHeightAt(tx, ty));
    return {
      chunk,
      key: `${chunk.revision}:${chunk.visualRevision}`,
      mesh: coloredMesh(triangles, this.flatMaterial),
    };
  }

  private dropChunk(chunk: ChunkScene): void {
    if (chunk.terrain) disposeGroup(chunk.terrain.mesh);
    if (chunk.props) disposeGroup(chunk.props.group);
  }

  private buildProps(
    props: readonly Prop[],
    world: FirstPersonWorld,
  ): { group: THREE.Group; billboards: Billboard[] } {
    const group = new THREE.Group();
    const billboards: Billboard[] = [];
    const flat = new TriangleWriter();
    const textured = new Map<THREE.Texture, TexturedFaces>();
    const facesFor = (image: PropImage | undefined) => {
      if (!image) return undefined;
      const faces = textured.get(image.texture) ?? { positions: [], uvs: [] };
      textured.set(image.texture, faces);
      return faces;
    };
    const room = this.room?.scene;
    for (const prop of props) {
      const elevation = propElevation(prop, world);
      if (room?.isShell(prop)) {
        room.appendShell(prop, elevation, flat, facesFor);
        continue;
      }
      // Room furniture is placed by its anchor; rugs lie on the floor.
      const furniture = room?.furniture(prop.type, this.images);
      if (room && furniture && room.appendFlat(prop, furniture, elevation, facesFor)) continue;
      const frame = furniture?.frame ?? propImageFrame(prop);
      if (propForm(prop, frame) === "billboard") {
        const card = furniture?.image(false);
        const billboard = furniture
          ? card && artCard(prop, frame, card.texture, elevation)
          : this.propBillboard(prop, elevation);
        if (billboard) billboards.push(billboard);
        continue;
      }
      const image = furniture ? furniture.image(true) : this.images.prop(prop, true);
      const color = image?.color ?? 0x8a8a8a;
      appendPropGeometry({ flat, textured: facesFor(image) }, prop, color, elevation, frame);
    }
    if (flat.vertexCount) group.add(coloredMesh(flat.finish(), this.flatMaterial));
    for (const [texture, faces] of textured)
      if (faces.positions.length) group.add(texturedMesh(faces, this.faceMaterial(texture)));
    return { group, billboards };
  }

  private propBillboard(prop: Prop, elevation: number): Billboard | undefined {
    if (!prop.sprite.parts?.length) {
      const sheet = this.images.sheet(prop.sprite.sheetKey);
      if (!sheet) return undefined;
      return {
        texture: sheet.texture,
        uv: sheetUv(sheet.sheet, prop.sprite, prop.sprite.frameRow, false),
        x: prop.position.wx,
        y: prop.position.wy,
        z: elevation,
        width: prop.sprite.spriteWidth,
        height: prop.sprite.spriteHeight,
      };
    }
    const image = this.images.prop(prop, false);
    return image && artCard(prop, image.frame, image.texture, elevation);
  }

  private faceMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    let material = this.faceMaterials.get(texture);
    if (!material) {
      // Opaque compositions have no holes; floor decals (rugs) cut out their padding.
      material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        alphaTest: 0.5,
      });
      this.faceMaterials.set(texture, material);
    }
    return material;
  }

  /** Static prop and actor billboards; returns actors whose authored mesh is drawable. */
  private fillBillboards(frame: FirstPersonFrame, ready: ReadonlySet<string>): SpriteItem[] {
    const { eye, drawRadius } = frame;
    this.billboards.begin(cameraRight(eye.yaw));
    for (const chunk of this.chunks.values())
      for (const b of chunk.props?.billboards ?? [])
        if (Math.hypot(b.x - eye.x, b.y - eye.y) <= drawRadius + b.width) this.billboards.push(b);
    const cars: SpriteItem[] = [];
    for (const item of frame.sprites) {
      this.queueActor(item, eye, ready, cars);
      if (item.towGroup) this.queueActor(item.towGroup, eye, ready, cars);
      for (const content of item.bedGroup?.contents ?? [])
        this.queueActor(content, eye, ready, cars);
    }
    this.billboards.end();
    this.stats.billboards = this.billboards.count;
    return cars;
  }

  /** Ready authored meshes draw as models; loading, failed and plain actors as sprites. */
  private queueActor(
    item: SpriteItem,
    eye: FirstPersonEye,
    ready: ReadonlySet<string>,
    cars: SpriteItem[],
  ): void {
    if (item.flashHidden || item.alpha === 0) return;
    if (item.mesh && this.vehicleReady(item.mesh.assetId, ready)) {
      cars.push(item);
      return;
    }
    const sheet = this.images.sheet(item.sheetKey);
    if (sheet) this.billboards.push(actorBillboard(item, sheet.sheet, sheet.texture, eye, ready));
  }

  /** Starts a load on first sight; true only once the asset is ready. */
  private vehicleReady(assetId: string, ready: ReadonlySet<string>): boolean {
    if (ready.has(assetId)) return true;
    if (!this.vehicles.has(assetId)) {
      const slot = new ResourceSlot<CarMeshAsset>();
      this.vehicles.set(assetId, slot);
      const load = loadAuthoredMesh(assetId);
      if (load) void slot.load(() => load);
      else slot.state = "failed";
    }
    return false;
  }

  private drawVehicle(item: SpriteItem): boolean {
    const mesh = item.mesh;
    const asset = mesh ? this.vehicles.get(mesh.assetId)?.value : undefined;
    if (!mesh || !asset) return false;
    const definition = authoredVehicleForAsset(mesh.assetId);
    const paint = definition && vehiclePaint(definition.vehicle, mesh.paintSchemeId);
    const paintTexture = paint ? this.paints.request(paint) : undefined;
    applyMeshInstance(asset, mesh);
    this.carHolder.position.set(item.wx, item.wy, item.zOffset);
    this.carHolder.add(asset.object);
    const restore = paintTexture ? this.paints.bind(asset.object, paintTexture) : undefined;
    try {
      this.renderer.render(this.carScene, this.camera);
    } finally {
      restore?.();
      this.carHolder.remove(asset.object);
    }
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.dropChunks();
    this.disposeRoom();
    this.billboards.dispose();
    for (const material of this.faceMaterials.values()) material.dispose();
    this.faceMaterials.clear();
    for (const slot of this.vehicles.values()) slot.dispose();
    this.vehicles.clear();
    this.paints.dispose();
    this.images.dispose();
    this.flatMaterial.dispose();
    // Release the context now, as GpuRasterSurface does; repeated toggles must not
    // stack contexts until garbage collection.
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
