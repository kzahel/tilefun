import * as THREE from "three";
import { MODERN_INTERIORS_SHEET_KEY } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { CHUNK_SIZE_PX, VIEW_BACKDROP_CSS } from "../../config/constants.js";
import type { Prop } from "../../entities/Prop.js";
import type { World } from "../../world/World.js";
import type { GrassItem, SpriteItem } from "../SceneItem.js";
import { SURFACE_GRID } from "../SurfacePresentation.js";
import type { PageRegion, SharedMeshAssets, SharedPages, View3dTarget } from "../View3dHost.js";
import { actorBillboard, MovingCards, RecentPages, StaticCards } from "./FirstPersonBillboards.js";
import { BodyImageCards } from "./FirstPersonBodyImages.js";
import { cameraRight, type FirstPersonEye, nextFogEnd } from "./FirstPersonCamera.js";
import { type HeadsetFrame, TABLE_BACKGROUND, ViewCameras } from "./FirstPersonCameras.js";
import { chunkKey, chunksInReach, type TerrainEntry, terrainStale } from "./FirstPersonChunks.js";
import { type FacePart, MergedFaces } from "./FirstPersonFaces.js";
import { GrassCards } from "./FirstPersonGrass.js";
import { GroundTops } from "./FirstPersonGround.js";
import { FirstPersonImages } from "./FirstPersonImages.js";
import { type FirstPersonInterior, INTERIOR_BACKGROUND } from "./FirstPersonInterior.js";
import { GROUND_NEAREST, type SunReceiver, shadeMaterial } from "./FirstPersonMaterials.js";
import { disposeGroup, PropMeshes, texturedMesh } from "./FirstPersonPropMeshes.js";
import { type PropSurface, surfaceUnder } from "./FirstPersonProps.js";
import { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { BlobShadows, SunShadows } from "./FirstPersonShadows.js";
import { buildTerrainChunk } from "./FirstPersonTerrain.js";
import { FirstPersonVehicles } from "./FirstPersonVehicles.js";
import {
  chunksInRect,
  grown,
  obliqueGround,
  squareShows,
  type WorldRect,
} from "./ObliqueCamera.js";

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
  /**
   * Top-down play (251): draw through the fixed view's camera centred on the
   * eye's x and y, at `scale` screen pixels per world pixel. The eye's height and
   * look are not used. Cards face south, there is no fog, and chunks are kept for
   * the ground on screen instead of a radius.
   */
  readonly topDown?: { readonly scale: number } | undefined;
  /** Top-down only: vehicle bodies as the fixed view's outlined native-pixel
   * images instead of meshes at the screen's resolution; on unless false. */
  readonly pixelBodies?: boolean | undefined;
  /** Prototype: ground artwork sampled once per pixel, as cards are
   * (`GROUND_NEAREST`). */
  readonly groundNearest?: boolean | undefined;
  /** Grass blades as the fixed view collects them (`collectCameraGrass`), posed
   * for this frame. Drawn by the top-down camera only. */
  readonly grass?: readonly GrassItem[] | undefined;
  /**
   * A headset (252): both eyes through the session's head pose, from a room
   * placed in the world. `eye` is then the head in the world: cards turn to its
   * heading and actors show the row seen from it.
   */
  readonly headset?: HeadsetFrame | undefined;
}

/** Kinds of content a view draws. */
export interface SceneLayers {
  /** Ground and cliff walls. */
  ground: boolean;
  /** Props drawn as solid volumes wearing their artwork. */
  solids: boolean;
  /** Props drawn as standing cards. */
  cards: boolean;
  /** Moving actors drawn as cards. */
  actors: boolean;
  /** Authored vehicle and train meshes. */
  vehicles: boolean;
  /** Grass blades (top-down only). */
  grass: boolean;
}

const SKY = 0x9fd3f0;
const CHUNK_PX = CHUNK_SIZE_PX;
const CHUNK_BUILDS_PER_FRAME = 3;
/** The fog never closes in nearer than this while chunks arrive. */
const MIN_FOG_END = 96;
/** Top-down residency beyond the ground on screen: props reach sideways out of
 * their chunk, and tall ones south of the bottom edge stand up into the view. */
const TOP_DOWN_SIDE = 128;
const TOP_DOWN_BELOW = 512;

/** Chunks a side of the areas that flat-coloured faces (cliff walls, plain prop
 * faces) are merged over: one mesh per area, rebuilt when one of its chunks changes. */
