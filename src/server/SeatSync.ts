import type { ServerMessage } from "../shared/protocol.js";
import type { PlayerSession } from "./PlayerSession.js";

/** What a seat's client last heard of its own session; sentinels force a full first send. */
export interface SeatSyncState {
  gemsCollected: number;
  /** Last observed server-side timer, used to detect invincibility starts/resets. */
  invincibilityTimer: number;
  editorEnabled: boolean;
  mountEntityId: number | null;
}

export function createSeatSyncState(): SeatSyncState {
  return {
    gemsCollected: -1,
    invincibilityTimer: -1,
    editorEnabled: false, // will differ from true default → forces first send
    mountEntityId: -2 as number | null, // impossible entity ID → forces first send
  };
}

/**
 * A seat's own session sync (226: per seat, in its envelope for guests): gems, editor mode
 * and mount when any changes, and an invincibility event on start or reset only (the
 * countdown is reconstructed client-side).
 */
export function seatSync(
  session: PlayerSession,
  state: SeatSyncState,
  tickCounter: number,
  tickRate: number,
): ServerMessage[] {
  const messages: ServerMessage[] = [];
  const gems = session.gameplaySession.gemsCollected;
  const invTimer = session.gameplaySession.invincibilityTimer;
  const currentMount = session.gameplaySession.mountId;
  const sessionDirty =
    gems !== state.gemsCollected ||
    session.editorEnabled !== state.editorEnabled ||
    currentMount !== state.mountEntityId;
  if (sessionDirty) {
    messages.push({
      type: "sync-session",
      gemsCollected: gems,
      editorEnabled: session.editorEnabled,
      mountEntityId: currentMount,
    });
    state.gemsCollected = gems;
    state.editorEnabled = session.editorEnabled;
    state.mountEntityId = currentMount;
  }

  const invincibilityStarted =
    invTimer > 0 && (state.invincibilityTimer <= 0 || invTimer > state.invincibilityTimer);
  if (invincibilityStarted) {
    messages.push({
      type: "sync-invincibility",
      startTick: tickCounter,
      durationTicks: Math.max(1, Math.ceil(invTimer * tickRate)),
    });
  }
  state.invincibilityTimer = invTimer;
  return messages;
}
