import { describe, expect, it, vi } from "vitest";
import {
  createDescriptor,
  type GenerationDescriptor,
  type GenerationRequest,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import type { RoadGenParams } from "../generation/RoadGenerator.js";
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

  async createWorld(
    name: string,
    worldType?: WorldType,
    seed?: number,
    _roads?: RoadGenParams,
    generation?: GenerationRequest,
  ): Promise<WorldMeta> {
    const now = Date.now();
    const meta: WorldMeta = {
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

async function createTestSetup(authorizeAdmin?: (clientId: string, token?: string) => boolean) {
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

function firstMessage<T>(messages: readonly T[], label: string): T {
  const first = messages[0];
  expect(first, `expected ${label} message`).toBeDefined();
  if (!first) {
    throw new Error(`expected ${label} message`);
  }
  return first;
}

function firstRealmId(transport: TestTransport, clientId: string): string {
  const realmList = firstMessage(transport.messagesOfType(clientId, "realm-list"), "realm-list");
  const realm = realmList.realms[0];
  expect(realm, "expected at least one realm").toBeDefined();
  if (!realm) {
    throw new Error("expected at least one realm");
  }
  return realm.id;
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

    const realms = firstMessage(lists, "realm-list").realms;
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
    const worldId = firstRealmId(transport, "player-1");

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

    const worldId = firstRealmId(transport, "player-1");

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

    const worldId = firstRealmId(transport, "player-1");
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
    const realm = firstMessage(lists, "realm-list").realms.find((r: RealmInfo) => r.id === worldId);
    expect(realm?.playerCount).toBe(0);
  });

  it("leave-realm broadcasts realm-player-count", async () => {
    const { transport } = await createTestSetup();

    // Connect two clients, both join the same realm
    transport.connect("player-1");
    transport.connect("player-2");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = firstRealmId(transport, "player-1");
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

    const realmList = firstMessage(
      transport.messagesOfType("player-1", "realm-list"),
      "realm-list",
    ).realms;
    const firstWorld = realmList.find((r: RealmInfo) => r.id !== secondWorld.id);
    expect(firstWorld).toBeDefined();
    if (!firstWorld) throw new Error("expected first world id");
    const firstWorldId = firstWorld.id;
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
    const list = firstMessage(lists, "realm-list");
    const first = list.realms.find((r: RealmInfo) => r.id === firstWorldId);
    const second = list.realms.find((r: RealmInfo) => r.id === secondWorld.id);
    expect(first?.playerCount).toBe(0);
    expect(second?.playerCount).toBe(1);
  });

  it("reconnecting multiplayer client rejoins their realm", async () => {
    const { transport } = await createTestSetup();

    // Connect and join a realm
    transport.connect("player-1");
    await new Promise((r) => setTimeout(r, 10));

    const worldId = firstRealmId(transport, "player-1");
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

describe("versioned world creation protocol", () => {
  it("stores authoritative identity and shares a single Regional realm for concurrent joins", async () => {
    const { server, transport, registry } = await createTestSetup();
    transport.connect("one");
    transport.connect("two");
    const generation = createDescriptor("regional", 2026);
    transport.clientSend("one", {
      type: "create-world",
      requestId: 10,
      name: "Regional city",
      generation,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const created = firstMessage(transport.messagesOfType("one", "world-created"), "created");
    expect((await registry.getWorld(created.meta.id))?.generation).toEqual(generation);
    transport.clientSend("one", { type: "join-realm", requestId: 11, worldId: created.meta.id });
    transport.clientSend("two", { type: "join-realm", requestId: 12, worldId: created.meta.id });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const a = firstMessage(transport.messagesOfType("one", "realm-joined"), "one joined");
    const b = firstMessage(transport.messagesOfType("two", "realm-joined"), "two joined");
    expect(a.generation).toEqual(generation);
    expect(b.generation).toEqual(generation);
    expect([a.cameraX, a.cameraY]).toEqual([b.cameraX, b.cameraY]);
    transport.clientSend("one", { type: "list-realms", requestId: 13 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const list = transport.messagesOfType("one", "realm-list").at(-1);
    expect(list?.realms.find((realm) => realm.id === created.meta.id)).toMatchObject({
      playerCount: 2,
      generation,
    });
    server.destroy();
  });
  it("rejects unsupported descriptors explicitly without creating a fallback world", async () => {
    const { server, transport, registry } = await createTestSetup();
    transport.connect("one");
    const count = (await registry.listWorlds()).length;
    transport.clientSend("one", {
      type: "create-world",
      requestId: 20,
      name: "Bad",
      generation: {
        ...createDescriptor("regional", 2026),
        version: "future",
      } as unknown as GenerationDescriptor,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(transport.messagesOfType("one", "request-error")).toHaveLength(1);
    expect((await registry.listWorlds()).length).toBe(count);
    server.destroy();
  });
});

it("direct local consumers follow the local player into the chosen generator realm", async () => {
  const { server, transport, registry } = await createTestSetup();
  transport.connect("local");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const generation = createDescriptor("regional", 2026);
  const meta = await registry.createWorld("Regional", undefined, undefined, undefined, generation);
  await server.loadWorld(meta.id);
  expect(server.worldGeneration).toEqual(generation);
  const position = server.getLocalSession().player.position;
  expect(
    server.world.getCollision(Math.floor(position.wx / 16), Math.floor(position.wy / 16)),
  ).toBe(0);
  server.destroy();
});

it("Play here checks identity and realized walls, and live inspection preserves deletions and moves", async () => {
  const { server, transport, registry } = await createTestSetup();
  transport.connect("local");
  await new Promise((r) => setTimeout(r, 0));
  const generation = {
    type: "regional",
    version: "regional-v3",
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  const meta = await registry.createWorld("District", undefined, undefined, undefined, generation);
  await server.loadWorld(meta.id, { x: 300, y: 519, generation });
  const initial = server.getLocalSession().player.position;
  expect(Math.hypot(initial.wx / 16 - 300, initial.wy / 16 - 519)).toBeLessThanOrEqual(46);
  const props = server.propManager.props.filter((p) => p.proceduralId);
  expect(props.length).toBeGreaterThan(0);
  const building = props.find((p) => p.type.includes("apartment"));
  if (!building) throw new Error("Missing apartment");
  await server.loadWorld(meta.id, {
    x: building.position.wx / 16,
    y: (building.position.wy - 32) / 16,
    generation,
  });
  const player = server.getLocalSession().player;
  const { aabbOverlapsPropWalls, getEntityAABB } = await import("../entities/collision.js");
  const collider = player.collider;
  if (!collider) throw new Error("Missing collider");
  expect(
    aabbOverlapsPropWalls(getEntityAABB(player.position, collider), building.position, building),
  ).toBe(false);
  transport.clientSend("local", { type: "edit-delete-prop", propId: building.id });
  const moved = server.propManager.props.find((p) => p.proceduralId);
  if (!moved) throw new Error("Missing other prop");
  transport.clientSend("local", { type: "edit-move-prop", propId: moved.id, wx: 4800, wy: 8304 });
  const snapshot = await server.inspectWorld(meta.id, [{ cx: 18, cy: 32 }], {
    minX: 260,
    minY: 490,
    maxX: 350,
    maxY: 570,
  });
  expect(snapshot.coverage).toBe("live authority");
  expect(snapshot.deleted).toContain(building.proceduralId);
  expect(snapshot.props.find((p) => p.proceduralId === moved.proceduralId)).toMatchObject({
    wx: 4800,
    wy: 8304,
  });
  await expect(
    server.loadWorld(meta.id, { x: 300, y: 519, generation: createDescriptor("regional", 99) }),
  ).rejects.toThrow(/identity/);
  expect(server.worldGeneration).toEqual(generation);
  await expect(
    server.inspectWorld(meta.id, [], { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
  ).rejects.toThrow(/cap/);
  server.destroy();
});

it("building doors share persistent furnished realms and return to the right exterior", async () => {
  const { server, transport, registry, createStore } = await createTestSetup();
  transport.connect("local");
  await new Promise((r) => setTimeout(r, 0));
  const generation = {
    type: "regional",
    version: "regional-v3",
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  const meta = await registry.createWorld(
    "Home district",
    undefined,
    undefined,
    undefined,
    generation,
  );
  await server.loadWorld(meta.id, { x: 300, y: 519, generation });
  const prop = server.propManager.props.find(
    (p) => p.type.startsWith("prop-regional-apartment-") && p.proceduralId,
  );
  if (!prop?.proceduralId) throw new Error("No apartment");
  const { exteriorEntrance } = await import("../interiors/GameplayInterior.js");
  const door = exteriorEntrance(prop);
  if (!door) throw new Error("No door");
  await server.loadWorld(meta.id, { x: door.wx / 16, y: door.wy / 16, generation });
  transport.clientSend("local", {
    type: "enter-building",
    requestId: 50,
    featureId: prop.proceduralId,
  });
  await new Promise((r) => setTimeout(r, 15));
  const inside = transport.messagesOfType("local", "realm-joined").at(-1);
  expect(inside?.interior?.featureId).toBe(prop.proceduralId);
  expect(server.worldInterior?.version).toBe("interior-v1");
  transport.clientSend("local", { type: "get-world-map", requestId: 500 });
  await vi.waitFor(() => expect(transport.messagesOfType("local", "world-map")).toHaveLength(1));
  const interiorMap = transport.messagesOfType("local", "world-map")[0];
  expect(interiorMap?.worldId).toBe(meta.id);
  expect(interiorMap?.generation).toEqual(generation);
  expect(interiorMap?.players.find((p) => p.self)).toMatchObject({
    x: door.wx / 16,
    y: door.wy / 16,
    indoors: true,
  });
  const fixture = server.propManager.props.find((p) => p.proceduralId === "fixture:bed");
  if (!fixture) throw new Error("No bed");
  expect(fixture.collider?.walkableTop).toBe(true);
  expect(fixture.collider?.zHeight).toBe(8);
  transport.connect("two");
  await new Promise((r) => setTimeout(r, 0));
  transport.clientSend("two", {
    type: "join-realm",
    requestId: 51,
    worldId: meta.id,
    arrival: { x: door.wx / 16, y: door.wy / 16, generation },
  });
  await new Promise((r) => setTimeout(r, 10));
  transport.clientSend("two", {
    type: "enter-building",
    requestId: 52,
    featureId: prop.proceduralId,
  });
  await new Promise((r) => setTimeout(r, 10));
  expect(transport.messagesOfType("two", "realm-joined").at(-1)?.worldId).toBe(inside?.worldId);
  transport.clientSend("local", { type: "edit-delete-prop", propId: fixture.id });
  server.flush();
  await new Promise((r) => setTimeout(r, 0));
  transport.clientSend("local", { type: "exit-building", requestId: 53 });
  await new Promise((r) => setTimeout(r, 10));
  expect(server.worldInterior).toBeNull();
  expect(server.worldGeneration).toEqual(generation);
  expect(server.getLocalSession().player.position).toEqual(door);
  transport.clientSend("local", { type: "get-world-map", requestId: 501 });
  await vi.waitFor(() => expect(transport.messagesOfType("local", "world-map")).toHaveLength(2));
  const outsideMap = transport.messagesOfType("local", "world-map").at(-1);
  expect(outsideMap?.players).toHaveLength(2);
  expect(new Set(outsideMap?.players.map((p) => p.playerNumber)).size).toBe(2);
  expect(outsideMap?.players.find((p) => !p.self)).toMatchObject({
    x: door.wx / 16,
    y: door.wy / 16,
    indoors: true,
  });
  transport.clientSend("local", {
    type: "join-realm",
    requestId: 54,
    worldId: inside?.worldId ?? "",
  });
  await new Promise((r) => setTimeout(r, 5));
  expect(transport.messagesOfType("local", "request-error").at(-1)?.message).toMatch(/door/);
  expect(server.worldGeneration).toEqual(generation);
  expect((await server.listWorlds()).some((w) => w.id.startsWith("interior~"))).toBe(false);
  server.destroy();
  const transport2 = new TestTransport(),
    reopened = new GameServer(transport2, { registry, createStore });
  await reopened.init();
  transport2.connect("local");
  await new Promise((r) => setTimeout(r, 0));
  await reopened.loadWorld(meta.id, { x: door.wx / 16, y: door.wy / 16, generation });
  transport2.clientSend("local", {
    type: "enter-building",
    requestId: 55,
    featureId: prop.proceduralId,
  });
  await new Promise((r) => setTimeout(r, 10));
  expect(reopened.worldInterior?.featureId).toBe(prop.proceduralId);
  expect(reopened.propManager.props.some((p) => p.proceduralId === "fixture:bed")).toBe(false);
  expect(new Set(reopened.propManager.props.map((p) => p.proceduralId)).size).toBe(
    reopened.propManager.props.length,
  );
  await reopened.deleteWorld(meta.id);
  expect(reopened.worldInterior).toBeNull();
  expect((await reopened.listWorlds()).some((w) => w.id === meta.id)).toBe(false);
  expect(transport2.messagesOfType("local", "world-loaded").at(-1)?.worldId).not.toBe(meta.id);
  reopened.destroy();
});

describe("realm transition lifecycle", () => {
  it("rejects overlapping joins, loads, doors, and leave requests for one player", async () => {
    const { server, transport, registry } = await createTestSetup();
    try {
      transport.connect("one");
      const target = await registry.createWorld("Target", "flat");
      transport.clientSend("one", { type: "join-realm", requestId: 101, worldId: target.id });
      transport.clientSend("one", { type: "load-world", requestId: 102, worldId: target.id });
      transport.clientSend("one", { type: "enter-building", requestId: 103, featureId: "absent" });
      transport.clientSend("one", { type: "leave-realm", requestId: 104 });
      await vi.waitFor(() =>
        expect(transport.messagesOfType("one", "realm-joined")).toHaveLength(1),
      );
      expect(
        transport
          .messagesOfType("one", "request-error")
          .map((m) => m.requestId)
          .sort(),
      ).toEqual([102, 103, 104]);
      expect([...server.getSessions()][0]?.transitioning).toBe(false);
    } finally {
      server.destroy();
    }
  });

  it.each(["source save", "destination read", "destination save"] as const)(
    "preserves the original player and allows retry after a failed %s",
    async (failure) => {
      const { server, transport, registry, createStore } = await createTestSetup();
      try {
        transport.connect("local");
        await vi.waitFor(() => expect(server.getLocalSession().realmId).not.toBeNull());
        const session = server.getLocalSession();
        const sourceId = session.realmId ?? "";
        const target = await registry.createWorld("Target", "flat");
        await server.loadWorld(target.id);
        await server.loadWorld(sourceId);
        const player = session.player;
        const position = { ...player.position };
        const store = createStore(failure === "source save" ? sourceId : target.id);
        const spy =
          failure === "destination read"
            ? vi.spyOn(store, "get").mockRejectedValueOnce(new Error("Read failed"))
            : vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Save failed"));
        await expect(server.loadWorld(target.id)).rejects.toThrow();
        expect(session.realmId).toBe(sourceId);
        expect(session.player).toBe(player);
        expect(session.player.position).toEqual(position);
        expect(server.entityManager.entities).toContain(player);
        expect(session.transitioning).toBe(false);
        spy.mockRestore();
        await server.loadWorld(target.id);
        expect(session.realmId).toBe(target.id);
      } finally {
        server.destroy();
      }
    },
  );
});

describe("in-game world map", () => {
  it("same-world fast travel preserves unsaved progress and validates arrival before moving", async () => {
    const { server, transport, registry } = await createTestSetup(() => false);
    try {
      transport.connect("local");
      await vi.waitFor(() => expect(server.getLocalSession().realmId).not.toBeNull());
      const world = await registry.createWorld("Travel", "flat", 42);
      await server.loadWorld(world.id);
      const session = server.getLocalSession();
      session.gameplaySession.gemsCollected = 7;
      session.cameraZoom = 2;
      const generation = createDescriptor("flat", 42);
      await server.loadWorld(world.id, { x: 100, y: -200, generation });
      expect(session.gameplaySession.gemsCollected).toBe(7);
      expect(session.cameraZoom).toBe(2);
      expect(session.player.position).toEqual({ wx: 1600, wy: -3200 });
      const player = session.player;
      await expect(server.loadWorld(world.id, { x: Number.NaN, y: 0, generation })).rejects.toThrow(
        /coordinates/,
      );
      await expect(
        server.loadWorld(world.id, { x: 0, y: 0, generation: createDescriptor("flat", 99) }),
      ).rejects.toThrow(/identity/);
      expect(session.player).toBe(player);
      expect(session.player.position).toEqual({ wx: 1600, wy: -3200 });
      expect(session.gameplaySession.gemsCollected).toBe(7);
    } finally {
      server.destroy();
    }
  });
  it("returns live same-world players beyond the camera range and drops dormant/other-world players", async () => {
    const { server, transport, registry } = await createTestSetup(() => false);
    try {
      const world = await registry.createWorld("Map world", "flat", 42);
      const elsewhere = await registry.createWorld("Elsewhere", "flat", 43);
      for (const id of ["one", "two", "other"]) {
        transport.connect(id);
        transport.clientSend(id, {
          type: "join-realm",
          requestId: 1,
          worldId: id === "other" ? elsewhere.id : world.id,
        });
      }
      await vi.waitFor(() => expect([...server.getSessions()].every((s) => s.realmId)).toBe(true));
      const distant = [...server.getSessions()].find((s) => s.clientId === "two");
      if (!distant) throw new Error("Missing distant player");
      distant.player.position = { wx: 64_000, wy: -32_000 };
      transport.clientSend("one", { type: "get-world-map", requestId: 2 });
      await vi.waitFor(() => expect(transport.messagesOfType("one", "world-map")).toHaveLength(1));
      const map = firstMessage(transport.messagesOfType("one", "world-map"), "world-map");
      expect(map.worldId).toBe(world.id);
      expect(map.name).toBe("Map world");
      expect(map.generation).toEqual(createDescriptor("flat", 42));
      expect(map.players).toHaveLength(2);
      expect(map.players.filter((p) => p.self)).toHaveLength(1);
      expect(map.players.find((p) => !p.self)).toMatchObject({ x: 4000, y: -2000, indoors: false });
      distant.player.position.wx += 160;
      transport.clientSend("one", { type: "get-world-map", requestId: 3 });
      await vi.waitFor(() => expect(transport.messagesOfType("one", "world-map")).toHaveLength(2));
      expect(
        transport
          .messagesOfType("one", "world-map")
          .at(-1)
          ?.players.find((p) => !p.self)?.x,
      ).toBe(4010);
      transport.disconnect("two");
      transport.clientSend("one", { type: "get-world-map", requestId: 4 });
      await vi.waitFor(() => expect(transport.messagesOfType("one", "world-map")).toHaveLength(3));
      expect(transport.messagesOfType("one", "world-map").at(-1)?.players).toHaveLength(1);
    } finally {
      server.destroy();
    }
  });

  it("rejects lobby map requests rather than exposing an arbitrary world", async () => {
    const { server, transport } = await createTestSetup();
    try {
      transport.connect("visitor");
      transport.clientSend("visitor", { type: "get-world-map", requestId: 7 });
      await vi.waitFor(() =>
        expect(transport.messagesOfType("visitor", "request-error")).toHaveLength(1),
      );
      expect(transport.messagesOfType("visitor", "request-error")[0]).toMatchObject({
        requestId: 7,
        message: "Join a world before opening the map.",
      });
      expect(transport.messagesOfType("visitor", "world-map")).toHaveLength(0);
    } finally {
      server.destroy();
    }
  });
});

it("remote administration requires authorization while ordinary chat and realm browsing remain available", async () => {
  const { server, transport, registry } = await createTestSetup(
    (_clientId, token) => token === "secret",
  );
  try {
    transport.connect("guest");
    const before = await registry.listWorlds();
    const worldId = before[0]?.id;
    if (!worldId) throw new Error("No default world");
    for (const message of [
      { type: "create-world", requestId: 1, name: "Unauthorized" },
      { type: "rename-world", requestId: 2, worldId, name: "Unauthorized" },
      { type: "delete-world", requestId: 3, worldId },
      { type: "rcon", requestId: 4, command: "sv_speed 99" },
    ] satisfies ClientMessage[])
      transport.clientSend("guest", message);
    // Omitting requestId must never bypass authorization on a decoded JSON message.
    transport.clientSend("guest", { type: "rcon", command: "sv_speed 99" } as ClientMessage);
    expect(transport.messagesOfType("guest", "request-error")).toHaveLength(5);
    expect(await registry.listWorlds()).toEqual(before);
    expect(server.speedMultiplier).toBe(1);
    transport.clientSend("guest", { type: "rcon", requestId: 5, command: "say Hello" });
    expect(transport.messagesOfType("guest", "rcon-response").at(-1)?.output.join(" ")).toContain(
      "Hello",
    );
    transport.clientSend("guest", {
      type: "rcon",
      requestId: 6,
      command: "sv_speed 2",
      adminToken: "secret",
    });
    expect(server.speedMultiplier).toBe(2);
    transport.clientSend("guest", {
      type: "rename-world",
      requestId: 7,
      worldId,
      name: "Authorized",
      adminToken: "secret",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await registry.getWorld(worldId))?.name).toBe("Authorized");
    transport.clientSend("guest", {
      type: "create-world",
      requestId: 8,
      name: "Authorized",
      adminToken: "secret",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const created = transport.messagesOfType("guest", "world-created").at(-1)?.meta;
    expect(created).toBeDefined();
    if (!created) throw new Error("No created world");
    transport.clientSend("guest", {
      type: "delete-world",
      requestId: 9,
      worldId: created.id,
      adminToken: "secret",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await registry.getWorld(created.id)).toBeUndefined();
  } finally {
    server.destroy();
  }
});
