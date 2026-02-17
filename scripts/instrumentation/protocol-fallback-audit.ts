import { GameServer } from "../../src/server/GameServer.ts";
import { encodeClientMessage, encodeServerMessage } from "../../src/shared/binaryCodec.ts";
import type { ClientMessage, ServerMessage } from "../../src/shared/protocol.ts";
import type { IServerTransport } from "../../src/transport/Transport.ts";

type SizeStat = { count: number; total: number; min: number; max: number };

function updateStat(map: Map<string, SizeStat>, type: string, size: number): void {
  const cur = map.get(type);
  if (!cur) {
    map.set(type, { count: 1, total: size, min: size, max: size });
    return;
  }
  cur.count += 1;
  cur.total += size;
  if (size < cur.min) cur.min = size;
  if (size > cur.max) cur.max = size;
}

class HarnessTransport implements IServerTransport {
  private onMsg: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private onConn: ((clientId: string) => void) | null = null;
  private onDisc: ((clientId: string) => void) | null = null;
  readonly clients = new Set<string>();

  readonly serverJsonStats = new Map<string, SizeStat>();
  readonly clientJsonStats = new Map<string, SizeStat>();

  send(_clientId: string, msg: ServerMessage): void {
    const buf = encodeServerMessage(msg);
    if (new Uint8Array(buf)[0] === 0xff) {
      updateStat(this.serverJsonStats, msg.type, buf.byteLength);
    }
  }

  broadcast(msg: ServerMessage): void {
    const buf = encodeServerMessage(msg);
    if (new Uint8Array(buf)[0] === 0xff) {
      for (const _ of this.clients) {
        updateStat(this.serverJsonStats, msg.type, buf.byteLength);
      }
    }
  }

  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void {
    this.onMsg = handler;
  }

  onConnect(handler: (clientId: string) => void): void {
    this.onConn = handler;
  }

  onDisconnect(handler: (clientId: string) => void): void {
    this.onDisc = handler;
  }

  close(): void {
    // no-op
  }

  triggerConnect(clientId: string): void {
    this.clients.add(clientId);
    this.onConn?.(clientId);
  }

  triggerDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    this.onDisc?.(clientId);
  }

  clientSend(clientId: string, msg: ClientMessage): void {
    const buf = encodeClientMessage(msg);
    if (new Uint8Array(buf)[0] === 0xff) {
      updateStat(this.clientJsonStats, msg.type, buf.byteLength);
    }
    this.onMsg?.(clientId, msg);
  }
}

function printStats(label: string, stats: Map<string, SizeStat>): void {
  console.log(label);
  const rows = [...stats.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [type, s] of rows) {
    const avg = s.total / s.count;
    console.log(
      `${type}\tcount=${s.count}\tavg=${avg.toFixed(1)}\tmin=${s.min}\tmax=${s.max}\ttotal=${s.total}`,
    );
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const t = new HarnessTransport();
  const s = new GameServer(t);
  s.start();

  t.triggerConnect("local");
  t.triggerConnect("peer2");
  await sleep(5);

  t.clientSend("peer2", { type: "join-realm", requestId: 1, worldId: "__default__" });
  await sleep(5);

  t.clientSend("local", { type: "set-editor-mode", enabled: false });
  t.clientSend("peer2", { type: "set-editor-mode", enabled: false });

  s.broadcasting = true;
  for (let i = 0; i < 60; i++) {
    t.clientSend("local", {
      type: "player-input",
      seq: i + 1,
      dx: 0.5,
      dy: 0,
      sprinting: false,
      jump: false,
      dtMs: 16.67,
    });
    t.clientSend("peer2", {
      type: "player-input",
      seq: i + 1,
      dx: -0.25,
      dy: 0.25,
      sprinting: false,
      jump: false,
      dtMs: 16.67,
    });
    s.tick(1 / 60);
  }

  t.clientSend("local", { type: "set-editor-mode", enabled: true });
  t.clientSend("peer2", { type: "set-editor-mode", enabled: true });
  for (let i = 0; i < 60; i++) {
    if (i % 3 === 0) {
      t.clientSend("local", {
        type: "editor-cursor",
        tileX: 10 + i,
        tileY: 20,
        editorTab: "terrain",
        brushMode: "paint",
      });
      t.clientSend("peer2", {
        type: "editor-cursor",
        tileX: 30,
        tileY: 40 + i,
        editorTab: "props",
        brushMode: "erase",
      });
    }
    s.tick(1 / 60);
  }

  for (let i = 0; i < 40; i++) {
    t.clientSend("local", {
      type: "edit-spawn",
      wx: 8 + (i % 10) * 12,
      wy: 8 + Math.floor(i / 10) * 12,
      entityType: "prop-flower-red",
    });
  }
  s.tick(1 / 60);

  printStats("SERVER_JSON_STATS", t.serverJsonStats);
  printStats("CLIENT_JSON_STATS", t.clientJsonStats);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
