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

  /** Queued inputs from client (drained each tick). */
  inputQueue: { dx: number; dy: number; sprinting: boolean; seq: number }[] = [];

  /** Sequence number of the last input actually consumed in tick(). */
  lastProcessedInputSeq = 0;

  /** Gameplay state (gems, invincibility, knockback). */
  gameplaySession: GameplaySession;

  /** Visible chunk range (set by client each frame, used by spawners). */
  visibleRange: ChunkRange = { minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 };

  /** Camera position (set by client, used for save meta). */
  cameraX = 0;
  cameraY = 0;
  cameraZoom = 1;

  /** Auto-assigned display name (e.g. "Player 1"). */
  displayName = "";

  /** Connection order number (1-based). */
  playerNumber = 0;

  /** Assigned cursor color (CSS hex color). */
  cursorColor = "#ffffff";

  /** Latest editor cursor state from client (null if not editing). */
  editorCursor: {
    tileX: number;
    tileY: number;
    editorTab: string;
    brushMode: string;
  } | null = null;

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
