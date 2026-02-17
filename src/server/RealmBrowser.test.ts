import { describe, expect, it } from "vitest";
import type { IWorldRegistry, WorldMeta, WorldType } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore, SaveEntry } from "../persistence/PersistenceStore.js";
import type { ClientMessage, RealmInfo, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { GameServer } from "./GameServer.js";

// ---- Test helpers ----

/** In-memory world registry for tests. */
class MemoryRegistry implements IWorldRegistry {
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

  async createWorld(name: string, worldType?: WorldType): Promise<WorldMeta> {
    const now = Date.now();
    const meta: WorldMeta = {
      id: `world-${this.nextId++}`,
      name,
      createdAt: now,
      lastPlayedAt: now,
      worldType: worldType ?? "flat",
      seed: 42,
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
class MemoryStore implements PersistenceStore {
  private data = new Map<string, Map<string, unknown>>();
  async open(): Promise<void> {}
  close(): void {}
  async get(collection: string, key: string): Promise<unknown> {
    return this.data.get(collection)?.get(key);
  }
  async getAll(collection: string): Promise<Map<string, unknown>> {
    return this.data.get(collection) ?? new Map();
  }
  async save(entries: SaveEntry[]): Promise<void> {
    for (const e of entries) {
      let col = this.data.get(e.collection);
      if (!col) {
        col = new Map();
        this.data.set(e.collection, col);
      }
      col.set(e.key, e.value);
    }
  }
  async clear(): Promise<void> {
    this.data.clear();
  }
}

/** Multi-client server transport that collects messages per client. */
class TestTransport implements IServerTransport {
  private messageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
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

  onConnect(handler: (clientId: string) => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandler = handler;
  }

  close(): void {}

  // ---- Test helpers ----

  /** Simulate a client connecting. */
  connect(clientId: string): void {
    // Ensure message list exists for this client
    if (!this.sent.has(clientId)) {
      this.sent.set(clientId, []);
    }
    this.connectHandler?.(clientId);
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

async function createTestSetup() {
  const transport = new TestTransport();
  const registry = new MemoryRegistry();
  const server = new GameServer(transport, {
    registry,
    createStore: () => new MemoryStore(),
  });
  await server.init();
  return { server, transport, registry };
}

// ---- Tests ----

describe("Realm browser protocol", () => {
  it("local client auto-joins default realm on connect", async () => {
    const { transport } = await createTestSetup();

    // init() calls start() which registers handlers, then triggers connect for... no,
    // init doesn't trigger connect. Let's connect manually.
    transport.connect("local");
    // addPlayer is async — wait for microtask to resolve
    await new Promise((r) => setTimeout(r, 0));

    const assigned = transport.messagesOfType("local", "player-assigned");
    const worldLoaded = transport.messagesOfType("local", "world-loaded");

    expect(assigned).toHaveLength(1);
    expect(worldLoaded).toHaveLength(1);

    // Should NOT get realm-list (local client bypasses lobby)
    const realmList = transport.messagesOfType("local", "realm-list");
    expect(realmList).toHaveLength(0);
  });

  it("multiplayer client gets realm-list on connect (lobby state)", async () => {
    const { transport } = await createTestSetup();

    transport.connect("player-1");

    // Wait for async buildRealmList to resolve
    await new Promise((r) => setTimeout(r, 10));

    // Should get realm-list, NOT player-assigned or world-loaded
    const realmList = transport.messagesOfType("player-1", "realm-list");
    expect(realmList).toHaveLength(1);
    expect(realmList[0]?.realms).toBeInstanceOf(Array);
    expect(realmList[0]?.realms.length).toBeGreaterThan(0);

    const assigned = transport.messagesOfType("player-1", "player-assigned");
    const worldLoaded = transport.messagesOfType("player-1", "world-loaded");
    expect(assigned).toHaveLength(0);
    expect(worldLoaded).toHaveLength(0);
  });

  it("list-realms returns worlds with player counts", async () => {
    const { transport, registry } = await createTestSetup();

    // Create a second world
    await registry.createWorld("Second World", "flat");

    // Connect local client (joins default realm with 1 player)
    transport.connect("local");

    // A multiplayer client requests list-realms
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));
    transport.clearMessages("player-1");

    transport.clientSend("player-1", { type: "list-realms", requestId: 1 });
    await new Promise((r) => setTimeout(r, 10));

    const lists = transport.messagesOfType("player-1", "realm-list");
    expect(lists).toHaveLength(1);

    const realms = lists[0]?.realms;
    expect(realms.length).toBe(2);

    // The default realm should have 1 player (the local client)
    const defaultRealm = realms.find((r: RealmInfo) => r.playerCount > 0);
    expect(defaultRealm).toBeDefined();
    expect(defaultRealm?.playerCount).toBe(1);

    // Second world should have 0 players
    const secondRealm = realms.find((r: RealmInfo) => r.name === "Second World");
    expect(secondRealm).toBeDefined();
    expect(secondRealm?.playerCount).toBe(0);
  });

  it("join-realm moves player to realm and responds with realm-joined", async () => {
    const { transport } = await createTestSetup();

    // Connect multiplayer client (starts in lobby)
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    // Get the realm list to find a worldId
    const realmList = transport.messagesOfType("player-1", "realm-list");
    expect(realmList).toHaveLength(1);
    const worldId = realmList[0]?.realms[0]?.id;

    transport.clearMessages("player-1");

    // Join the realm
    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId });
    await new Promise((r) => setTimeout(r, 10));

    // Should get player-assigned + realm-joined
    const assigned = transport.messagesOfType("player-1", "player-assigned");
    expect(assigned).toHaveLength(1);
    expect(assigned[0]?.entityId).toBeGreaterThan(0);

    const joined = transport.messagesOfType("player-1", "realm-joined");
    expect(joined).toHaveLength(1);
    expect(joined[0]?.requestId).toBe(1);
    expect(joined[0]?.cameraX).toBeDefined();
    expect(joined[0]?.cameraY).toBeDefined();
    expect(joined[0]?.cameraZoom).toBeDefined();
  });

  it("join-realm broadcasts realm-player-count", async () => {
    const { transport } = await createTestSetup();

    // Connect two multiplayer clients
    transport.connect("player-1");
    transport.connect("player-2");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = transport.messagesOfType("player-1", "realm-list")[0]?.realms[0]?.id;

    // Player 1 joins
    transport.clearMessages("player-1");
    transport.clearMessages("player-2");

    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId });
    await new Promise((r) => setTimeout(r, 10));

    // Both players should receive realm-player-count
    const counts1 = transport.messagesOfType("player-1", "realm-player-count");
    const counts2 = transport.messagesOfType("player-2", "realm-player-count");

    expect(counts1.length).toBeGreaterThanOrEqual(1);
    expect(counts2.length).toBeGreaterThanOrEqual(1);

    // The count for the joined realm should be 1
    const latest1 = counts1.find((m) => m.worldId === worldId);
    expect(latest1).toBeDefined();
    expect(latest1?.count).toBe(1);
  });

  it("leave-realm removes player from realm", async () => {
    const { transport } = await createTestSetup();

    // Connect and join a realm
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = transport.messagesOfType("player-1", "realm-list")[0]?.realms[0]?.id;
    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId });
    await new Promise((r) => setTimeout(r, 10));

    transport.clearMessages("player-1");

    // Leave the realm
    transport.clientSend("player-1", { type: "leave-realm", requestId: 2 });

    const left = transport.messagesOfType("player-1", "realm-left");
    expect(left).toHaveLength(1);
    expect(left[0]?.requestId).toBe(2);

    // After leaving, list-realms should show 0 players
    transport.clearMessages("player-1");
    transport.clientSend("player-1", { type: "list-realms", requestId: 3 });
    await new Promise((r) => setTimeout(r, 10));

    const lists = transport.messagesOfType("player-1", "realm-list");
    const realm = lists[0]?.realms.find((r: RealmInfo) => r.id === worldId);
    expect(realm?.playerCount).toBe(0);
  });

  it("leave-realm broadcasts realm-player-count", async () => {
    const { transport } = await createTestSetup();

    // Connect two clients, both join the same realm
    transport.connect("player-1");
    transport.connect("player-2");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = transport.messagesOfType("player-1", "realm-list")[0]?.realms[0]?.id;
    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId });
    transport.clientSend("player-2", { type: "join-realm", requestId: 1, worldId });
    await new Promise((r) => setTimeout(r, 10));

    transport.clearMessages("player-1");
    transport.clearMessages("player-2");

    // Player 1 leaves
    transport.clientSend("player-1", { type: "leave-realm", requestId: 2 });

    // Player 2 should get a count update showing 1 player
    const counts2 = transport.messagesOfType("player-2", "realm-player-count");
    const update = counts2.find((m) => m.worldId === worldId);
    expect(update).toBeDefined();
    expect(update?.count).toBe(1);
  });

  it("realm-scoped messages are ignored while in lobby", async () => {
    const { transport } = await createTestSetup();

    // Connect multiplayer client (in lobby, no realm)
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    // Try sending a realm-scoped message — should be silently ignored
    transport.clientSend("player-1", {
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });

    // No crash, no error — just verify the server is still functional
    transport.clearMessages("player-1");
    transport.clientSend("player-1", { type: "list-realms", requestId: 1 });
    await new Promise((r) => setTimeout(r, 10));

    const lists = transport.messagesOfType("player-1", "realm-list");
    expect(lists).toHaveLength(1);
  });

  it("joining a realm from another realm switches correctly", async () => {
    const { transport, registry } = await createTestSetup();

    // Create a second world
    const secondWorld = await registry.createWorld("Second World", "flat");

    // Connect and join first realm
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    const realmList = transport.messagesOfType("player-1", "realm-list")[0]?.realms;
    const firstWorldId = realmList.find((r: RealmInfo) => r.id !== secondWorld.id)?.id;
    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId: firstWorldId });
    await new Promise((r) => setTimeout(r, 10));

    transport.clearMessages("player-1");

    // Switch to second realm
    transport.clientSend("player-1", {
      type: "join-realm",
      requestId: 2,
      worldId: secondWorld.id,
    });
    await new Promise((r) => setTimeout(r, 10));

    // Should get new player-assigned + realm-joined
    const assigned = transport.messagesOfType("player-1", "player-assigned");
    expect(assigned).toHaveLength(1);

    const joined = transport.messagesOfType("player-1", "realm-joined");
    expect(joined).toHaveLength(1);
    expect(joined[0]?.requestId).toBe(2);

    // Verify player counts: both realms should now be at 0 and 1 respectively
    transport.clearMessages("player-1");
    transport.clientSend("player-1", { type: "list-realms", requestId: 3 });
    await new Promise((r) => setTimeout(r, 10));

    const lists = transport.messagesOfType("player-1", "realm-list");
    const first = lists[0]?.realms.find((r: RealmInfo) => r.id === firstWorldId);
    const second = lists[0]?.realms.find((r: RealmInfo) => r.id === secondWorld.id);
    expect(first?.playerCount).toBe(0);
    expect(second?.playerCount).toBe(1);
  });

  it("reconnecting multiplayer client rejoins their realm", async () => {
    const { transport } = await createTestSetup();

    // Connect and join a realm
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = transport.messagesOfType("player-1", "realm-list")[0]?.realms[0]?.id;
    transport.clientSend("player-1", { type: "join-realm", requestId: 1, worldId });
    await new Promise((r) => setTimeout(r, 10));

    // Disconnect
    transport.disconnect("player-1");

    // Reconnect within dormant period
    transport.clearMessages("player-1");
    transport.connect("player-1");

    // Should get player-assigned + world-loaded (reconnect path), NOT realm-list
    const assigned = transport.messagesOfType("player-1", "player-assigned");
    expect(assigned).toHaveLength(1);

    const worldLoaded = transport.messagesOfType("player-1", "world-loaded");
    expect(worldLoaded).toHaveLength(1);

    const realmList = transport.messagesOfType("player-1", "realm-list");
    expect(realmList).toHaveLength(0);
  });
});
