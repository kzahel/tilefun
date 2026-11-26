import * as THREE from "three";
import { requestGameSprite } from "../../assets/GameAssets.js";
import { MODERN_INTERIORS_SHEET_KEY } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { CHUNK_SIZE_PX, VIEW_BACKDROP_CSS } from "../../config/constants.js";
import type { Entity } from "../../entities/Entity.js";
import type { Prop } from "../../entities/Prop.js";
import type { Atmosphere } from "../../sky/Atmosphere.js";
import type { World } from "../../world/World.js";
import { observerInsideRoom, roomObserver } from "../collectScene.js";
import type { GpuShadow } from "../GpuShadowShape.js";
import type { OverlayDraw } from "../OverlayFrame.js";
import type { GrassItem, SpriteItem } from "../SceneItem.js";
import { SURFACE_GRID } from "../SurfacePresentation.js";
import type { PageRegion, SharedMeshAssets, SharedPages, View3dTarget } from "../View3dHost.js";
import { FirstPersonAtmosphere } from "./FirstPersonAtmosphere.js";
import {
  actorBillboard,
  MovingCards,
  PropCardBatches,
  RecentPages,
} from "./FirstPersonBillboards.js";
import { BodyImageCards } from "./FirstPersonBodyImages.js";
import { cameraRight, type FirstPersonEye } from "./FirstPersonCamera.js";
import { type HeadsetFrame, TABLE_BACKGROUND, ViewCameras } from "./FirstPersonCameras.js";
import {
  ChunkPropIndex,
  chunksInReach,
  type PropViewBounds,
  type TerrainEntry,
  terrainStale,
} from "./FirstPersonChunks.js";
import { DeckMaterials } from "./FirstPersonDecks.js";
import {
  type EffectItem,
  EffectQuads,
  emergencyLamp,
  type LampItem,
} from "./FirstPersonEffects.js";
import { type FacePart, MergedFaces } from "./FirstPersonFaces.js";
import { bladeDepth, GrassCards } from "./FirstPersonGrass.js";
import { GroundTops } from "./FirstPersonGround.js";
import { FirstPersonImages } from "./FirstPersonImages.js";
import { type FirstPersonInterior, INTERIOR_BACKGROUND } from "./FirstPersonInterior.js";
import { GROUND_NEAREST, type SunReceiver, shadeMaterial } from "./FirstPersonMaterials.js";
import {
  ART_HOLES,
  disposeGroup,
  type OverheadDeck,
  PropMeshes,
  type RoomProp,
  texturedMesh,
} from "./FirstPersonPropMeshes.js";
import { type PropSurface, surfaceUnder } from "./FirstPersonProps.js";
import { FirstPersonRoomScene } from "./FirstPersonRoomScene.js";
import { BlobShadows, DynamicShadows, plainShadow, SunShadows } from "./FirstPersonShadows.js";
import {
  DYNAMIC_EYE_RANGE,
  DYNAMIC_MAX_BODIES,
  DYNAMIC_VIEW_MARGIN,
  SUN_REACH,
} from "./FirstPersonSun.js";
import { buildTerrainChunk } from "./FirstPersonTerrain.js";
import { FirstPersonUnderlay } from "./FirstPersonUnderlay.js";
import { FirstPersonVehicles } from "./FirstPersonVehicles.js";
import { FirstPersonWildlifeMeshes } from "./FirstPersonWildlifeMeshes.js";
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
  /** With shadows, the sun's as well as contact shadows; on unless false. */
  readonly sun?: boolean | undefined;
  /** With the sun's shadows, moving bodies cast them too (266): onto the ground,
   * the static world, each other and themselves. Off unless true. */
  readonly dynamicShadows?: boolean | undefined;
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
  /** Draw registered animal models in place of their sprite cards. */
  readonly wildlifeModels?: boolean | undefined;
  /** Prototype: ground artwork sampled once per pixel, as cards are
   * (`GROUND_NEAREST`). */
  readonly groundNearest?: boolean | undefined;
  /** Grass blades as the fixed view collects them (`collectCameraGrass`), posed
   * for this frame. Drawn by the top-down camera only. */
  readonly grass?: readonly GrassItem[] | undefined;
  /** Whose view this is, for the fixed view's automatic cutaway of overhead decks:
   * the seat's body, the view's fades and the presentation time and alpha. */
  readonly cutaway?:
    | {
        readonly observer: Entity;
        readonly fades: Map<string, { opacity: number; time: number }>;
        readonly time: number;
        readonly alpha: number;
        readonly visibility?: import("../SurfacePresentation.js").SurfaceVisibility | undefined;
      }
    | undefined;
  /** No ground: the clear colour instead (a Workshop fixture without terrain). */
  readonly background?: string | undefined;
  /** Diagnostic geometry on the ground behind the world. */
  readonly underlay?: readonly OverlayDraw[] | undefined;
  /** Play's particles and surface marks for this frame (`EffectQuads`). */
  readonly effects?: readonly EffectItem[] | undefined;
  /** The sky over the view: night's tint, rain and lightning. None is a clear day. */
  readonly atmosphere?: Atmosphere | undefined;
  /**
   * A headset (252): both eyes through the session's head pose, from a room
   * placed in the world. `eye` is then the head in the world: cards turn to its
   * heading and actors show the row seen from it.
   */
  readonly headset?: HeadsetFrame | undefined;
}