const FACE_AREA_CHUNKS = 4;
const NO_PLANES: THREE.Plane[] = [];

/** What shows where nothing is drawn. */
function backdrop(table: boolean, interior: boolean, topDown: boolean): THREE.ColorRepresentation {
  if (table) return TABLE_BACKGROUND;
  if (interior) return INTERIOR_BACKGROUND;
  return topDown ? VIEW_BACKDROP_CSS : SKY;
}

interface ChunkGround extends TerrainEntry {
  readonly chunk: FirstPersonChunkSource;
  /** The atlas page its tops sample; undefined while they draw flat colours. */
  page: PageRegion | undefined;
}

/** What is built for a chunk. Its triangles live in the view's merged meshes. */
interface ChunkScene {
  readonly cx: number;
  readonly cy: number;
  terrain?: ChunkGround;
  props?: { signature: string; surfaces: PropSurface[] };
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
    /** Chunks whose ground drew its artwork this frame (the rest drew flat colours). */
    groundPages: 0,
    /** Moving actor cards written this frame. */
    billboards: 0,
    /** Standing prop cards in the merged static meshes. */
    cards: 0,
    /** Contact shadows drawn this frame. */
    blobs: 0,
    /** Grass blades written this frame. */
    grass: 0,
    /** Sun shadow map redraws since the view was created. */
    sunRedraws: 0,
    /** Vehicle bodies drawn, as meshes or images. */
    cars: 0,
    /** Of those, the ones drawn as the fixed view's images (top-down only). */
    bodyImages: 0,
    calls: 0,
    fogEnd: 0,
    /** Meshes the static world draws as: the ground, merged faces and cards. */
    meshes: 0,
    /** Vertices of merged faces put together again this frame. */
    merged: 0,
  };
  /** Diagnostics: kinds of content to leave out. The parity probe (251) draws
   * one kind at a time; play draws them all. */
  readonly layers: SceneLayers = {
    ground: true,
    solids: true,
    cards: true,
    actors: true,
    vehicles: true,
    grass: true,
  };
  private readonly scene = new THREE.Scene();
  private readonly worldRoot = new THREE.Group();
  /** One parent per kind of static content, so a kind can be hidden. */
  private readonly groundRoot = new THREE.Group();
  private readonly solidRoot = new THREE.Group();
  private readonly cardRoot = new THREE.Group();
  private readonly cameras = new ViewCameras(this.scene);
  private readonly fog = new THREE.Fog(SKY, 200, 600);
  private readonly sun = new SunShadows();
  /** Horizontal axis the cards are expanded along: the camera's right (game axes). */
  private readonly cardRight = { value: new THREE.Vector2(1, 0) };
  private readonly flatMaterial = this.lit(
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    "faces",
  );
  /** The fixed view's tile grid over decks, ramps and jumps (`SURFACE_GRID`):
   * one-pixel lines blended over the surface, behind anything nearer. */
  private readonly gridMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: SURFACE_GRID.opacity,
    depthWrite: false,
    toneMapped: false,
  });
  /** The host's page atlas as of this frame: ground meshes sample their chunk's
   * page, and cards their sheet's or composed image's pages. */
  private readonly atlas: { value: THREE.Texture | null } = { value: null };
  private readonly groundMaterial = shadeMaterial(
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    { sun: { uniforms: this.sun.uniforms, receiver: "faces" }, ground: this.atlas },
  );
  /** Every chunk's tile tops in one mesh; cliff walls and prop faces in a few. */
  private readonly ground = new GroundTops(this.groundRoot, this.groundMaterial);
  private readonly faces = new MergedFaces();
  /** The frame's pages as cards ask for them. */
  private readonly cardPages = new RecentPages();
  private readonly billboards: MovingCards;
  private readonly cards: StaticCards;
  private readonly blobs: BlobShadows;
  private readonly grass: GrassCards;
  private readonly vehicles = new FirstPersonVehicles((material) => {
    this.lit(material, "body");
  });
  private readonly bodyImages = new BodyImageCards(this.sun.uniforms);
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
    this.propMeshes = new PropMeshes(this.images, (material) => this.lit(material, "faces"));
    // Game axes are X east, Y south, Z up (left-handed seen from above). Mirroring
    // Y once at this boundary makes the world right-handed for Three, so east stays
    // on the right when looking north; Three flips face winding for det < 0.
    this.worldRoot.scale.set(1, -1, 1);
    this.worldRoot.add(this.groundRoot, this.solidRoot, this.cardRoot);
    this.scene.add(this.worldRoot);
    this.scene.fog = this.fog;
    // Every card reads the page atlas, so each kind of card is one material and one draw.
    const card = (receiver: SunReceiver) =>
      shadeMaterial(new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide }), {
        card: this.cardRight,
        cardArt: this.atlas,
        sun: { uniforms: this.sun.uniforms, receiver },
      });
    this.billboards = new MovingCards(this.worldRoot, card("body"));
    this.cards = new StaticCards(
      this.cardRoot,
      card("card"),
      this.sun.cardRoot,
      shadeMaterial(
        new THREE.MeshBasicMaterial({
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          colorWrite: false,
          fog: false,
        }),
        { card: this.sun.cardRight, cardArt: this.atlas },
      ),
    );
    this.blobs = new BlobShadows(this.worldRoot);
    // Blades blend (the zoom fade) and leave depth alone: see `GrassCards`.
    this.grass = new GrassCards(
      this.worldRoot,
      shadeMaterial(
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        {
          card: this.cardRight,
          cardArt: this.atlas,
          sun: { uniforms: this.sun.uniforms, receiver: "body" },
        },
      ),
    );
    this.vehicles.fog = this.fog;
  }

  /** Adds the sun's shadow to a material of the given receiver kind. */
  private lit<T extends THREE.Material>(material: T, receiver: SunReceiver): T {
    return shadeMaterial(material, { sun: { uniforms: this.sun.uniforms, receiver } });
  }

  /** Draw one frame into `target`: the host's renderer, bound to this view's region,
   * and the host's shared vehicle meshes. */
  render(frame: FirstPersonFrame, target: View3dTarget): void {
    if (this.disposed) return;
    const { renderer, generation, meshes } = target;
    if (generation !== this.generation) {
      // three.js re-uploads meshes and textures itself; the cached sun map is ours.
      this.generation = generation;
      this.sun.reset();
    }
    if (frame.world !== this.world || frame.realm !== this.realm) this.resetWorld(frame);
    this.syncRoom(frame.interior);
    if (frame.props !== this.propsSource) this.groupProps(frame.props);
    const { pages } = target;
    const topDown = frame.topDown && !frame.interior ? frame.topDown : undefined;
    const headset = topDown ? undefined : frame.headset;
    const table = headset?.table;
    const fog = frame.interior || topDown || table ? null : this.fog;
    this.scene.fog = this.vehicles.fog = fog;
    this.background.set(backdrop(!!table, !!frame.interior, !!topDown));
    const ground =
      topDown &&
      obliqueGround(
        { x: frame.eye.x, y: frame.eye.y, scale: topDown.scale },
        target.width,
        target.height,
      );
    // What is kept and shadowed centres on the eye, or on a tabletop's middle.
    const centre = table ?? frame.eye;
    this.cardPages.begin(pages);
    this.updateChunks(
      frame,
      pages,
      ground
        ? chunksInRect(grown(ground, TOP_DOWN_SIDE, TOP_DOWN_BELOW))
        : chunksInReach(centre.x, centre.y, frame.drawRadius + CHUNK_PX),
    );
    // Card changes come with their chunk's rebuild, which already told the sun.
    this.cards.keep(this.cardPages);
    this.cards.flush();
    this.stats.cards = this.cards.count;
    // Room shells and furniture stay out of the sun's map: rooms have no sun.
    this.stats.merged = this.faces.flush((mesh) => {
      mesh.layers.set(0);
      if (!this.room) SunShadows.cast(mesh);
    });
    this.stats.meshes = this.faces.count + this.ground.meshes + (this.cards.count ? 1 : 0);
    this.groundRoot.visible = this.layers.ground;
    this.solidRoot.visible = this.layers.solids;
    this.cardRoot.visible = this.layers.cards;
    // Without fog nothing hides far casters: the sun map's own reach decides.
    const fogEnd = fog ? (this.fogEnd ?? frame.drawRadius) : Infinity;
    const camera = this.cameras.place(frame, topDown, headset, target, this.fog, fogEnd);
    // Rooms have contact shadows but no sun.
    const shadows = frame.shadows !== false;
    GROUND_NEAREST.value = !!frame.groundNearest;
    // Draw calls are counted over every render of this view: vehicle images and
    // the sun map included.
    const { info } = renderer;
    info.autoReset = false;
    info.reset();
    try {
      // Vehicle images are rendered offscreen here, before anything is drawn to
      // the view's own target.
      const cars = this.fillBillboards(
        frame,
        meshes,
        shadows,
        !!topDown,
        (frame.pixelBodies !== false && ground) || undefined,
      );
      this.grass.fill(
        (topDown && this.layers.grass && frame.grass) || [],
        this.sheets.get("grass-blades"),
        this.cardPages,
      );
      this.stats.grass = this.grass.count;
      // Read after the frame's page requests: the atlas is replaced when it grows.
      this.atlas.value = pages.atlas;
      this.sun.update(renderer, this.scene, centre, fogEnd, shadows && !frame.interior);
      this.stats.sunRedraws = this.sun.redraws;
      // After the sun's map: casters beyond a tabletop's edge still shade it.
      renderer.clippingPlanes = this.cameras.cutFor(headset);
      renderer.setClearColor(this.background, 1);
      renderer.clear();
      renderer.render(this.scene, camera);
      this.stats.cars = 0;
      for (const item of cars)
        if (this.vehicles.draw(renderer, camera, meshes, item)) this.stats.cars++;
      this.bodyImages.draw(renderer, camera, topDown?.scale ?? 1);
      this.stats.bodyImages = this.bodyImages.count;
      this.stats.cars += this.bodyImages.count;
      this.stats.calls = info.render.calls;
    } finally {
      info.autoReset = true;
      renderer.clippingPlanes = NO_PLANES;
    }
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

  /** Nearest missing or stale chunks first, a few per frame; far chunks are released.
   * Ground pages are asked for in the same order, so the host's paced uploads
   * reach the nearest ground first. */
  private updateChunks(
    frame: FirstPersonFrame,
    pages: SharedPages,
    wanted: readonly { cx: number; cy: number; key: string; distance: number }[],
  ): void {
    const keep = new Set<string>();
    let builds = 0;
    let groundPages = 0;
    let nearestMissing: number | undefined;
    for (const { cx, cy, key, distance } of wanted) {
      keep.add(key);
      if (nearestMissing === undefined && !frame.world.getChunkIfLoaded(cx, cy))
        nearestMissing = distance;
      if (builds < CHUNK_BUILDS_PER_FRAME) builds += this.refreshChunk(frame.world, cx, cy, key);
      const ground = this.chunks.get(key)?.terrain;
      if (ground && this.pageGround(key, ground, pages)) groundPages++;
    }
    this.stats.groundPages = groundPages;
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
    const heightAt = (tx: number, ty: number) => world.getHeightAt(tx, ty);
    const area = `${Math.floor(cx / FACE_AREA_CHUNKS)},${Math.floor(cy / FACE_AREA_CHUNKS)}`;
    if (!this.room && terrainStale(scene.terrain, chunk)) {
      const { tops, walls } = buildTerrainChunk(chunk, cx, cy, heightAt);
      this.ground.set(key, tops);
      this.faces.replace(`${key}:walls`, [
        { bucket: `walls:${area}`, material: this.flatMaterial, parent: this.groundRoot, ...walls },
      ]);
      scene.terrain = { chunk, key: `${chunk.revision}:${chunk.visualRevision}`, page: undefined };
      builds++;
    }
    const { props, signature } = this.propsByChunk.get(key) ?? { props: [], signature: "" };
    if (scene.props?.signature !== signature) {
      const built = this.propMeshes.build(props, heightAt, this.room?.scene);
      const parent = this.solidRoot;
      const parts: FacePart[] = [];
      if (built.flat)
        parts.push({ bucket: `flat:${area}`, material: this.flatMaterial, parent, ...built.flat });
      parts.push({
        bucket: `grid:${area}`,
        material: this.gridMaterial,
        parent,
        ...built.lines,
        lines: true,
      });
      // Faces wearing the same artwork are one mesh, whichever chunks they stand in.
      for (const [texture, faces] of built.textured)
        parts.push({
          bucket: texture,
          material: this.propMeshes.faceMaterial(texture),
          parent,
          ...faces,
        });
      this.faces.replace(`${key}:props`, parts);
      scene.props = { signature, surfaces: built.surfaces };
      this.cards.set(key, built.billboards, this.cardPages);
      this.surfaces = null;
      builds++;
    }
    if (builds) this.sun.invalidate(cx, cy);
    return builds;
  }

  /** Keep the chunk's ground page resident and point its tops at it; false while
   * the chunk has none and draws its flat colours. */
  private pageGround(key: string, ground: ChunkGround, pages: SharedPages): boolean {
    const page = pages.ground(ground.chunk);
    if (page !== ground.page) {
      ground.page = page;
      this.ground.bind(key, page);
    }
    return !!page;
  }

  private dropChunk(key: string, chunk: ChunkScene): void {
    this.ground.delete(key);
    this.faces.remove(`${key}:walls`);
    this.faces.remove(`${key}:props`);
    this.cards.delete(key);
    this.surfaces = null;
    this.sun.invalidate(chunk.cx, chunk.cy);
  }

  /** Actor billboards, contact shadows and vehicle images; returns actors whose
   * authored mesh is to be drawn as a mesh. */
  private fillBillboards(
    frame: FirstPersonFrame,
    meshes: SharedMeshAssets,
    shadows: boolean,
    topDown: boolean,
    /** The ground on screen, for a top-down frame that draws vehicle images. */
    imagesIn: WorldRect | undefined,
  ): SpriteItem[] {
    // Top-down cards stand along east and show their rows as drawn (seen from the south).
    const eye = topDown ? "south" : frame.eye;
    if (topDown) this.cardRight.value.set(1, 0);
    else {
      const right = cameraRight(frame.eye.yaw);
      this.cardRight.value.set(right.x, right.y);
    }
    this.billboards.begin();
    this.blobs.begin();
    this.bodyImages.begin();
    const cars: SpriteItem[] = [];
    for (const item of frame.sprites) {
      // An image holds the whole group: the car in tow and what rides in the bed.
      // Null: the group is off screen, and nothing of it is drawn.
      const image =
        imagesIn && this.visibleBody(item, meshes)
          ? meshes.bodyImage?.(item, (radius) => squareShows(imagesIn, item, radius))
          : undefined;
      if (image) this.bodyImages.push(item, image);
      const drawn = image === undefined ? cars : undefined;
      this.queueActor(item, eye, meshes, drawn, shadows);
      if (item.towGroup) this.queueActor(item.towGroup, eye, meshes, drawn, shadows);
      for (const content of item.bedGroup?.contents ?? [])
        this.queueActor(content, eye, meshes, drawn, shadows);
    }
    this.billboards.end();
    this.blobs.end();
    this.stats.billboards = this.billboards.count;
    this.stats.blobs = this.blobs.count;
    return cars;
  }

  /** A shown actor whose authored mesh is ready and whose kind is being drawn. */
  private visibleBody(item: SpriteItem, meshes: SharedMeshAssets): boolean {
    return (
      !item.flashHidden &&
      item.alpha !== 0 &&
      this.layers.vehicles &&
      !!item.mesh &&
      this.vehicles.drawable(meshes, item.mesh.assetId)
    );
  }

  /** Ready authored meshes draw as models; loading, failed and plain actors as
   * sprites. Without `cars` only the actor's shadow is queued: an image of its
   * group already shows it. */
  private queueActor(
    item: SpriteItem,
    eye: FirstPersonEye | "south",
    meshes: SharedMeshAssets,
    cars: SpriteItem[] | undefined,
    shadows: boolean,
  ): void {
    if (item.flashHidden || item.alpha === 0) return;
    const body = !!item.mesh && this.vehicles.drawable(meshes, item.mesh.assetId);
    if (!(body ? this.layers.vehicles : this.layers.actors)) return;
    // A mesh body's shadow belongs to the drawn body: sprite fallbacks have one baked in.
    const shadow = shadows && (body || item.gpuShadow?.casterId === undefined) && item.gpuShadow;
    if (shadow) this.blobs.push(shadow, this.supportUnder(shadow, item.zOffset));
    if (!cars) return;
    if (body) {
      cars.push(item);
      return;
    }
    const sheet = this.images.sheet(item.sheetKey);
    if (sheet) this.billboards.push(actorBillboard(item, sheet, eye, meshes.ready), this.cardPages);
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
    this.ground.dispose();
    this.faces.dispose();
    this.blobs.dispose();
    this.grass.dispose();
    this.sun.dispose();
    this.propMeshes.dispose();
    this.vehicles.dispose();
    this.bodyImages.dispose();
    this.cameras.dispose();
    this.images.dispose();
    this.flatMaterial.dispose();
    this.gridMaterial.dispose();
    this.groundMaterial.dispose();
  }
}
