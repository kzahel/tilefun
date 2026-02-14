import { TILE_SIZE } from "../config/constants.js";
import type { PaintMode, SubgridShape } from "../editor/EditorMode.js";
import type { TerrainEditor } from "../editor/TerrainEditor.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import { createProp, isPropType } from "../entities/PropFactories.js";
import type { PropManager } from "../entities/PropManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { EntityHandle, PlayerHandle } from "./EntityHandle.js";
import { EventBusImpl } from "./EventBusImpl.js";
import type { PlayerSession } from "./PlayerSession.js";

// ---- Unsubscribe / Mod types ----

export type Unsubscribe = () => void;

export interface Mod {
  name: string;
  register(api: WorldAPI): Unsubscribe;
}

// ---- Service interfaces (Phase 2-3) ----

export interface TagService {
  addTag(entity: EntityHandle, tag: string): void;
  removeTag(entity: EntityHandle, tag: string): void;
  hasTag(entity: EntityHandle, tag: string): boolean;
  getTagged(tag: string): EntityHandle[];
  onTagAdded(tag: string, cb: (entity: EntityHandle) => void): Unsubscribe;
  onTagRemoved(tag: string, cb: (entity: EntityHandle) => void): Unsubscribe;
}

export interface EventBus {
  emit(event: string, data?: unknown): void;
  on(event: string, cb: (data?: unknown) => void): Unsubscribe;
  once(event: string, cb: (data?: unknown) => void): Unsubscribe;
}

export interface TickService {
  onPreSimulation(cb: (dt: number) => void): Unsubscribe;
  onPostSimulation(cb: (dt: number) => void): Unsubscribe;
}

export interface OverlapService {
  onOverlap(tag: string, cb: (self: EntityHandle, other: EntityHandle) => void): Unsubscribe;
  onOverlapEnd(tag: string, cb: (self: EntityHandle, other: EntityHandle) => void): Unsubscribe;
}

// ---- Sub-API interfaces ----

export interface TerrainAPI {
  paintTile(
    tx: number,
    ty: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number },
  ): void;
  paintSubgrid(
    gsx: number,
    gsy: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number; shape?: SubgridShape },
  ): void;
  paintCorner(
    gsx: number,
    gsy: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number },
  ): void;
  paintRoad(tx: number, ty: number, roadType: number, paintMode?: PaintMode): void;
  setElevation(tx: number, ty: number, height: number, gridSize?: number): void;
  clearAllTerrain(fillTerrainId: number): void;
  clearAllRoads(): void;
}

export interface EntityAPI {
  spawn(type: string, wx: number, wy: number): EntityHandle | null;
  remove(id: number): boolean;
  find(id: number): EntityHandle | null;
  findByType(type: string): EntityHandle[];
  findByTag(tag: string): EntityHandle[];
  findInRadius(wx: number, wy: number, radius: number): EntityHandle[];
  all(): EntityHandle[];
}

export interface PropAPI {
  place(type: string, wx: number, wy: number): PropHandle | null;
  remove(id: number): boolean;
  find(id: number): PropHandle | null;
  all(): PropHandle[];
}

export interface WorldQueryAPI {
  getTerrain(tx: number, ty: number): number;
  getCollision(tx: number, ty: number): number;
  getHeight(tx: number, ty: number): number;
  getRoad(tx: number, ty: number): number;
  isWalkable(tx: number, ty: number): boolean;
  findWalkableNear(wx: number, wy: number, maxRadius: number): { wx: number; wy: number } | null;
}

export interface PlayerAPI {
  get(): PlayerHandle | null;
  fromEntity(entity: EntityHandle): PlayerHandle | null;
}

// ---- WorldAPI interface ----

export interface WorldAPI {
  readonly terrain: TerrainAPI;
  readonly entities: EntityAPI;
  readonly props: PropAPI;
  readonly world: WorldQueryAPI;
  readonly player: PlayerAPI;
  readonly tags: TagService;
  readonly events: EventBus;
  readonly tick: TickService;
  readonly overlap: OverlapService;
  readonly time: number;
}

// ---- PropHandle ----

export class PropHandle {
  private readonly prop: Prop;
  private readonly propManager: PropManager;

  constructor(prop: Prop, propManager: PropManager) {
    this.prop = prop;
    this.propManager = propManager;
  }