const SKY = 0x9fd3f0;
const CHUNK_PX = CHUNK_SIZE_PX;
const CHUNK_BUILDS_PER_FRAME = 3;
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
  props?: { signature: string; surfaces: PropSurface[]; decks: OverheadDeck[] };
}

/** Owns a view's scene content and draws shared presentation into the render host's canvas. */
export class FirstPersonView {
  readonly stats = {
    chunks: 0,
    builds: 0,
    /** Chunks whose ground drew its artwork this frame (the rest drew flat colours). */
    groundPages: 0,
    /** Moving actor cards written this frame. */
    billboards: 0,
    wildlifeMeshes: 0,
    playerMeshes: 0,
    wildlifeModelsSelected: 0,
    /** Standing prop cards in the merged static meshes. */
    cards: 0,
    /** Contact shadows drawn this frame. */
    blobs: 0,
    /** Grass blades written this frame. */
    grass: 0,
    /** Particles and surface marks written this frame. */
    effects: 0,
    /** Sun shadow map redraws since the view was created. */
    sunRedraws: 0,
    /** World pixels per texel of this frame's dynamic shadow map; 0 while off. */
    dynamicTexel: 0,
    /** Mesh bodies and actor cards drawn into it this frame. */
    dynamicBodies: 0,
    dynamicCards: 0,
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
  private readonly scene = new THREE.Scene();
  private readonly worldRoot = new THREE.Group();
  /** One parent per kind of static content, so a kind can be hidden. */
  private readonly groundRoot = new THREE.Group();
  private readonly solidRoot = new THREE.Group();
  private readonly cardRoot = new THREE.Group();
  private readonly cameras = new ViewCameras(this.scene);
  private readonly fog = new THREE.Fog(SKY, 200, 600);
  private readonly sun = new SunShadows();
  private readonly dynamic = new DynamicShadows(this.sun.uniforms);
  private readonly atmosphere = new FirstPersonAtmosphere();
  /** The frame's mesh bodies in reach of the dynamic map, with the contact
   * shadow each keeps where the map does not show its own. */
  private readonly casters: {
    item: SpriteItem;
    /** Absent for a body without a contact shadow (boats). */
    shadow: GpuShadow | undefined;
    support: number;
    distance: number;
  }[] = [];
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
  /** Tile tops share meshes; textured cliffs use their own vertical texture plane. */
  private readonly ground = new GroundTops(
    this.groundRoot,
    this.atlas,
    this.sun.uniforms,
    SunShadows.cast,
  );
  private readonly faces = new MergedFaces();
  /** The frame's pages as cards ask for them. */
  private readonly cardPages = new RecentPages();
  private readonly billboards: MovingCards;
  /** The frame's actor cards that cast, facing the sun: drawn only into the
   * dynamic shadow map. */
  private readonly shadowCards: MovingCards;
  private readonly cards: PropCardBatches;
  private readonly blobs: BlobShadows;
  private readonly grass: GrassCards;
  private readonly effects: EffectQuads;
  private readonly underlay: FirstPersonUnderlay;
  private readonly decks = new DeckMaterials((material) => this.lit(material, "faces"));
  /** Room props' two views (tree houses), by chunk key and prop id: the top-down
   * camera shows the inside one while the frame's observer is in one of its
   * rooms, as the fixed view does (`observerInsideRoom`), each picture's pieces
   * on their planes. First person shows the volumes. */
  private readonly roomViews = new Map<
    string,
    {
      prop: Prop;
      cx: number;
      cy: number;
      solid: THREE.Group;
      outside: THREE.Group;
      inside: THREE.Group;
    }
  >();
  /** Emergency lamps of vehicles drawn as sprites this frame. */
  private readonly lamps: LampItem[] = [];
  private readonly vehicles = new FirstPersonVehicles((material) => {
    this.lit(material, "solid");
  });
  private readonly bodyImages = new BodyImageCards(this.sun.uniforms);
  private readonly wildlife = new FirstPersonWildlifeMeshes(
    this.worldRoot,
    (material) => {
      this.lit(material, "solid");
    },
    DynamicShadows.cast,
  );
  private readonly propMeshes: PropMeshes;
  private readonly chunks = new Map<string, ChunkScene>();
  private readonly images: FirstPersonImages;
  private readonly background = new THREE.Color(SKY);
  /** The host's restored-context count the sun map was last drawn under. */
  private generation = 0;
  private world: FirstPersonWorld | null = null;
  private realm: string | null | undefined;
  private propsSource: readonly Prop[] | null = null;
  private readonly propsByChunk = new ChunkPropIndex();
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
    // Top-down, an actor's rows under its standing point (its near feet) show
    // over the ground as in the fixed view; other cameras leave them under it.
    const sunk = card("actor");
    bladeDepth(sunk, 1);
    this.billboards = new MovingCards(this.worldRoot, card("actor"), sunk);
    this.shadowCards = new MovingCards(
      this.dynamic.cardRoot,
      shadeMaterial(
        new THREE.MeshBasicMaterial({
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          colorWrite: false,
          fog: false,
        }),
        { card: this.dynamic.cardRight, cardArt: this.atlas },
      ),
    );
    this.cards = new PropCardBatches(this.cardRoot, () => card("card"), this.sun, this.atlas);
    this.blobs = new BlobShadows(this.worldRoot);
    this.effects = new EffectQuads(this.worldRoot);
    this.underlay = new FirstPersonUnderlay(this.worldRoot, sheets);
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

  private lit<T extends THREE.Material>(material: T, receiver: SunReceiver): T {
    return shadeMaterial(material, { sun: { uniforms: this.sun.uniforms, receiver } });
  }

  /** Draw one frame into `target`: the host's renderer, bound to this view's region,
   * and the host's shared vehicle meshes. */
  wildlifeModelDrawn(sheetKey: string): boolean {
    return this.wildlife.drewSheet(sheetKey);
  }

  render(frame: FirstPersonFrame, target: View3dTarget): void {
    if (this.disposed) return;
    const { renderer, generation, meshes } = target;
    if (generation !== this.generation) {
      // three.js re-uploads meshes and textures itself; the cached sun map is ours.
      this.generation = generation;
      this.sun.reset();
    }
    if (frame.world !== this.world || frame.realm !== this.realm) this.resetWorld(frame);
    this.syncRoom(frame.interior, !!frame.topDown);
    if (frame.props !== this.propsSource) this.groupProps(frame.props);
    const { pages } = target;
    const topDown = frame.topDown;
    this.underlay.update(
      frame.underlay,
      frame.eye,
      topDown?.scale ?? 1,
      target.width,
      target.height,
    );
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
    const reach = frame.drawRadius + CHUNK_PX;
    this.cardPages.begin(pages);
    this.updateChunks(
      frame,
      pages,
      ground
        ? chunksInRect(grown(ground, TOP_DOWN_SIDE, TOP_DOWN_BELOW))
        : chunksInReach(centre.x, centre.y, reach),
      ground || { x: centre.x, y: centre.y, reach },
    );
    // Card changes come with their chunk's rebuild, which already told the sun.
    const cards = this.cards.prepare(this.cardPages, !!topDown);
    this.stats.cards = cards.count;
    // Room shells and furniture stay out of the sun's map: rooms have no sun.
    this.stats.merged = this.faces.flush((mesh) => {
      mesh.layers.set(0);
      if (!this.room) SunShadows.cast(mesh);
    });
    this.stats.meshes = this.faces.count + this.ground.meshes + cards.meshes;
    // A diagnostic fixture without terrain shows its plain background instead.
    this.groundRoot.visible = frame.background === undefined;
    // Outdoor fog follows the selected distance, independently of chunk arrival.
    // Without fog nothing hides far casters: the sun map's own reach decides.
    const fogEnd = fog ? frame.drawRadius : Infinity;
    this.stats.fogEnd = frame.drawRadius;
    const camera = this.cameras.place(frame, topDown, headset, target, this.fog, fogEnd);
    // Rooms have contact shadows but no sun.
    const shadows = frame.shadows !== false;
    const sunlit = shadows && frame.sun !== false && !frame.interior;
    this.dynamic.place(
      centre,
      topDown
        ? Math.hypot(target.width, target.height) / (2 * topDown.scale) + DYNAMIC_VIEW_MARGIN
        : Math.min(fogEnd, DYNAMIC_EYE_RANGE),
      sunlit && frame.dynamicShadows === true,
    );
    this.stats.dynamicTexel = this.dynamic.texel;
    GROUND_NEAREST.value = !!frame.groundNearest;
    ART_HOLES.value = !!topDown;
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
        (topDown && frame.grass) || [],
        this.sheets.get("grass-blades"),
        this.cardPages,
      );
      this.stats.grass = this.grass.count;
      this.effects.fill(frame.effects || [], this.cardRight.value, this.lamps);
      this.stats.effects = this.effects.count;
      // Read after the frame's page requests: the atlas is replaced when it grows.
      this.atlas.value = pages.atlas;
      this.swapRoomViews(frame);
      this.sun.update(
        renderer,
        this.scene,
        centre,
        fogEnd,
        sunlit,
        // Top-down: the whole view, and tall faces standing south of its ground.
        topDown ? frame.drawRadius + SUN_REACH : undefined,
      );
      this.stats.sunRedraws = this.sun.redraws;
      this.stats.dynamicBodies = 0;
      this.dynamic.draw(renderer, this.scene, (sunCamera) => {
        for (const { item } of this.casters)
          if (
            this.vehicles.drawDepth(
              renderer,
              sunCamera,
              meshes,
              item,
              !!topDown,
              this.dynamic.depth,
            )
          )
            this.stats.dynamicBodies++;
      });
      // After the sun's map: casters beyond a tabletop's edge still shade it.
      renderer.clippingPlanes = this.cameras.cutFor(headset);
      this.decks.update(this.chunks.values(), frame.cutaway, this.solidRoot);
      renderer.setClearColor(frame.background ?? this.background, 1);
      renderer.clear();
      renderer.render(this.scene, camera);
      this.stats.cars = 0;
      for (const item of cars)
        if (this.vehicles.draw(renderer, camera, meshes, item, !!topDown)) this.stats.cars++;
      this.bodyImages.draw(renderer, camera, topDown?.scale ?? 1);
      this.stats.bodyImages = this.bodyImages.count;
      this.stats.cars += this.bodyImages.count;
      this.atmosphere.draw(renderer, frame.atmosphere, target, frame.eye, topDown?.scale);
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
  }

