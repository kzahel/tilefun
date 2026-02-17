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
  /** Entity ID of the mount the player is riding, or null. */
  mountId: number | null;
  /** Entity ID of last dismounted mount — prevents immediate re-mount on landing. */
  lastDismountedId: number | null;
  /** Position saved while grounded on non-water. Used for water-landing respawn. */
  lastSafePosition: { wx: number; wy: number } | null;
}

export class PlayerSession {
  readonly clientId: string;
  /** Player entity in the current realm. Set by Realm.addPlayer(). */
  player!: Entity;
  editorEnabled = true;

  /** Which realm this session is in (null = lobby, not in any realm). */
  realmId: string | null = null;

  /** Queued inputs from client (drained each tick). */
  inputQueue: {
    dx: number;
    dy: number;
    sprinting: boolean;
    jump: boolean;
    jumpPressed?: boolean;
    dtMs?: number;
    seq: number;
  }[] = [];

  /** Sequence number of the last input actually consumed in tick(). */
  lastProcessedInputSeq = 0;

  /** Gameplay state (gems, invincibility, knockback). */
  gameplaySession!: GameplaySession;

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

  /** Stable profile ID for player data persistence (separate from clientId). */
  profileId: string | null = null;

  /** Timestamp (ms) when this session was created. */
  connectedAt = Date.now();

  /** Whether the current jump button press has been consumed (Quake's oldbuttons & BUTTON_JUMP).
   *  Set when a jump fires, cleared when jump is released. Prevents pogo-sticking. */
  jumpConsumed = false;

  /** Whether jump was held on the most recent input (used for landing-frame jump check). */
  lastJumpHeld = false;

  /** Debug state (set by client). */
  debugPaused = false;
  debugNoclip = false;

  constructor(clientId: string, player?: Entity) {
    this.clientId = clientId;
    if (player) {
      this.player = player;
      this.gameplaySession = {
        player,
        gemsCollected: 0,
        invincibilityTimer: 0,
        knockbackVx: 0,
        knockbackVy: 0,
        mountId: null,
        lastDismountedId: null,
        lastSafePosition: null,
      };
    }
  }
}
