import type { SeatCommand } from "../../input/SeatComposer.js";
import { devicePacket } from "../../input/SeatComposer.js";
import type { GameServer } from "../GameServer.js";
import { type PlayerSession, seatSessionId } from "../PlayerSession.js";
import { MemoryConnections } from "./MemoryConnections.js";
import { memoryServer } from "./MemoryServer.js";

// Device seats (226) end to end on `memoryServer`, every message through the binary codec.

const servers: GameServer[] = [];

/** Destroy every server `start` made; call from `afterEach`. */
export async function stopDevices(): Promise<void> {
  for (const server of servers.splice(0)) await server.destroy();
}

/** A server whose "local" device connection has joined the test world. */
export async function start(options?: { worlds?: readonly string[] }) {
  const { server, transport } = await memoryServer(new MemoryConnections(), options);
  servers.push(server);
  return { server, transport, host: server.getLocalSession() };
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