  private dropChunks(): void {
    for (const [key, chunk] of this.chunks) this.dropChunk(key, chunk);
    this.chunks.clear();
  }

  /** Entering or leaving a room rebuilds every chunk (outdoor ground is not drawn
   * indoors). Editing the room keeps the old walls and furniture until each chunk
   * is rebuilt against the new artwork, so nothing flashes away. */
  private syncRoom(interior: FirstPersonInterior | undefined, topDown: boolean): void {
    const atlas = this.sheets.get(MODERN_INTERIORS_SHEET_KEY)?.image as
      | CanvasImageSource
      | undefined;
    // The camera is part of the key: top-down draws the fixed view's room picture.
    const key = interior && `${interior.key}|${atlas ? "art" : "plain"}|${topDown ? "top" : "eye"}`;
    if (this.room?.scene.key === key) return;
    if (this.room && interior) {
      for (const chunk of this.chunks.values()) if (chunk.props) chunk.props.signature = "\0stale";
    } else this.dropChunks();
    this.disposeRoom();
    if (!interior || !key) return;
    const scene = new FirstPersonRoomScene(interior, key, atlas, topDown);
    scene.adoptShell(this.propsSource);
    const mesh = texturedMesh(scene.floorFaces(), this.propMeshes.faceMaterial(scene.floor));
    this.worldRoot.add(mesh);
    if (topDown && !interior.shellType && scene.bands) {
      const faces = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
      scene.appendBands(() => faces);
      mesh.add(texturedMesh(faces, this.propMeshes.faceMaterial(scene.bands.texture)));
    }
    this.room = { scene, mesh };
  }

