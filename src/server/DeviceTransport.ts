import type { ClientMessage, SeatMovement, ServerMessage } from "../shared/protocol.js";
import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
import { type PlayerSession, SEAT_SEPARATOR, seatAddress } from "./PlayerSession.js";
import type { SessionRegistry } from "./SessionRegistry.js";

/** Messages that speak for the whole device, so a seat's envelope never carries one. */
const DEVICE_MESSAGES: ReadonlySet<ClientMessage["type"]> = new Set([
  "seat",
  "player-input",
  "set-debug",
  "join-seat",
  "leave-seat",
]);

type Identify = Extract<ClientMessage, { type: "identify" }>;
type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;
type Handler = (sessionId: string, msg: ClientMessage) => void;

/** Guests play under the host's profile, so a seat's `identify` names it without one. */
function withoutProfile({ profileId: _profileId, ...rest }: Identify): Identify {
  return rest;
}

/**
 * The server's transport as sessions see it (226): a seat's session id addresses its
 * device connection. Seat 0 sends and receives exactly as before; the other seats travel
 * in `seat` envelopes. One input packet per device tick feeds every seat on its sequence,
 * a device pause reaches every seat, and a connection whose seat 0 is gone or replaced
 * has no seats.
 */
export class DeviceTransport implements IServerTransport {
  constructor(
    private readonly raw: IServerTransport,
    private readonly registry: () => Pick<SessionRegistry, "seats" | "isDormant">,
  ) {}

  send(sessionId: string, msg: ServerMessage): void {
    const { connectionId, seat } = seatAddress(sessionId);
    this.raw.send(connectionId, seat === 0 ? msg : { type: "seat", seat, message: msg });
  }

  canSend(sessionId?: string): boolean {
    const connectionId = sessionId === undefined ? undefined : seatAddress(sessionId).connectionId;
    return this.raw.canSend?.(connectionId) ?? true;
  }

  broadcast(msg: ServerMessage): void {
    this.raw.broadcast(msg);
  }

  onMessage(handler: Handler): void {
    this.raw.onMessage((connectionId, msg) => {
      const seats = this.liveSeats(connectionId);
      if (seats.length) this.route(connectionId, seats, msg, handler);
    });
  }

  /** A connection id holding the seat separator could pose as another device's seat. */
  onConnect(handler: (connectionId: string, identity?: ConnectionIdentity) => void): void {
    this.raw.onConnect((connectionId, identity) => {
      if (!connectionId.includes(SEAT_SEPARATOR)) handler(connectionId, identity);
      else this.raw.send(connectionId, { type: "kicked", reason: "Invalid connection id." });
    });
  }

  /** Disconnects stay per connection; `SessionRegistry.disconnect` covers every seat. */
  onDisconnect(handler: (connectionId: string) => void): void {
    this.raw.onDisconnect(handler);
  }

  close(): void {
    this.raw.close();
  }

  /** Seat 0, then every awake guest; none while seat 0 is missing or replaced. */
  private liveSeats(connectionId: string): PlayerSession[] {
    const registry = this.registry();
    const seats = registry.seats(connectionId);
    const host = seats[0];
    if (host?.seat !== 0 || host.retired) return [];
    return seats.filter(
      (session) => session.seat === 0 || !(session.retired || registry.isDormant(session.clientId)),
    );
  }

  private route(
    connectionId: string,
    seats: readonly PlayerSession[],
    msg: ClientMessage,
    handler: Handler,
  ): void {
    const [host, ...guests] = seats;
    if (!host) return;
    if (msg.type === "player-input") deviceInput(host, guests, msg, handler);
    else if (msg.type === "set-debug") for (const session of seats) handler(session.clientId, msg);
    else if (msg.type === "seat") this.deliver(connectionId, guests, msg, handler);
    else handler(host.clientId, msg);
  }

  /** A seat's own message; a request that cannot be delivered still gets its answer. */
  private deliver(
    connectionId: string,
    guests: readonly PlayerSession[],
    { seat, message }: Extract<ClientMessage, { type: "seat" }>,
    handler: Handler,
  ): void {
    if (typeof message !== "object" || message === null) return;
    const guest = guests.find((g) => g.seat === seat);
    if (guest && !DEVICE_MESSAGES.has(message.type))
      handler(guest.clientId, message.type === "identify" ? withoutProfile(message) : message);
    else if ("requestId" in message)
      // Answer in the seat's own envelope, where its replies always arrive.
      this.raw.send(connectionId, {
        type: "seat",
        seat,
        message: {
          type: "request-error",
          requestId: message.requestId,
          message: guest
            ? "Send seat changes for the whole device."
            : "That player is not playing.",
        },
      });
  }
}

/** One sequence per device tick: a joined seat missing from the packet stands still. */
function deviceInput(
  host: PlayerSession,
  guests: readonly PlayerSession[],
  { seats: moves, ...own }: PlayerInput,
  handler: Handler,
): void {
  handler(host.clientId, own);
  for (const guest of guests) {
    const move = Array.isArray(moves) ? moves.find((m) => m?.seat === guest.seat) : undefined;
    handler(guest.clientId, seatInput(own.seq, move));
  }
}

const axis = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

/**
 * A seat's command rebuilt field by field: a seat entry is untrusted (the JSON
 * fallback carries anything), so only its controls are read, never a type or sequence.
 */
function seatInput(seq: number, move: Partial<SeatMovement> | undefined): PlayerInput {
  return {
    type: "player-input",
    seq,
    dx: axis(move?.dx),
    dy: axis(move?.dy),
    sprinting: move?.sprinting === true,
    jump: move?.jump === true,
    ...(move?.jumpPressed === true ? { jumpPressed: true } : {}),
    ...(move?.reversing === true ? { reversing: true } : {}),
    ...(move?.relativeDriving === true ? { relativeDriving: true } : {}),
  };
}