  get id(): number {
    return this.prop.id;
  }
  get type(): string {
    return this.prop.type;
  }
  get wx(): number {
    return this.prop.position.wx;
  }
  get wy(): number {
    return this.prop.position.wy;
  }

  remove(): void {
    this.propManager.remove(this.prop.id);
  }

  get alive(): boolean {
    return this.propManager.props.includes(this.prop);
  }
}

// ---- Stub services (Phase 2-3 placeholders) ----

class StubTagService implements TagService {
  addTag(_entity: EntityHandle, _tag: string): void {}
  removeTag(_entity: EntityHandle, _tag: string): void {}
  hasTag(_entity: EntityHandle, _tag: string): boolean {
    return false;
  }
  getTagged(_tag: string): EntityHandle[] {
    return [];
  }
  onTagAdded(_tag: string, _cb: (entity: EntityHandle) => void): Unsubscribe {
    return () => {};
  }
  onTagRemoved(_tag: string, _cb: (entity: EntityHandle) => void): Unsubscribe {
    return () => {};
  }
}

class StubTickService implements TickService {
  onPreSimulation(_cb: (dt: number) => void): Unsubscribe {
    return () => {};
  }
  onPostSimulation(_cb: (dt: number) => void): Unsubscribe {
    return () => {};
  }
}

class StubOverlapService implements OverlapService {
  onOverlap(_tag: string, _cb: (self: EntityHandle, other: EntityHandle) => void): Unsubscribe {
    return () => {};
  }
  onOverlapEnd(_tag: string, _cb: (self: EntityHandle, other: EntityHandle) => void): Unsubscribe {
    return () => {};
  }
}

// ---- Sub-API implementations ----

class TerrainAPIImpl implements TerrainAPI {
  constructor(private readonly editor: TerrainEditor) {}

  paintTile(
    tx: number,
    ty: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number },
  ): void {
    this.editor.applyTileEdit(
      tx,
      ty,
      terrainId,
      opts?.paintMode ?? "positive",
      opts?.bridgeDepth ?? 0,
    );
  }

  paintSubgrid(
    gsx: number,
    gsy: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number; shape?: SubgridShape },
  ): void {
    this.editor.applySubgridEdit(
      gsx,
      gsy,
      terrainId,
      opts?.paintMode ?? "positive",
      opts?.bridgeDepth ?? 0,
      opts?.shape ?? 1,
    );
  }

  paintCorner(
    gsx: number,
    gsy: number,
    terrainId: number | null,
    opts?: { paintMode?: PaintMode; bridgeDepth?: number },
  ): void {
    this.editor.applyCornerEdit(
      gsx,
      gsy,
      terrainId,
      opts?.paintMode ?? "positive",
      opts?.bridgeDepth ?? 0,
    );
  }

  paintRoad(tx: number, ty: number, roadType: number, paintMode?: PaintMode): void {
    this.editor.applyRoadEdit(tx, ty, roadType, paintMode ?? "positive");
  }

  setElevation(tx: number, ty: number, height: number, gridSize?: number): void {
    this.editor.applyElevationEdit(tx, ty, height, gridSize ?? 1);
  }

  clearAllTerrain(fillTerrainId: number): void {
    this.editor.clearAllTerrain(fillTerrainId);
  }

  clearAllRoads(): void {
    this.editor.clearAllRoads();
  }
}

class EntityAPIImpl implements EntityAPI {
  constructor(private readonly em: EntityManager) {}

  spawn(type: string, wx: number, wy: number): EntityHandle | null {
    const factory = ENTITY_FACTORIES[type];
    if (!factory) return null;
    const entity = this.em.spawn(factory(wx, wy));
    return new EntityHandle(entity, this.em);
  }

  remove(id: number): boolean {
    return this.em.remove(id);
  }

  find(id: number): EntityHandle | null {
    const entity = this.em.entities.find((e) => e.id === id);
    if (!entity) return null;
    return new EntityHandle(entity, this.em);
  }

  findByType(type: string): EntityHandle[] {
    return this.em.entities.filter((e) => e.type === type).map((e) => new EntityHandle(e, this.em));
  }

  findByTag(tag: string): EntityHandle[] {
    return this.em.entities
      .filter((e) => e.tags?.has(tag))
      .map((e) => new EntityHandle(e, this.em));
  }