  private disposeRoom(): void {
    const room = this.room;
    if (!room) return;
    this.room = null;
    disposeGroup(room.mesh);
    for (const texture of [room.scene.floor, room.scene.walls, room.scene.bands?.texture])
      if (texture) this.propMeshes.dropMaterial(texture);
    room.scene.dispose();
  }

  /** Replicated prop lists are replaced, never mutated, so identity marks a change. */
  private groupProps(props: readonly Prop[]): void {
    this.propsSource = props;
    this.room?.scene.adoptShell(props);
    this.propsByChunk.replace(props);
  }

  /** Nearest missing or stale chunks first, a few per frame; far chunks are released.
   * Ground pages are asked for in the same order, so the host's paced uploads
   * reach the nearest ground first. */
  private updateChunks(
    frame: FirstPersonFrame,
    pages: SharedPages,
    wanted: readonly { cx: number; cy: number; key: string; distance: number }[],
    view: PropViewBounds,
  ): void {
    const keep = new Set<string>();
    let builds = 0;
    let groundPages = 0;
    for (const { cx, cy, key } of wanted) {
      keep.add(key);
      if (builds < CHUNK_BUILDS_PER_FRAME) builds += this.refreshChunk(frame.world, cx, cy, key);
      const ground = this.chunks.get(key)?.terrain;
      if (ground && this.pageGround(key, ground, pages)) groundPages++;
    }
    // A thicket row can span several chunks beyond its anchor. Keep a streamed
    // owner's props when its artwork reaches this view, without expanding the
    // terrain work for every viewport.
    for (const { key, cx, cy } of this.propsByChunk.overhanging(view, keep)) {
      keep.add(key);
      if (builds < CHUNK_BUILDS_PER_FRAME)
        builds += this.refreshChunk(frame.world, cx, cy, key, false);
    }
    this.stats.groundPages = groundPages;
    for (const [key, chunk] of this.chunks)
      if (!keep.has(key)) {
        this.dropChunk(key, chunk);
        this.chunks.delete(key);
      }
    this.stats.chunks = this.chunks.size;
    this.stats.builds = builds;
  }

