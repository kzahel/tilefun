import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { GameServer } from "../server/GameServer.js";
import type { GameStateMessage } from "../shared/protocol.js";
import { applyChunkSnapshot, deserializeEntity, deserializeProp } from "../shared/serialization.js";
import type { World } from "../world/World.js";

export interface ClientStateView {
  readonly world: World;
  readonly entities: readonly Entity[];
  readonly props: readonly Prop[];
  readonly playerEntity: Entity;
  readonly gemsCollected: number;
  readonly invincibilityTimer: number;
  readonly editorEnabled: boolean;
}

/**
 * Local-mode state view: returns direct references to GameServer's objects.
 * Zero-copy, zero-overhead.
 */
export class LocalStateView implements ClientStateView {
  constructor(private readonly server: GameServer) {}

  get world(): World {
    return this.server.world;
  }
  get entities(): readonly Entity[] {
    return this.server.entityManager.entities;
  }
  get props(): readonly Prop[] {
    return this.server.propManager.props;
  }
  get playerEntity(): Entity {
    return this.server.getLocalSession().player;
  }
  get gemsCollected(): number {
    return this.server.getLocalSession().gameplaySession.gemsCollected;
  }
  get invincibilityTimer(): number {
    return this.server.getLocalSession().gameplaySession.invincibilityTimer;
  }
  get editorEnabled(): boolean {
    return this.server.getLocalSession().editorEnabled;
  }
}

/** Placeholder entity returned before server has sent state. */
const PLACEHOLDER_ENTITY: Entity = {
  id: -1,
  type: "player",
  position: { wx: 0, wy: 0 },
  velocity: null,
  sprite: null,
  collider: null,
  wanderAI: null,
};

/**
 * Serialized-mode state view: maintains a local copy of game state,
 * updated from ServerMessage broadcasts. All data has gone through
 * JSON serialization — no shared object references with the server.
 */
export class RemoteStateView implements ClientStateView {
  private _world: World;
  private _entities: Entity[] = [];
  private _props: Prop[] = [];
  private _playerEntityId = -1;
  private _gemsCollected = 0;
  private _invincibilityTimer = 0;
  private _editorEnabled = true;

  constructor(world: World) {
    this._world = world;
  }

  /** Apply a full game-state message from the server. */
  applyGameState(msg: GameStateMessage): void {
    this._entities = msg.entities.map(deserializeEntity);
    this._props = msg.props.map(deserializeProp);
    this._playerEntityId = msg.playerEntityId;
    this._gemsCollected = msg.gemsCollected;
    this._invincibilityTimer = msg.invincibilityTimer;
    this._editorEnabled = msg.editorEnabled;

    // Apply chunk updates (delta — only new/changed chunks)
    for (const cs of msg.chunkUpdates) {
      let chunk = this._world.chunks.get(cs.cx, cs.cy);
      if (!chunk) {
        chunk = this._world.chunks.getOrCreate(cs.cx, cs.cy);
      }
      applyChunkSnapshot(chunk, cs);
    }

    // Unload chunks the server no longer has loaded
    const loadedSet = new Set(msg.loadedChunkKeys);
    for (const [key] of this._world.chunks.entries()) {
      if (!loadedSet.has(key)) {
        this._world.chunks.remove(key);
      }
    }
  }

  /** Clear all cached state (e.g., when switching worlds). */
  clear(): void {
    this._entities = [];
    this._props = [];
    this._playerEntityId = -1;
    this._gemsCollected = 0;
    this._invincibilityTimer = 0;
    // Clear all loaded chunks
    for (const [key] of this._world.chunks.entries()) {
      this._world.chunks.remove(key);
    }
  }

  get world(): World {
    return this._world;
  }
  get entities(): readonly Entity[] {
    return this._entities;
  }
  get props(): readonly Prop[] {
    return this._props;
  }
  get playerEntity(): Entity {
    return this._entities.find((e) => e.id === this._playerEntityId) ?? PLACEHOLDER_ENTITY;
  }
  get gemsCollected(): number {
    return this._gemsCollected;
  }
  get invincibilityTimer(): number {
    return this._invincibilityTimer;
  }
  get editorEnabled(): boolean {
    return this._editorEnabled;
  }
}
