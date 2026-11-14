import * as THREE from "three";
import { MODERN_INTERIORS_SHEET_KEY } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import type { Prop } from "../../entities/Prop.js";
import type { World } from "../../world/World.js";
import type { SpriteItem } from "../SceneItem.js";
import type { View3dTarget } from "../View3dHost.js";
import { actorBillboard, BillboardBatches, StaticCards } from "./FirstPersonBillboards.js";
import {
  cameraRight,
  type FirstPersonEye,
  lookDirection,
  nextFogEnd,
} from "./FirstPersonCamera.js";
import { FirstPersonImages } from "./FirstPersonImages.js";
import { type FirstPersonInterior, INTERIOR_BACKGROUND } from "./FirstPersonInterior.js";
import { type SunReceiver, shadeMaterial } from "./FirstPersonMaterials.js";
import { coloredMesh, disposeGroup, PropMeshes, texturedMesh } from "./FirstPersonPropMeshes.js";
import { type PropSurface, surfaceUnder } from "./FirstPersonProps.js";
import { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { BlobShadows, SunShadows } from "./FirstPersonShadows.js";
import { buildTerrainChunk } from "./FirstPersonTerrain.js";
import { FirstPersonVehicles } from "./FirstPersonVehicles.js";

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
  /** Sun and contact shadows (247); on unless false. Rooms have none. */
  readonly shadows?: boolean | undefined;
}

const SKY = 0x9fd3f0;
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;
const CHUNK_BUILDS_PER_FRAME = 3;
/** The fog never closes in nearer than this while chunks arrive. */
const MIN_FOG_END = 96;

interface TerrainEntry {
  readonly chunk: object;
  readonly key: string;
}

interface ChunkScene {
  readonly cx: number;
  readonly cy: number;
  terrain?: TerrainEntry & { mesh: THREE.Mesh };
  props?: { group: THREE.Group; signature: string; surfaces: PropSurface[] };
}

/** One flat quad per tile: more triangles means cliff walls, which cast shadows. */
const FLAT_CHUNK_VERTICES = CHUNK_SIZE * CHUNK_SIZE * 6;

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

/**
 * Experimental first-person world view (tactical 229). Flat-coloured terrain,
 * prop collision volumes wearing their projected fixed-view artwork, upright
 * billboards for actors and narrow props, and the authored vehicle meshes.
 * Reads shared presentation output only; it never advances simulation.
 *
 * Draws through the render host's WebGL renderer into a region of its canvas
 * (248): the view owns scene content, never a context or a canvas.
 */
