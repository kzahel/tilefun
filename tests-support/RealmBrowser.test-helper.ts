import { expect } from "vitest";
import { type GenerationRequest, resolveCreation } from "../src/generation/GenerationDescriptor.js";
import type { RoadGenParams } from "../src/generation/RoadGenerator.js";
import type { IWorldRegistry, WorldMeta, WorldType } from "../src/persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../src/persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../src/persistence/RecordPersistenceStore.js";
import { SAVE_FORMAT } from "../src/persistence/SaveFormat.js";
import { GameServer } from "../src/server/GameServer.js";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.js";
import type { ConnectionIdentity, IServerTransport } from "../src/transport/Transport.js";

// ---- Test helpers ----

/** In-memory world registry for tests. */
export class MemoryRegistry implements IWorldRegistry {
  private worlds = new Map<string, WorldMeta>();
  private nextId = 1;

  async open(): Promise<void> {}
  close(): void {}

  async listWorlds(): Promise<WorldMeta[]> {
    return [...this.worlds.values()].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  async getWorld(id: string): Promise<WorldMeta | undefined> {
    return this.worlds.get(id);
  }

  async createWorld(
    name: string,
    worldType?: WorldType,
    seed?: number,
    _roads?: RoadGenParams,
    generation?: GenerationRequest,
  ): Promise<WorldMeta> {
    const now = Date.now();
    const meta: WorldMeta = {
      saveFormat: SAVE_FORMAT,
      id: `world-${this.nextId++}`,
      name,
      createdAt: now,
      lastPlayedAt: now,
      worldType: worldType ?? "flat",
      seed: seed ?? 42,
      ...(generation ? { generation: resolveCreation(generation) } : {}),
    };
    this.worlds.set(meta.id, meta);
    return meta;
  }

  async updateLastPlayed(id: string): Promise<void> {
    const w = this.worlds.get(id);
    if (w) w.lastPlayedAt = Date.now();
  }

  async renameWorld(id: string, name: string): Promise<void> {
    const w = this.worlds.get(id);
    if (w) w.name = name;
  }

  async deleteWorld(id: string): Promise<void> {
    this.worlds.delete(id);
  }
}

/** In-memory persistence store for tests. */
export class MemoryStore extends RecordPersistenceStore {
  constructor() {
    super(new MemoryRecordStore());
  }
}

/** Multi-client server transport that collects messages per client. */
export class TestTransport implements IServerTransport {
  private messageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private connectHandler: ((clientId: string, identity?: ConnectionIdentity) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;

  /** Collected messages per clientId. */
  readonly sent = new Map<string, ServerMessage[]>();

  send(clientId: string, msg: ServerMessage): void {
    let msgs = this.sent.get(clientId);
    if (!msgs) {
      msgs = [];
      this.sent.set(clientId, msgs);
    }
    msgs.push(msg);
  }

  broadcast(msg: ServerMessage): void {
    for (const [cid] of this.sent) {
      this.send(cid, msg);
    }
  }

  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void {
    this.messageHandler = handler;
  }

  onConnect(handler: (clientId: string, identity?: ConnectionIdentity) => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandler = handler;
  }

  close(): void {}

  // ---- Test helpers ----

  /** Simulate a client connecting. */
  connect(clientId: string, identity?: ConnectionIdentity): void {
    // Ensure message list exists for this client
    if (!this.sent.has(clientId)) {
      this.sent.set(clientId, []);
    }
    this.connectHandler?.(clientId, identity);
  }

  /** Simulate a client disconnecting. */
  disconnect(clientId: string): void {
    this.disconnectHandler?.(clientId);
  }

  /** Send a client message to the server. */
  clientSend(clientId: string, msg: ClientMessage): void {
    this.messageHandler?.(clientId, msg);
  }

  /** Get all messages of a specific type sent to a client. */
  messagesOfType<T extends ServerMessage["type"]>(
    clientId: string,
    type: T,
  ): Extract<ServerMessage, { type: T }>[] {
    const msgs = this.sent.get(clientId) ?? [];
    return msgs.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }

  /** Clear collected messages for a client. */
  clearMessages(clientId: string): void {
    this.sent.set(clientId, []);
  }
}

export async function createTestSetup(
  authorizeAdmin?: (clientId: string, token?: string) => boolean,
) {
  const transport = new TestTransport();
  const registry = new MemoryRegistry();
  const stores = new Map<string, MemoryStore>();
  const createStore = (id: string) => {
    let store = stores.get(id);
    if (!store) {
      store = new MemoryStore();
      stores.set(id, store);
    }
    return store;
  };
  const server = new GameServer(transport, {
    registry,
    createStore,
    ...(authorizeAdmin ? { authorizeAdmin } : {}),
  });
  await server.init();
  return { server, transport, registry, stores, createStore };
}

export function firstMessage<T>(messages: readonly T[], label: string): T {
  const first = messages[0];
  expect(first, `expected ${label} message`).toBeDefined();
  if (!first) {
    throw new Error(`expected ${label} message`);
  }
  return first;
}

export function firstRealmId(transport: TestTransport, clientId: string): string {
  const realmList = firstMessage(transport.messagesOfType(clientId, "realm-list"), "realm-list");
  const realm = realmList.realms[0];
  expect(realm, "expected at least one realm").toBeDefined();
  if (!realm) {
    throw new Error("expected at least one realm");
  }
  return realm.id;
}

export const restoreProfile = { profileId: "indoor-player", displayName: "Indoor player" };
