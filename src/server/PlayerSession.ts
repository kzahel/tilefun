import type { Entity } from "../entities/Entity.js";
import { type ControlCommand, PlayerControls } from "../physics/PlayerControls.js";
import { SEAT_SEPARATOR } from "../transport/Transport.js";
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
  /** Supported pose saved away from the water surface, including bridge height. */
  lastSafePosition: { wx: number; wy: number; wz?: number } | null;
}

/** A seat's session id (226): seat 0 is the bare connection id, so single-player is unchanged. */
export function seatSessionId(connectionId: string, seat: number): string {
  return seat === 0 ? connectionId : `${connectionId}${SEAT_SEPARATOR}${seat}`;
}

/** The connection and seat a session id addresses; an id without a seat suffix is seat 0. */
export function seatAddress(sessionId: string): { connectionId: string; seat: number } {
  const match = /^(.+)#([1-9]\d*)$/.exec(sessionId);
  return match?.[1] && match[2]
    ? { connectionId: match[1], seat: Number(match[2]) }
    : { connectionId: sessionId, seat: 0 };
}

export class PlayerSession {
  /** The session's address: its connection's id for seat 0, `connection#seat` for other seats. */
  readonly clientId: string;
  /** The device connection this seat plays on; it owns the seat's transport and lifetime. */
  readonly connectionId: string;
  /** The seat on that connection; seat 0 is the connection's own player, others are its guests. */
  readonly seat: number;
  /** Player entity in the current realm. Set by Realm.addPlayer(). */
  player!: Entity;
  editorEnabled = true;

  /** Which realm this session is in (null = lobby, not in any realm). */
  realmId: string | null = null;
  returnLocation: ({ worldId: string } & import("./SafeArrival.js").Arrival) | null = null;
  transitioning = false;
  doorArrivalUntil = 0;
  doorIntent = { dx: 0, dy: 0, at: 0 };
  /** Profile takeover waits for travel to settle before detaching this session. */
  transitionDone: Promise<void> = Promise.resolve();
  identityReady: Promise<void> = Promise.resolve();
  retired = false;

  /** Queued inputs from client (drained each tick). */
  inputQueue: ControlCommand[] = [];

  /** Sequence number of the last input actually consumed in tick(). */
  lastProcessedInputSeq = 0;
  readonly controls = new PlayerControls();

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
  /**
   * A guest's saved-data key (226): its host's, by seat, pinned when the guest is first
   * seated, so a later `identify` cannot orphan its records. Null for a device's own seat.
   */
  guestKey: string | null = null;
  playerModel = "player";

  /** The key of this player's saved data and owned work: its profile, else its connection. */
  get persistId(): string {
    return this.guestKey ?? (this.profileId || this.clientId);
  }

  /** Timestamp (ms) when this session was created. */
  connectedAt = Date.now();

  /** Whether the current jump button press has been consumed (Quake's oldbuttons & BUTTON_JUMP).
   *  Set when a jump fires, cleared when jump is released. Prevents pogo-sticking. */
  jumpConsumed = false;

  /** Whether jump was held on the most recent input (used for landing-frame jump check). */
  lastJumpHeld = false;

  /** Debug state (set by client). */
  debugPaused = false;

  constructor(clientId: string, player?: Entity) {
    this.clientId = clientId;
    ({ connectionId: this.connectionId, seat: this.seat } = seatAddress(clientId));
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