export class FirstPersonView {
  readonly stats = {
    chunks: 0,
    builds: 0,
    /** Moving actor cards written this frame. */
    billboards: 0,
    /** Standing prop cards in the merged static meshes. */
    cards: 0,
    /** Contact shadows drawn this frame. */
    blobs: 0,
    /** Sun shadow map redraws since the view was created. */
    sunRedraws: 0,
    cars: 0,
    calls: 0,
    fogEnd: 0,
  };
  private readonly scene = new THREE.Scene();
  private readonly worldRoot = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 2, 4000);
  private readonly fog = new THREE.Fog(SKY, 200, 600);
  private readonly sun = new SunShadows();
  /** Horizontal axis the cards are expanded along: the camera's right (game axes). */
  private readonly cardRight = { value: new THREE.Vector2(1, 0) };
  private readonly flatMaterial = this.lit(
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    "faces",
  );
  private readonly billboards: BillboardBatches;
  private readonly cards: StaticCards;
  private readonly blobs: BlobShadows;
  private readonly vehicles = new FirstPersonVehicles((material) => {
    this.lit(material, "body");
  });
  private readonly propMeshes: PropMeshes;
  private readonly chunks = new Map<string, ChunkScene>();
  private readonly images: FirstPersonImages;
  private readonly background = new THREE.Color(SKY);
  /** The host's restored-context count the sun map was last drawn under. */
  private generation = 0;
  private world: FirstPersonWorld | null = null;
  private realm: string | null | undefined;
  private propsSource: readonly Prop[] | null = null;
  private propsByChunk = new Map<string, { props: Prop[]; signature: string }>();
  /** Fog end, pulled in while in-reach chunks are still arriving. */
  private fogEnd: number | undefined;
  /** Every resident chunk's decks and ramps; rebuilt on demand after a chunk changes. */
  private surfaces: PropSurface[] | null = null;
  private room: { scene: FirstPersonRoomScene; mesh: THREE.Mesh } | null = null;
  private disposed = false;

  constructor(private readonly sheets: ReadonlyMap<string, Spritesheet>) {
    this.images = new FirstPersonImages(sheets, (texture) => this.propMeshes.dropMaterial(texture));
    this.propMeshes = new PropMeshes(this.images, this.flatMaterial, (material) =>
      this.lit(material, "faces"),
    );
    // Game axes are X east, Y south, Z up (left-handed seen from above). Mirroring
    // Y once at this boundary makes the world right-handed for Three, so east stays
    // on the right when looking north; Three flips face winding for det < 0.
    this.worldRoot.scale.set(1, -1, 1);
    this.scene.add(this.worldRoot);
    this.scene.fog = this.fog;
    const card = (receiver: SunReceiver) => (texture: THREE.Texture) =>
      shadeMaterial(
        new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide }),
        { card: this.cardRight, sun: { uniforms: this.sun.uniforms, receiver } },
      );
    this.billboards = new BillboardBatches(this.worldRoot, card("body"));
    this.cards = new StaticCards(this.worldRoot, card("card"), this.sun.cardRoot, (texture) =>
      shadeMaterial(
        new THREE.MeshBasicMaterial({
          map: texture,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          colorWrite: false,
          fog: false,
        }),
        { card: this.sun.cardRight },
      ),
    );
    this.blobs = new BlobShadows(this.worldRoot);
    this.vehicles.fog = this.fog;
    this.camera.up.set(0, 0, 1);
  }

  /** Adds the sun's shadow to a material of the given receiver kind. */
  private lit<T extends THREE.Material>(material: T, receiver: SunReceiver): T {
    return shadeMaterial(material, { sun: { uniforms: this.sun.uniforms, receiver } });
  }

  /** Draw one frame into `target`: the host's renderer, bound to this view's region.
   * `generation` is the host's count of restored graphics contexts. */
  render(frame: FirstPersonFrame, target: View3dTarget, generation = 0): void {
    if (this.disposed) return;
    const { renderer } = target;
    if (generation !== this.generation) {
      // three.js re-uploads meshes and textures itself; the cached sun map is ours.
      this.generation = generation;
      this.sun.reset();
    }
    this.camera.aspect = target.width / Math.max(1, target.height);
    if (frame.world !== this.world || frame.realm !== this.realm) this.resetWorld(frame);
    this.syncRoom(frame.interior);
    if (frame.props !== this.propsSource) this.groupProps(frame.props);
    this.updateChunks(frame);
    // Card changes come with their chunk's rebuild, which already told the sun.
    this.cards.flush();
    this.stats.cards = this.cards.count;
    this.placeCamera(frame.eye, frame.drawRadius);
    const ready = this.vehicles.beginFrame();
    // Rooms have contact shadows but no sun.
    const shadows = frame.shadows !== false;
    const cars = this.fillBillboards(frame, ready, shadows);
    const fogEnd = this.fogEnd ?? frame.drawRadius;
    // Draw calls are counted over every render of this view, sun map included.
    const { info } = renderer;
    info.autoReset = false;
    info.reset();
    try {
      this.sun.update(renderer, this.scene, frame.eye, fogEnd, shadows && !frame.interior);
      this.stats.sunRedraws = this.sun.redraws;
      renderer.setClearColor(this.background, 1);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.stats.cars = 0;
      for (const item of cars)
        if (this.vehicles.draw(renderer, this.camera, item)) this.stats.cars++;
      this.stats.calls = info.render.calls;
    } finally {
      info.autoReset = true;
    }
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
    for (const [key, chunk] of this.chunks) this.dropChunk(key, chunk);
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
    this.scene.fog = this.vehicles.fog = interior ? null : this.fog;
    this.background.set(interior ? INTERIOR_BACKGROUND : SKY);
    if (!interior || !key) return;
    const scene = new FirstPersonRoomScene(interior, key, atlas);
    scene.adoptShell(this.propsSource);
    const mesh = texturedMesh(scene.floorFaces(), this.propMeshes.faceMaterial(scene.floor));
    this.worldRoot.add(mesh);
    this.room = { scene, mesh };
  }

  private disposeRoom(): void {
    const room = this.room;
    if (!room) return;
    this.room = null;
    disposeGroup(room.mesh);
    for (const texture of [room.scene.floor, room.scene.walls])
      this.propMeshes.dropMaterial(texture);
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
        this.dropChunk(key, chunk);
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
      scene = { cx, cy };
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
      const room = this.room?.scene;
      const built = this.propMeshes.build(props, (tx, ty) => world.getHeightAt(tx, ty), room);
      // Room shells and furniture stay out of the sun's map: rooms have no sun.
      if (!room) for (const mesh of built.group.children) SunShadows.cast(mesh);
      scene.props = { signature, group: built.group, surfaces: built.surfaces };
      this.cards.set(key, built.billboards);
      this.surfaces = null;
      this.worldRoot.add(scene.props.group);
      builds++;
    }
    if (builds) this.sun.invalidate(cx, cy);
    return builds;
  }

  private buildTerrain(
    chunk: FirstPersonChunkSource,
    cx: number,
    cy: number,
    world: FirstPersonWorld,
  ): TerrainEntry & { mesh: THREE.Mesh } {
    const triangles = buildTerrainChunk(chunk, cx, cy, (tx, ty) => world.getHeightAt(tx, ty));
    const mesh = coloredMesh(triangles, this.flatMaterial);
    if (triangles.positions.length / 3 > FLAT_CHUNK_VERTICES) SunShadows.cast(mesh);
    return { chunk, key: `${chunk.revision}:${chunk.visualRevision}`, mesh };
  }

  private dropChunk(key: string, chunk: ChunkScene): void {
    if (chunk.terrain) disposeGroup(chunk.terrain.mesh);
    if (chunk.props) disposeGroup(chunk.props.group);
    this.cards.delete(key);
    this.surfaces = null;
    this.sun.invalidate(chunk.cx, chunk.cy);
  }

  /** Actor billboards and contact shadows; returns actors whose authored mesh is drawable. */
  private fillBillboards(
    frame: FirstPersonFrame,
    ready: ReadonlySet<string>,
    shadows: boolean,
  ): SpriteItem[] {
    const { eye } = frame;
    const right = cameraRight(eye.yaw);
    this.cardRight.value.set(right.x, right.y);
    this.billboards.begin();
    this.blobs.begin();
    const cars: SpriteItem[] = [];
    for (const item of frame.sprites) {
      this.queueActor(item, eye, ready, cars, shadows);
      if (item.towGroup) this.queueActor(item.towGroup, eye, ready, cars, shadows);
      for (const content of item.bedGroup?.contents ?? [])
        this.queueActor(content, eye, ready, cars, shadows);
    }
    this.billboards.end();
    this.blobs.end();
    this.stats.billboards = this.billboards.count;
    this.stats.blobs = this.blobs.count;
    return cars;
  }

  /** Ready authored meshes draw as models; loading, failed and plain actors as sprites. */
  private queueActor(
    item: SpriteItem,
    eye: FirstPersonEye,
    ready: ReadonlySet<string>,
    cars: SpriteItem[],
    shadows: boolean,
  ): void {
    if (item.flashHidden || item.alpha === 0) return;
    const body = !!item.mesh && this.vehicles.drawable(item.mesh.assetId);
    // A mesh body's shadow belongs to the drawn body: sprite fallbacks have one baked in.
    const shadow = shadows && (body || item.gpuShadow?.casterId === undefined) && item.gpuShadow;
    if (shadow) this.blobs.push(shadow, this.supportUnder(shadow, item.zOffset));
    if (body) {
      cars.push(item);
      return;
    }
    const sheet = this.images.sheet(item.sheetKey);
    if (sheet) this.billboards.push(actorBillboard(item, sheet.sheet, sheet.texture, eye, ready));
  }

  /** The collector resolves support without surface queries here, so a body above the
   * terrain also checks the static decks and ramps under it. */
  private supportUnder(shadow: { x: number; y: number; support: number }, z: number): number {
    if (z - shadow.support < 0.5) return shadow.support;
    if (!this.surfaces) {
      this.surfaces = [];
      for (const chunk of this.chunks.values())
        if (chunk.props) this.surfaces.push(...chunk.props.surfaces);
    }
    let support = shadow.support;
    for (const surface of this.surfaces) {
      const height = surfaceUnder(surface, shadow.x, shadow.y, z + 1);
      if (height !== undefined && height > support) support = height;
    }
    return support;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dropChunks();
    this.disposeRoom();
    this.billboards.dispose();
    this.cards.dispose();
    this.blobs.dispose();
    this.sun.dispose();
    this.propMeshes.dispose();
    this.vehicles.dispose();
    this.images.dispose();
    this.flatMaterial.dispose();
  }
}
