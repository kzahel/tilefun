import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { ServerMessage, VehicleHornMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { PlayerSession } from "./PlayerSession.js";

const HORN_RANGE = 750;

/** A (connection, realm) replication stream (226): a connection's live seats in one realm,
 * lowest seat first. The stream goes through that first seat. */
export type ReplicationStream = readonly [PlayerSession, ...PlayerSession[]];

/** What publication needs of a realm: a stream's messages and a seat's own sync. */
interface StreamSource {
  replicate(clientId: string, others: readonly PlayerSession[]): ServerMessage[];
  syncSeat(session: PlayerSession): ServerMessage[];
}

/** One stream per connection with a live seat in the realm, each lowest seat first. */
export function replicationStreams(
  sessions: Iterable<PlayerSession>,
  live: (session: PlayerSession) => boolean,
): ReplicationStream[] {
  const byConnection = new Map<string, PlayerSession[]>();
  for (const session of sessions) {
    if (!live(session)) continue;
    const seats = byConnection.get(session.connectionId);
    if (seats) seats.push(session);
    else byConnection.set(session.connectionId, [session]);
  }
  return [...byConnection.values()].map((seats) => {
    const [first, ...rest] = seats.sort((a, b) => a.seat - b.seat);
    if (!first) throw Error("Empty replication stream");
    return [first, ...rest];
  });
}

/**
 * Horns reach each stream with a seat in range once; then, when a realm is given, each
 * stream's frame and shared sync go through its first seat, and every other seat's own
 * session sync goes in that seat's envelope.
 */
export function publishStreams(
  transport: IServerTransport,
  streams: readonly ReplicationStream[],
  horns: readonly VehicleHornMessage[],
  realm?: StreamSource,
): void {
  for (const horn of horns)
    for (const stream of streams)
      if (
        stream.some(
          (seat) =>
            Math.hypot(seat.player.position.wx - horn.wx, seat.player.position.wy - horn.wy) <
            HORN_RANGE,
        )
      )
        transport.send(stream[0].clientId, horn);
  if (!realm) return;
  for (const [address, ...others] of streams) {
    // Check before building: replication advances this connection's last-sent baseline.
    if (transport.canSend && !transport.canSend(address.clientId)) continue;
    const replicationTiming = performanceMetrics.start();
    const messages = realm.replicate(address.clientId, others);
    const seats = others.map((seat) => [seat.clientId, realm.syncSeat(seat)] as const);
    performanceMetrics.end("server.replication", replicationTiming);
    for (const msg of messages) transport.send(address.clientId, msg);
    for (const [clientId, sync] of seats) for (const msg of sync) transport.send(clientId, msg);
  }
}