  /** Rebuild a loaded chunk's stale ground or props; returns the number of builds. */
  private refreshChunk(
    world: FirstPersonWorld,
    cx: number,
    cy: number,
    key: string,
    ground = true,
  ): number {
    const chunk = ground ? world.getChunkIfLoaded(cx, cy) : undefined;
    let scene = this.chunks.get(key);
    if (!scene) {
      if (!chunk && !this.propsByChunk.get(key)) return 0;
      scene = { cx, cy };
      this.chunks.set(key, scene);
    }
    let builds = 0;
    const heightAt = (tx: number, ty: number) => world.getHeightAt(tx, ty);
    const area = `${Math.floor(cx / FACE_AREA_CHUNKS)},${Math.floor(cy / FACE_AREA_CHUNKS)}`;
    if (!this.room && chunk && terrainStale(scene.terrain, chunk)) {
      const { tops, cliffs, walls } = buildTerrainChunk(chunk, cx, cy, heightAt);
      this.ground.set(key, tops, cliffs);
      this.faces.replace(`${key}:walls`, [
        { bucket: `walls:${area}`, material: this.flatMaterial, parent: this.groundRoot, ...walls },
      ]);
      scene.terrain = { chunk, key: `${chunk.revision}:${chunk.visualRevision}`, page: undefined };
      builds++;
    }
    const { props, signature } = this.propsByChunk.get(key) ?? { props: [], signature: "" };
    if (scene.props?.signature !== signature) {
      const built = this.propMeshes.build(props, heightAt, this.room?.scene);
      const parts = this.propMeshes.faceParts(
        built,
        area,
        this.solidRoot,
        this.flatMaterial,
        this.gridMaterial,
        this.decks,
      );
      this.dropRoomViews(key);
      for (const room of built.rooms) parts.push(...this.roomViewParts(key, cx, cy, room));
      this.faces.replace(`${key}:props`, parts);
      scene.props = { signature, surfaces: built.surfaces, decks: built.decks };
      this.cards.set(key, built, this.cardPages);
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

  /** A room prop's two views as faces under groups of their own (`roomViews`). */
  private roomViewParts(key: string, cx: number, cy: number, room: RoomProp): FacePart[] {
    const solid = new THREE.Group(),
      outside = new THREE.Group(),
      inside = new THREE.Group();
    outside.visible = inside.visible = false;
    this.solidRoot.add(solid, outside, inside);
    const id = `${key}:${room.prop.id}`;
    this.roomViews.set(id, { prop: room.prop, cx, cy, solid, outside, inside });
    const parts: FacePart[] = [];
    for (const [view, faces, parent] of [
      ["solid", room.solid, solid],
      ["outside", room.outside, outside],
      ["inside", room.inside, inside],
    ] as const) {
      if (faces.flat)
        parts.push({
          bucket: `room:${id}:${view}`,
          material: this.flatMaterial,
          parent,
          ...faces.flat,
        });
      for (const [texture, textured] of faces.textured)
        parts.push({
          bucket: `room:${id}:${view}:${texture.uuid}`,
          material: this.propMeshes.faceMaterial(texture),
          parent,
          ...textured,
        });
    }
    return parts;
  }

  private dropRoomViews(key: string): void {
    for (const [id, room] of this.roomViews)
      if (id.startsWith(`${key}:`)) {
        room.solid.removeFromParent();
        room.outside.removeFromParent();
        room.inside.removeFromParent();
        this.roomViews.delete(id);
      }
  }

  /** Volumes in first person; top-down, the inside picture while the frame's
   * observer is in the prop's room and the outside one otherwise. */
  private swapRoomViews(frame: FirstPersonFrame): void {
    if (!this.roomViews.size) return;
    const topDown = !!frame.topDown;
    const cutaway = topDown ? frame.cutaway : undefined;
    const observer = cutaway && roomObserver(cutaway.observer, cutaway.alpha);
    for (const room of this.roomViews.values()) {
      const inside = !!observer && observerInsideRoom(room.prop, observer);
      const shown = !topDown ? room.solid : inside ? room.inside : room.outside;
      if (shown.visible) continue;
      for (const group of [room.solid, room.outside, room.inside]) group.visible = group === shown;
      // Each form casts its own shadow.
      this.sun.invalidate(room.cx, room.cy);
    }
  }

  private dropChunk(key: string, chunk: ChunkScene): void {
    this.dropRoomViews(key);
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
    this.billboards.begin(topDown);
    this.shadowCards.begin();
    this.casters.length = 0;
    this.wildlife.begin(frame.wildlifeModels !== false, topDown);
    this.blobs.begin();
    this.lamps.length = 0;
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
    this.shadowCards.end();
    this.stats.dynamicCards = this.shadowCards.count;
    this.stats.wildlifeMeshes = this.wildlife.end();
    this.stats.playerMeshes = this.wildlife.playersDrawn;
    this.stats.wildlifeModelsSelected = this.wildlife.selected;
    // The nearest mesh bodies cast into the dynamic map; each keeps as much of
    // its contact shadow as the map's fade leaves out, and the rest all of it.
    const { casters } = this;
    if (casters.length > DYNAMIC_MAX_BODIES) casters.sort((a, b) => a.distance - b.distance);
    for (const [index, { shadow, support }] of casters.entries())
      if (shadow)
        this.blobs.push(
          shadow,
          support,
          index < DYNAMIC_MAX_BODIES ? 1 - this.dynamic.strength(shadow.x, shadow.y) : 1,
        );
    if (casters.length > DYNAMIC_MAX_BODIES) casters.length = DYNAMIC_MAX_BODIES;
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
      !!item.mesh &&
      this.vehicles.drawable(meshes, item.mesh.assetId)
    );
  }

  /** Pending models wait for their first draw. Without `cars`, an image of the
   * actor's group already shows it. */
  private queueActor(
    item: SpriteItem,
    eye: FirstPersonEye | "south",
    meshes: SharedMeshAssets,
    cars: SpriteItem[] | undefined,
    shadows: boolean,
  ): void {
    if (item.flashHidden || item.alpha === 0) return;
    const body = !!item.mesh && this.vehicles.drawable(meshes, item.mesh.assetId);
    // A mesh body's shadow belongs to the drawn body: sprite fallbacks have one baked in.
    const shadow =
      shadows &&
      ((body || item.gpuShadow?.casterId === undefined) && item.gpuShadow
        ? item.gpuShadow
        : plainShadow(item));
    let support = 0;
    if (shadow) {
      support = this.supportUnder(shadow, item.zOffset);
      const roof = item.meshRoofSupport;
      if (
        eye === "south" &&
        roof &&
        meshes.ready.has(roof.assetId) &&
        Math.abs(support - item.zOffset) < 0.5
      )
        support -= roof.topDownHeightDelta ?? 0;
    }
    if (body && item.mesh) {
      // Every drawn mesh casts into the dynamic map, with or without a contact
      // shadow of its own (boats have none on water).
      if (shadows && this.dynamic.reaches(item.wx, item.wy, item.zOffset, item.mesh.radius))
        this.casters.push({
          item,
          shadow: shadow || undefined,
          support,
          distance: this.dynamic.distance(item.wx, item.wy),
        });
      else if (shadow) this.blobs.push(shadow, support);
      cars?.push(item);
      return;
    }
    // A sprite casts only where the collector gives it a shadow.
    const pending = item.mesh && meshes.pending?.(item.mesh.assetId);
    const model = !pending && cars ? this.wildlife.push(item) : "sprite";
    if (model === "unavailable") return;
    const dynamic = !!shadow && this.dynamic.texel > 0;
    let cast = model === "drawn" && dynamic;
    if (!pending && model === "sprite" && (cars || dynamic)) {
      const sheet = this.images.sheet(item.sheetKey);
      if (sheet) {
        const card = actorBillboard(item, sheet, eye, meshes.ready, this.room?.scene.topDown);
        if (cars) {
          this.billboards.push(card, this.cardPages);
          const lamp = emergencyLamp(item);
          if (lamp) this.lamps.push(lamp);
        }
        // Without `cars` the card is only its shadow: the image shows the actor.
        cast =
          dynamic &&
          this.dynamic.reaches(card.x, card.y, card.z, Math.max(card.width, card.height)) &&
          this.shadowCards.push(card, this.cardPages);
      } else if (cars) void requestGameSprite(this.sheets, item.sheetKey);
    }
    if (shadow)
      this.blobs.push(shadow, support, cast ? 1 - this.dynamic.strength(shadow.x, shadow.y) : 1);
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
    this.shadowCards.dispose();
    this.dynamic.dispose();
    this.cards.dispose();
    this.ground.dispose();
    this.faces.dispose();
    this.blobs.dispose();
    this.effects.dispose();
    this.underlay.dispose();
    this.decks.dispose();
    this.grass.dispose();
    this.sun.dispose();
    this.propMeshes.dispose();
    this.vehicles.dispose();
    this.wildlife.dispose();
    this.bodyImages.dispose();
    this.atmosphere.dispose();
    this.cameras.dispose();
    this.images.dispose();
    this.flatMaterial.dispose();
    this.gridMaterial.dispose();
  }
}
