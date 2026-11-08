import type { SeatCommand } from "../../input/SeatComposer.js";
import { devicePacket } from "../../input/SeatComposer.js";
import type { GameServer } from "../GameServer.js";
import { type PlayerSession, seatSessionId } from "../PlayerSession.js";
import type { RealmDirectory } from "../RealmDirectory.js";
import type { RealmTransitions } from "../RealmTransitions.js";
import { MemoryConnections } from "./MemoryConnections.js";
import { memoryServer } from "./MemoryServer.js";

// Device seats (226) end to end on `memoryServer`, every message through the binary codec.

const servers: GameServer[] = [];

/** Destroy every server `start` made; call from `afterEach`. */
export async function stopDevices(): Promise<void> {
  for (const server of servers.splice(0)) await server.destroy();
}

/** A server whose "local" device connection has joined the test world. */
export async function start(options?: Parameters<typeof memoryServer>[1]) {
  const { server, transport, stores } = await memoryServer(new MemoryConnections(), options);
  servers.push(server);
  return { server, transport, stores, host: server.getLocalSession() };
}

export type Device = Awaited<ReturnType<typeof start>>;

export function sessionOf(server: GameServer, id: string): PlayerSession | undefined {
  return [...server.getSessions()].find((session) => session.clientId === id);
}

/** Join a guest seat and return its session once the arrival settles. */
export async function join(
  { server, transport }: Device,
  seat: number,
  connection = "local",
  options: { displayName?: string; playerModel?: string } = {},
) {
  transport.send(connection, { type: "join-seat", requestId: 100 + seat, seat, ...options });
  await server.settle();
  return sessionOf(server, seatSessionId(connection, seat));
}

/** A remote device that joined the test world and plays (editor off). */
export async function remote({ server, transport }: Device, id: string) {
  transport.connect(id);
  await server.settle();
  transport.send(id, { type: "join-realm", requestId: 1, worldId: "test" });
  await server.settle();
  transport.send(id, { type: "set-editor-mode", enabled: false });
  const session = sessionOf(server, id);
  if (!session?.realmId) throw Error(`${id} did not join the world`);
  return session;
}

/**
 * Leave a guest alone in another realm. Its device travels together (226), so only a
 * transfer in progress does that; this moves the one seat through the server's transitions.
 */
export async function strand({ server }: Device, guest: PlayerSession, worldId: string) {
  const { transitions, realms } = server as unknown as {
    transitions: RealmTransitions;
    realms: RealmDirectory;
  };
  await transitions.move(guest, async () => ({
    realm: await realms.getOrCreate(worldId),
    returnLocation: null,
  }));
}

export const step = (dx: number, dy: number) => ({ dx, dy, sprinting: false, jump: false });

/** Send one device packet per tick, for sequences `from` through `to`. */
export function play(
  { server, transport }: Device,
  connection: string,
  from: number,
  to: number,
  seats: () => SeatCommand[],
) {
  for (let seq = from; seq <= to; seq++) {
    transport.send(connection, devicePacket(seq, seats()).input);
    server.tick(1 / 60);
  }
}

export const where = (session: PlayerSession) => ({ ...session.player.position });
