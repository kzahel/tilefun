import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import type { GameServer } from "../server/GameServer.js";
import type { World } from "../world/World.js";

export interface ClientStateView {
  readonly world: World;
  readonly entities: readonly Entity[];
  readonly props: readonly Prop[];
  readonly playerEntity: Entity;
  readonly gemsCollected: number;
  readonly invincibilityTimer: number;
  readonly editorEnabled: boolean;
  readonly propManager: PropManager;
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
  get propManager(): PropManager {
    return this.server.propManager;
  }
}
