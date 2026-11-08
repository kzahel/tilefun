import { TICK_RATE } from "../config/constants.js";
import type {
  FrameMessage,
  SyncInvincibilityMessage,
  SyncSessionMessage,
} from "../shared/protocol.js";

/** A guest seat's own session sync (226), sent in its envelope with the stream. */
export type SeatSyncMessage = SyncSessionMessage | SyncInvincibilityMessage;
/** A buffered guest sync: the server's seat envelope around it. */
export type BufferedSeatSync = { type: "seat"; seat: number; message: SeatSyncMessage };

interface SeatSync {
  gemsCollected: number;
  mountEntityId: number | undefined;
  invincibility: { startTick: number; durationTicks: number };
}

/**
 * The seats a device's stream carries (226): each seat's entity from the frame seat
 * list (seat 0 alone, from `playerEntityId`, when the frame has none) and each guest's
 * own session sync. Seat 0's session sync stays on the replica itself.
 */
export class StreamSeats {
  private ids: ReadonlyMap<number, number> = new Map();
  private readonly syncs = new Map<number, SeatSync>();

  /** Seat → entity id for every seat in the latest frame. */
  get entities(): ReadonlyMap<number, number> {
    return this.ids;
  }

  frame(msg: Pick<FrameMessage, "seats" | "playerEntityId">): void {
    this.ids = new Map(msg.seats?.map((s) => [s.seat, s.entityId]) ?? [[0, msg.playerEntityId]]);
  }

  apply(seat: number, msg: SeatSyncMessage): void {
    const sync = this.syncs.get(seat) ?? {
      gemsCollected: 0,
      mountEntityId: undefined,
      invincibility: { startTick: -1, durationTicks: 0 },
    };
    if (msg.type === "sync-session") {
      sync.gemsCollected = msg.gemsCollected;
      sync.mountEntityId = msg.mountEntityId ?? undefined;
    } else sync.invincibility = { startTick: msg.startTick, durationTicks: msg.durationTicks };
    this.syncs.set(seat, sync);
  }

  /** A guest's gems, mount and remaining invincibility (seconds at `serverTick`), once synced. */
  session(seat: number, serverTick: number) {
    const sync = this.syncs.get(seat);
    if (!sync) return undefined;
    const { startTick, durationTicks } = sync.invincibility;
    const left = startTick < 0 ? 0 : durationTicks - Math.max(0, serverTick - startTick);
    return { ...sync, invincibilityTimer: Math.max(0, left) / TICK_RATE };
  }

  clear(): void {
    this.ids = new Map();
    this.syncs.clear();
  }
}
