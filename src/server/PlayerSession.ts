import type { Entity } from "../entities/Entity.js";
import type { ChunkRange } from "../world/ChunkManager.js";

/**
 * Mutable session state for a single player's gameplay (gems, knockback, invincibility).
 */
export interface GameplaySession {
  player: Entity;
  gemsCollected: number;
  invincibilityTimer: number;
  knockbackVx: number;
  knockbackVy: number;
}

export class PlayerSession {
  readonly clientId: string;
  player: Entity;
  editorEnabled = true;

  /** Latest input from client (consumed each tick). */
  latestInput: { dx: number; dy: number; sprinting: boolean } | null = null;

  /** Gameplay state (gems, invincibility, knockback). */
  gameplaySession: GameplaySession;

  /** Visible chunk range (set by client each frame, used by spawners). */
  visibleRange: ChunkRange = { minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 };

  /** Camera position (set by client, used for save meta). */
  cameraX = 0;
  cameraY = 0;
  cameraZoom = 1;

  /** Debug state (set by client). */
  debugPaused = false;
  debugNoclip = false;

  constructor(clientId: string, player: Entity) {
    this.clientId = clientId;
    this.player = player;
    this.gameplaySession = {
      player,
      gemsCollected: 0,
      invincibilityTimer: 0,
      knockbackVx: 0,
      knockbackVy: 0,
    };
  }
}
