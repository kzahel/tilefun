import type { ServerMessage } from "../shared/protocol.js";
import type { SeatSyncMessage } from "./StreamSeats.js";

type DoorMotionMessage = Extract<ServerMessage, { type: "door-motion" }>;

/** What a guest seat's message means for its device. */
export type SeatRoute =
  /** The device's own: a travel reply, a request answer or a notice. */
  | { kind: "device"; message: ServerMessage }
  /** The guest's own session sync, applied with the stream. */
  | { kind: "sync"; message: SeatSyncMessage }
  /** The guest leads the device through a door. */
  | { kind: "door"; message: DoorMotionMessage }
  /** Authority dropped the guest: only that seat goes. */
  | { kind: "left" }
  /** A copy of what seat 0 already hears, or a stream through the guest alone. */
  | { kind: "ignore" };

/**
 * Route a message from a guest's envelope (226). Party travel keeps a device's
 * live seats in one realm, so a stream through a guest alone exists only in
 * transit edge cases and is ignored: the device's replica follows seat 0's
 * stream. The switch is exhaustive so each new server message needs a decision.
 */
export function seatRoute(message: ServerMessage): SeatRoute {
  switch (message.type) {
    case "sync-session":
    case "sync-invincibility":
      return { kind: "sync", message };
    case "door-motion":
      return message.self ? { kind: "door", message } : { kind: "ignore" };
    case "kicked":
      return { kind: "left" };
    // A stream through the guest alone, its horns, and its body's announcement
    // (each seat's body comes from the frame seat list).
    case "frame":
    case "sync-room":
    case "sync-chunks":
    case "sync-props":
    case "sync-cvars":
    case "sync-player-names":
    case "sync-editor-cursors":
    case "vehicle-horn":
    case "player-assigned":
    case "seat":
      return { kind: "ignore" };
    case "world-loaded":
    case "realm-joined":
    case "realm-left":
    case "storage-status":
    case "pattern-edit-status":
    case "room-edit-status":
    case "realm-list":
    case "realm-player-count":
    case "chat":
    case "vehicle-controlled":
    case "world-map":
    case "request-error":
    case "world-created":
    case "world-deleted":
    case "world-list":
    case "world-renamed":
    case "rcon-response":
    case "player-model-set":
    case "seat-joined":
    case "seat-left":
      return { kind: "device", message };
    default:
      return message satisfies never;
  }
}