  findInRadius(wx: number, wy: number, radius: number): EntityHandle[] {
    const r2 = radius * radius;
    return this.em.entities
      .filter((e) => {
        const dx = e.position.wx - wx;
        const dy = e.position.wy - wy;
        return dx * dx + dy * dy <= r2;
      })
      .map((e) => new EntityHandle(e, this.em));
  }

  all(): EntityHandle[] {
    return this.em.entities.map((e) => new EntityHandle(e, this.em));
  }
}

class PropAPIImpl implements PropAPI {
  constructor(private readonly pm: PropManager) {}

  place(type: string, wx: number, wy: number): PropHandle | null {
    if (!isPropType(type)) return null;
    const prop = createProp(type, wx, wy);
    this.pm.add(prop);
    return new PropHandle(prop, this.pm);
  }

  remove(id: number): boolean {
    return this.pm.remove(id);
  }

  find(id: number): PropHandle | null {
    const prop = this.pm.props.find((p) => p.id === id);
    if (!prop) return null;
    return new PropHandle(prop, this.pm);
  }

  all(): PropHandle[] {
    return this.pm.props.map((p) => new PropHandle(p, this.pm));
  }
}

class WorldQueryAPIImpl implements WorldQueryAPI {
  constructor(private readonly w: World) {}

  getTerrain(tx: number, ty: number): number {
    return this.w.getTerrain(tx, ty);
  }

  getCollision(tx: number, ty: number): number {
    return this.w.getCollisionIfLoaded(tx, ty);
  }

  getHeight(tx: number, ty: number): number {
    return this.w.getHeightAt(tx, ty);
  }

  getRoad(tx: number, ty: number): number {
    return this.w.getRoadAt(tx, ty);
  }

  isWalkable(tx: number, ty: number): boolean {
    const flags = this.w.getCollisionIfLoaded(tx, ty);
    return (flags & (CollisionFlag.Solid | CollisionFlag.Water)) === 0;
  }

  findWalkableNear(wx: number, wy: number, maxRadius: number): { wx: number; wy: number } | null {
    const centerTx = Math.floor(wx / TILE_SIZE);
    const centerTy = Math.floor(wy / TILE_SIZE);

    if (this.isWalkable(centerTx, centerTy)) {
      return { wx, wy };
    }

    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = centerTx + dx;
          const ty = centerTy + dy;
          if (this.isWalkable(tx, ty)) {
            return {
              wx: tx * TILE_SIZE + TILE_SIZE / 2,
              wy: ty * TILE_SIZE + TILE_SIZE / 2,
            };
          }
        }
      }
    }
    return null;
  }
}

class PlayerAPIImpl implements PlayerAPI {
  constructor(
    private readonly em: EntityManager,
    private readonly getSession: () => PlayerSession | undefined,
  ) {}

  get(): PlayerHandle | null {
    const session = this.getSession();
    if (!session) return null;
    return new PlayerHandle(session.player, this.em, session.gameplaySession);
  }

  fromEntity(entity: EntityHandle): PlayerHandle | null {
    const session = this.getSession();
    if (!session) return null;
    if (entity.id !== session.player.id) return null;
    return new PlayerHandle(session.player, this.em, session.gameplaySession);
  }
}

// ---- WorldAPIImpl ----

export class WorldAPIImpl implements WorldAPI {
  readonly terrain: TerrainAPI;
  readonly entities: EntityAPI;
  readonly props: PropAPI;
  readonly world: WorldQueryAPI;
  readonly player: PlayerAPI;
  readonly tags: TagService;
  readonly events: EventBusImpl;
  readonly tick: TickService;
  readonly overlap: OverlapService;

  private elapsedTime = 0;

  constructor(
    worldObj: World,
    entityManager: EntityManager,
    propManager: PropManager,
    terrainEditor: TerrainEditor,
    getSession: () => PlayerSession | undefined,
  ) {
    this.terrain = new TerrainAPIImpl(terrainEditor);
    this.entities = new EntityAPIImpl(entityManager);
    this.props = new PropAPIImpl(propManager);
    this.world = new WorldQueryAPIImpl(worldObj);
    this.player = new PlayerAPIImpl(entityManager, getSession);
    this.tags = new StubTagService();
    this.events = new EventBusImpl();
    this.tick = new StubTickService();
    this.overlap = new StubOverlapService();
  }

  get time(): number {
    return this.elapsedTime;
  }

  advanceTime(dt: number): void {
    this.elapsedTime += dt;
  }
}
