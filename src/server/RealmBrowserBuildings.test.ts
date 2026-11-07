import { expect, it, vi } from "vitest";
import {
  createTestSetup,
  restoreProfile,
  TestTransport,
} from "../../tests-support/RealmBrowser.test-helper.js";
import { CURRENT_REGIONAL_VERSION, createDescriptor } from "../generation/GenerationDescriptor.js";
import type { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { GameServer } from "./GameServer.js";

async function cityDoorSetup(building = "butcher") {
  const setup = await createTestSetup();
  const { DenseDistrictSource } = await import("../generation/regional/DenseDistrictPlanner.js");
  const { regionalWorld } = await import("../generation/regional/WorldDescriptor.js");
  const { exteriorDoors } = await import("../interiors/BuildingDoors.js");
  const generation = {
    type: "regional",
    version: CURRENT_REGIONAL_VERSION,
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  const lot = new DenseDistrictSource(regionalWorld(2026), true)
    .owner(0, 0)
    ?.blocks.flatMap((b) => b.lots)
    .find((l) => l.buildingType.includes(building));
  if (!lot) throw new Error("Missing city building");
  setup.transport.connect("local", restoreProfile);
  await setup.server.settle();
  const meta = await setup.registry.createWorld(
    "Two doors",
    undefined,
    undefined,
    undefined,
    generation,
  );
  await setup.server.loadWorld(meta.id, { ...lot.entrance, generation });
  const prop = setup.server.propManager.props.find((p) => p.proceduralId === lot.id);
  if (!prop) throw new Error("Missing city facade");
  return { ...setup, meta, lot, generation, doors: exteriorDoors(prop) };
}

for (const building of ["butcher", "condo-bay"])
  it(`${building} doors share a realm across concurrent entry, opposite exits and restart`, async () => {
    const setup = await cityDoorSetup(building);
    const { server, transport, meta, generation, lot, doors } = setup;
    const { buildingDoors } = await import("../interiors/BuildingDoors.js");
    try {
      expect(doors).toHaveLength(2);
      transport.connect("guest", { profileId: "second-city-player", displayName: "Guest" });
      await server.settle();
      const secondary = doors[1];
      if (!secondary) throw new Error("Missing secondary door");
      transport.clientSend("guest", {
        type: "join-realm",
        requestId: 2010,
        worldId: meta.id,
        arrival: { x: secondary.outside.wx / 16, y: secondary.outside.wy / 16, generation },
      });
      await server.settle();
      transport.clientSend("local", { type: "enter-building", requestId: 2011, featureId: lot.id });
      transport.clientSend("guest", {
        type: "enter-building",
        requestId: 2012,
        featureId: lot.id,
        doorId: secondary.id,
      });
      await server.settle();
      const local = server.getLocalSession();
      const guest = [...server.getSessions()].find((s) => s.clientId === "guest");
      const interior = server.worldInterior;
      expect(interior?.layout).toBe(building === "butcher" ? "market-v3" : "home-v3");
      if (!interior) throw new Error("Missing interior");
      expect(local.realmId).toBe(guest?.realmId);
      const connections = buildingDoors(interior);
      expect(local.player.position).toEqual(connections.find((d) => d.id === "street")?.arrival);
      expect(guest?.player.position).toEqual(
        connections.find((d) => d.id === secondary.id)?.arrival,
      );
      const opposite = connections.find((d) => d.id === secondary.id);
      if (!opposite) throw new Error("Missing opposite exit");
      transport.clientSend("local", {
        type: "exit-building",
        requestId: 2013,
        doorId: secondary.id,
      });
      await server.settle();
      expect(local.realmId).toBe(guest?.realmId); // Far-away exit is rejected.
      local.player.position = { ...opposite.inside };
      transport.clientSend("local", {
        type: "exit-building",
        requestId: 2014,
        doorId: secondary.id,
      });
      await server.settle();
      expect(server.worldInterior).toBeNull();
      expect(local.player.position).toEqual(secondary.outside);
      transport.clientSend("local", {
        type: "enter-building",
        requestId: 2015,
        featureId: lot.id,
        doorId: secondary.id,
      });
      await server.settle();
      expect(local.player.position).toEqual(opposite.arrival);
      await server.flushAsync();
      await server.destroy();
      const resumedTransport = new TestTransport();
      const resumed = new GameServer(resumedTransport, {
        registry: setup.registry,
        createStore: setup.createStore,
      });
      try {
        await resumed.init();
        resumedTransport.connect("local", restoreProfile);
        await resumed.settle();
        expect(resumed.worldInterior).toEqual(interior);
        expect(resumed.getLocalSession().player.position).toEqual(opposite.arrival);
      } finally {
        await resumed.destroy();
      }
    } finally {
      await server.destroy();
    }
  });

it("keeps saved city room geometry and furniture while admitting the second exterior entrance", async () => {
  const setup = await cityDoorSetup();
  const { interiorRealmId } = await import("../interiors/GameplayInterior.js");
  const { initialRoom } = await import("../interiors/GameplayRoom.js");
  const { server, transport, lot, meta, doors } = setup;
  const id = interiorRealmId(meta.id, lot.id);
  const identity = {
    version: "interior-v1",
    parentWorldId: meta.id,
    featureId: lot.id,
    buildingType: lot.buildingType,
    floor: 0,
    returnX: lot.entrance.x,
    returnY: lot.entrance.y,
  } as const;
  // A pre-layout save, including an authored room edit.
  const room = initialRoom(identity);
  const cell = room.document.cells.find((c) => c.x === 3 && c.y === 3);
  if (cell) cell.value = "L";
  room.revision = 4;
  await setup.createStore(meta.id).save([
    {
      collection: JSON.stringify([id, "meta"]),
      key: "state",
      value: {
        cameraX: 80,
        cameraY: 120,
        cameraZoom: 1,
        playerX: 80,
        playerY: 120,
        entities: [],
        nextEntityId: 1,
        interior: identity,
        roomPlan: room,
      },
    },
  ]);
  try {
    const secondary = doors[1];
    if (!secondary) throw new Error("Missing secondary door");
    server.getLocalSession().player.position = secondary.outside;
    transport.clientSend("local", {
      type: "enter-building",
      requestId: 2020,
      featureId: lot.id,
      doorId: secondary.id,
    });
    await server.settle();
    expect(server.worldInterior).toEqual(identity);
    expect(server.getLocalSession().player.position).toEqual({ wx: 80, wy: 120 });
    await server.flushAsync();
    expect(
      (
        (await setup.createStore(meta.id).get(JSON.stringify([id, "meta"]), "state")) as {
          roomPlan: unknown;
        }
      ).roomPlan,
    ).toEqual(room);
    expect(
      server.propManager.props.filter((p) => p.type.startsWith("prop-interior-furniture:")),
    ).toHaveLength(3);
  } finally {
    await server.destroy();
  }
});

it("reports an idle world's save failure without pausing a healthy world's player", async () => {
  const setup = await createTestSetup();
  setup.transport.connect("local");
  await setup.server.settle();
  const source = setup.server.getLocalSession().realmId;
  if (!source) throw Error("missing source");
  const other = await setup.server.createWorld("Other", "flat", 42);
  await setup.server.loadWorld(other.id);
  await setup.server.loadWorld(source);
  const store = setup.createStore(other.id),
    executor = store.executor as MemoryRecordStore;
  executor.beforeCommit = async () => {
    throw Error("idle world disk full");
  };
  try {
    await expect(
      store.save([{ collection: "meta", key: "fixture", value: true }]),
    ).rejects.toThrow();
    await expect(setup.server.flushAsync()).rejects.toThrow();
    expect(setup.transport.messagesOfType("local", "storage-status").at(-1)).toMatchObject({
      paused: false,
    });
    expect(setup.server.getLocalSession().realmId).toBe(source);
  } finally {
    delete executor.beforeCommit;
    await setup.server.destroy();
  }
});

it("automatic doors validate intent and freeze the source while another player keeps the realm ticking", async () => {
  const { server, transport, meta, lot, doors } = await cityDoorSetup();
  const session = server.getLocalSession();
  const door = doors[0];
  if (!door) throw new Error("Missing door");
  transport.connect("observer", { profileId: "door-observer", displayName: "Observer" });
  await server.settle();
  transport.clientSend("observer", { type: "join-realm", requestId: 2399, worldId: meta.id });
  await server.settle();
  // The client can predict up to one tile ahead of the latest authoritative tick.
  session.player.position = { wx: door.outside.wx, wy: door.outside.wy + 20 };
  session.editorEnabled = false;
  transport.clientSend("local", {
    type: "enter-building",
    requestId: 2400,
    featureId: lot.id,
    walkThrough: true,
  });
  await server.settle();
  expect(transport.messagesOfType("local", "request-error").some((m) => m.requestId === 2400)).toBe(
    true,
  );
  expect(session.realmId).toBe(meta.id);
  session.doorIntent = { dx: 0, dy: -1, at: Date.now() };
  const sourcePlayer = session.player;
  const sourcePosition = { ...sourcePlayer.position };
  transport.clientSend("local", {
    type: "enter-building",
    requestId: 2401,
    featureId: lot.id,
    walkThrough: true,
  });
  await vi.waitFor(() => expect(transport.messagesOfType("local", "door-motion")).toHaveLength(1));
  expect(session.transitioning).toBe(true);
  for (let tick = 0; tick < 3; tick++) server.tick(1 / 60);
  expect(sourcePlayer.position).toEqual(sourcePosition);
  expect(transport.messagesOfType("observer", "door-motion")).toEqual([
    expect.objectContaining({ phase: "depart", self: false, realmId: meta.id }),
  ]);
  transport.clientSend("local", {
    type: "enter-building",
    requestId: 2402,
    featureId: lot.id,
    walkThrough: true,
  });
  await server.settle();
  expect(transport.messagesOfType("local", "request-error").some((m) => m.requestId === 2402)).toBe(
    true,
  );
  const motions = transport.messagesOfType("local", "door-motion");
  expect(motions.map((m) => m.phase)).toEqual(["depart", "arrive"]);
  expect(motions.every((m) => m.self)).toBe(true);
  expect(motions[0]?.overlay?.kind).toBe("butcher");
  expect(motions[0]?.to).toEqual({ wx: door.outside.wx, wy: door.outside.wy - 24 });
  expect(motions[1]?.to).toEqual(session.player.position);
  expect(session.realmId).not.toBe(meta.id);
  expect(session.doorArrivalUntil).toBeGreaterThan(Date.now());
  await server.destroy();
});

it("lists retired worlds without opening them and recreates into a clean container with the same seed", async () => {
  const { server, registry, transport, createStore } = await createTestSetup();
  const old = await registry.createWorld("Old town", "flat", 2026);
  Object.assign(old, {
    generation: { type: "regional", version: "regional-v5", seed: 2026, preset: "temperate-v1" },
  });
  const store = createStore(old.id);
  await store.open();
  await store.save([
    {
      collection: "entities",
      key: "old-npc",
      scope: "0,0",
      value: { marker: "must not transfer" },
    },
  ]);
  transport.connect("reviewer");
  transport.clientSend("reviewer", { type: "list-realms", requestId: 990 });
  await vi.waitFor(() =>
    expect(
      transport
        .messagesOfType("reviewer", "realm-list")
        .at(-1)
        ?.realms.find((r) => r.id === old.id)?.incompatibleReason,
    ).toMatch(/retired/i),
  );
  await expect(server.loadWorld(old.id)).rejects.toThrow(/retired/i);
  const fresh = await server.recreateWorld(old.id);
  expect(fresh.id).not.toBe(old.id);
  expect(fresh.generation).toEqual(createDescriptor("regional", 2026));
  expect(await registry.getWorld(old.id)).toEqual(old);
  const clean = createStore(fresh.id);
  await clean.open();
  expect(await clean.get("entities", "old-npc")).toBeUndefined();
  expect(await store.get("entities", "old-npc")).toEqual({ marker: "must not transfer" });
  await expect(server.loadWorld(fresh.id)).resolves.toBeDefined();
  await server.destroy();
});

it.each(["butcher", "condo-bay"])(
  "%s exits begin at the same doorway pose as entry ends",
  async (building) => {
    const { server, transport, lot, doors } = await cityDoorSetup(building);
    try {
      const session = server.getLocalSession();
      const door = doors[1];
      if (!door) throw new Error("Missing second door");
      session.editorEnabled = false;
      session.player.position = { ...door.outside };
      session.doorIntent = { dx: 0, dy: -1, at: Date.now() };
      transport.clientSend("local", {
        type: "enter-building",
        requestId: 2410,
        featureId: lot.id,
        doorId: door.id,
        walkThrough: true,
      });
      await server.settle();
      const { buildingDoor } = await import("../interiors/BuildingDoors.js");
      const interior = server.worldInterior;
      if (!interior) throw new Error("Missing interior");
      const connection = buildingDoor(interior, door.id);
      session.player.position = { ...connection.inside };
      session.doorArrivalUntil = 0;
      session.doorIntent = { dx: 0, dy: 1, at: Date.now() };
      transport.clientSend("local", {
        type: "exit-building",
        requestId: 2411,
        doorId: door.id,
        walkThrough: true,
      });
      await server.settle();
      const motions = transport.messagesOfType("local", "door-motion");
      expect(motions).toHaveLength(4);
      expect(motions[3]?.from).toEqual(motions[0]?.to);
      expect(motions[3]?.to).toEqual(door.outside);
      expect(motions[3]?.revealMs).toBe(180);
      expect(motions[1]?.revealMs).toBeUndefined();
    } finally {
      await server.destroy();
    }
  },
);

it("restores airborne departure motion on reopen and clears it on explicit travel", async () => {
  const setup = await createTestSetup();
  const profile = { profileId: "airborne-rider", displayName: "Airborne rider" };
  let server = setup.server;
  try {
    setup.transport.connect("local", profile);
    await server.settle();
    const player = server.getLocalSession().player;
    player.wz = 64;
    player.groundZ = 0;
    player.jumpVZ = 40;
    player.velocity = { vx: 256, vy: -10 };
    await server.destroy();
    const transport = new TestTransport();
    server = new GameServer(transport, {
      registry: setup.registry,
      createStore: setup.createStore,
    });
    await server.init();
    transport.connect("local", profile);
    await server.settle();
    const restored = server.getLocalSession().player;
    expect(restored.velocity).toEqual({ vx: 256, vy: -10 });
    expect(restored.jumpVZ).toBe(40);
    const target = await setup.registry.createWorld("Airborne travel", "flat", 422);
    await server.loadWorld(target.id, {
      x: 100,
      y: -200,
      generation: createDescriptor("flat", 422),
    });
    const arrived = server.getLocalSession().player;
    expect(arrived.jumpVZ).toBeUndefined();
  } finally {
    await server.destroy();
  }
});

it("restaurant visitor walks out and returns with one durable identity while the player stays indoors", async () => {
  const { server, transport, lot } = await cityDoorSetup("bakery");
  try {
    transport.clientSend("local", { type: "enter-building", requestId: 2400, featureId: lot.id });
    await server.settle();
    const session = server.getLocalSession();
    session.doorArrivalUntil = 0;
    session.visibleRange = { minCx: -1, minCy: -1, maxCx: 2, maxCy: 2 };
    session.player.position = { wx: 48, wy: 240 };
    expect(server.worldInterior?.layout).toBe("restaurant-v3");
    const home = session.realmId;
    const visitor = server.entityManager.entities.find((e) => e.persistentId?.endsWith(":visitor"));
    if (!visitor?.resident) throw new Error("Missing dining visitor");
    const persistentId = visitor.persistentId;
    const seen = new Set<string>();
    const positions: string[] = [];
    for (let i = 0; i < 2400; i++) {
      server.tick(1 / 30);
      if (i % 30 === 0) {
        await server.settle();
        const realms = Reflect.get(
          server,
          "realms",
        ) as import("./RealmDirectory.js").RealmDirectory;
        const owners = [...realms.values()].flatMap((realm) =>
          realm.entityManager.entities
            .filter((e) => e.persistentId === persistentId)
            .map((e) => ({ realm, e })),
        );
        expect(owners).toHaveLength(1);
        const owner = owners[0];
        if (!owner) throw new Error("Missing visitor");
        seen.add(owner.e.resident?.place ?? "missing");
        positions.push(
          `${owner.realm.currentWorldId}: ${owner.e.position.wx},${owner.e.position.wy} ${owner.e.resident?.phase} ${owner.e.resident?.index}`,
        );
        if (seen.has("outside") && owner.realm.currentWorldId === home) break;
      }
    }
    expect(seen, positions.slice(-5).join("\n")).toEqual(new Set(["inside", "outside"]));
    const returned = server.entityManager.entities.find((e) => e.persistentId === persistentId);
    expect(returned?.resident?.place, positions.slice(-5).join("\n")).toBe("inside");
    expect(session.realmId).toBe(home);
    await server.flushAsync();
  } finally {
    await server.destroy();
  }
}, 30000);

it("enters the generated farmhouse and tiny outbuilding, exits and restores the saved farm interior", async () => {
  const setup = await createTestSetup();
  const { server, transport, registry } = setup;
  const { FarmsteadSource } = await import("../generation/regional/FarmsteadPlanner.js");
  const { regionalWorld } = await import("../generation/regional/WorldDescriptor.js");
  const { buildingDoor, exteriorDoors } = await import("../interiors/BuildingDoors.js");
  const { interiorRealmId } = await import("../interiors/GameplayInterior.js");
  const generation = createDescriptor("regional", 2026);
  const farm = new FarmsteadSource(regionalWorld(2026)).owner(0, 0, "south");
  if (!farm) throw Error("Missing farm fixture");
  transport.connect("local", restoreProfile);
  await server.settle();
  const meta = await registry.createWorld(
    "Farm doors",
    undefined,
    undefined,
    undefined,
    generation,
  );
  const buildings = farm.props.filter(
    (p) => p.propType === "prop-country-house" || p.propType === "prop-shed",
  );
  const rooms = new Set<string>();
  try {
    expect(buildings).toHaveLength(2);
    for (const [i, prop] of buildings.entries()) {
      const outside = exteriorDoors({
        type: prop.propType,
        position: { wx: prop.wx, wy: prop.wy },
      })[0]?.outside;
      if (!outside) throw Error("Missing farm entrance");
      await server.loadWorld(meta.id, { x: outside.wx / 16, y: outside.wy / 16, generation });
      expect(server.propManager.props.some((p) => p.proceduralId === prop.featureId)).toBe(true);
      transport.clientSend("local", {
        type: "enter-building",
        requestId: 9300 + i,
        featureId: prop.featureId,
      });
      await server.settle();
      const interior = server.worldInterior;
      expect(interior?.featureId).toBe(prop.featureId);
      expect(interior?.buildingType).toBe(prop.propType);
      if (!interior) throw Error("Farm entry failed");
      const door = buildingDoor(interior);
      rooms.add(door.insideRealmId);
      expect(server.getLocalSession().player.position).toEqual(door.arrival);
      if (prop.propType === "prop-shed") {
        expect(interior.layout).toBe("outbuilding-v1");
        break;
      }
      server.getLocalSession().player.position = { ...door.inside };
      transport.clientSend("local", { type: "exit-building", requestId: 9400 + i });
      await server.settle();
      expect(server.worldInterior).toBeNull();
      expect(server.getLocalSession().player.position).toEqual(outside);
    }
    expect(rooms.size).toBe(2);
    const interior = server.worldInterior;
    await server.flushAsync();
    await server.destroy();
    const resumedTransport = new TestTransport();
    const resumed = new GameServer(resumedTransport, { registry, createStore: setup.createStore });
    try {
      await resumed.init();
      resumedTransport.connect("local", restoreProfile);
      await resumed.settle();
      expect(resumed.worldInterior).toEqual(interior);
      if (!interior) throw Error("Missing saved farm interior");
      const door = buildingDoor(interior);
      resumed.getLocalSession().player.position = { ...door.inside };
      resumedTransport.clientSend("local", { type: "exit-building", requestId: 9500 });
      await resumed.settle();
      expect(resumed.worldInterior).toBeNull();
      expect(resumed.getLocalSession().player.position).toEqual(door.outside);
      // A syntactically valid farm ID still has to name a real generated owner.
      await expect(
        resumed.loadWorld(interiorRealmId(meta.id, "farmstead:0:0:east:house")),
      ).rejects.toThrow("absent from the generated plan");
    } finally {
      await resumed.destroy();
    }
  } finally {
    await server.destroy();
  }
});

it("enters every mall shop, exits at its own facade and restores a saved mall interior", async () => {
  const setup = await createTestSetup();
  const { server, transport, registry } = setup;
  const { DenseDistrictSource } = await import("../generation/regional/DenseDistrictPlanner.js");
  const { regionalWorld } = await import("../generation/regional/WorldDescriptor.js");
  const { shoppingBuilding, shoppingSceneryPlacements } = await import(
    "../generation/regional/ShoppingScenery.js"
  );
  const { exteriorDoors, buildingDoors } = await import("../interiors/BuildingDoors.js");
  const generation = createDescriptor("regional", 2026);
  const plan = new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0);
  const center = plan?.shoppingCenters?.[0];
  if (!center) throw new Error("Missing mall");
  const shops = shoppingSceneryPlacements(center).filter((p) => shoppingBuilding(p.propType));
  transport.connect("local", restoreProfile);
  await server.settle();
  const meta = await registry.createWorld(
    "Mall doors",
    undefined,
    undefined,
    undefined,
    generation,
  );
  const identities = new Set<string>();
  try {
    for (const [i, shop] of shops.entries()) {
      const outside = exteriorDoors({
        type: shop.propType,
        position: { wx: shop.wx, wy: shop.wy },
      })[0]?.outside;
      if (!outside) throw new Error("Missing mall door");
      await server.loadWorld(meta.id, { x: outside.wx / 16, y: outside.wy / 16, generation });
      // The factory reconstructs saved scenery with the same type/procedural ID.
      expect(server.propManager.props.some((p) => p.proceduralId === shop.featureId)).toBe(true);
      transport.clientSend("local", {
        type: "enter-building",
        requestId: 9000 + i,
        featureId: shop.featureId,
      });
      await server.settle();
      const interior = server.worldInterior;
      expect(interior?.featureId).toBe(shop.featureId);
      expect(interior?.layout).toBe("restaurant-v3");
      if (!interior) throw new Error("Mall entry failed");
      const connection = buildingDoors(interior)[0];
      if (!connection) throw new Error("Missing mall connection");
      identities.add(connection.insideRealmId);
      expect(server.getLocalSession().player.position).toEqual(connection.arrival);
      if (i === shops.length - 1) break; // Restart while inside the final shop.
      server.getLocalSession().player.position = { ...connection.inside };
      transport.clientSend("local", { type: "exit-building", requestId: 9100 + i });
      await server.settle();
      expect(server.worldInterior).toBeNull();
      expect(server.getLocalSession().player.position).toEqual(outside);
    }
    expect(identities.size).toBe(7);
    const interior = server.worldInterior;
    await server.flushAsync();
    await server.destroy();
    const resumedTransport = new TestTransport();
    const resumed = new GameServer(resumedTransport, { registry, createStore: setup.createStore });
    try {
      await resumed.init();
      resumedTransport.connect("local", restoreProfile);
      await resumed.settle();
      expect(resumed.worldInterior).toEqual(interior);
      if (!interior) throw new Error("Missing saved mall interior");
      const connection = buildingDoors(interior)[0];
      if (!connection) throw new Error("Missing saved mall connection");
      resumed.getLocalSession().player.position = { ...connection.inside };
      resumedTransport.clientSend("local", { type: "exit-building", requestId: 9200 });
      await resumed.settle();
      expect(resumed.worldInterior).toBeNull();
      expect(resumed.getLocalSession().player.position).toEqual(connection.outside);
    } finally {
      await resumed.destroy();
    }
  } finally {
    await server.destroy();
  }
});

it("keeps collected exploration gems gone and carries the balance through building visits and restart", async () => {
  const setup = await cityDoorSetup();
  const { server, transport, lot, registry } = setup;
  const { buildingDoor } = await import("../interiors/BuildingDoors.js");
  const enter = async () => {
    transport.clientSend("local", { type: "enter-building", requestId: 9900, featureId: lot.id });
    await server.settle();
    expect(server.worldInterior).not.toBeNull();
  };
  const exit = async () => {
    server.getLocalSession().player.position = { ...buildingDoor(requiredInterior()).inside };
    transport.clientSend("local", { type: "exit-building", requestId: 9901 });
    await server.settle();
    expect(server.worldInterior).toBeNull();
  };
  const requiredInterior = () => {
    const interior = server.worldInterior;
    if (!interior) throw Error("Missing interior");
    return interior;
  };
  try {
    server.getLocalSession().gameplaySession.gemsCollected = 7;
    await enter();
    expect(server.getLocalSession().gameplaySession.gemsCollected).toBe(7);
    const gem = server.entityManager.entities.find((e) => e.type === "gem");
    if (!gem) throw Error("Missing indoor gems");
    const gemId = gem.proceduralId;
    const count = server.entityManager.entities.filter((e) => e.type === "gem").length;
    server.getLocalSession().player.position = { ...gem.position };
    server.tick(1 / 60);
    expect(server.getLocalSession().gameplaySession.gemsCollected).toBe(8);
    expect(server.entityManager.entities.some((e) => e.proceduralId === gemId)).toBe(false);
    await exit();
    expect(server.getLocalSession().gameplaySession.gemsCollected).toBe(8);
    // A newer outdoor balance must win over the older saved indoor visit.
    server.getLocalSession().gameplaySession.gemsCollected = 10;
    await enter();
    expect(server.getLocalSession().gameplaySession.gemsCollected).toBe(10);
    expect(server.entityManager.entities.filter((e) => e.type === "gem")).toHaveLength(count - 1);
    await server.flushAsync();
    await server.destroy();
    const resumedTransport = new TestTransport();
    const resumed = new GameServer(resumedTransport, { registry, createStore: setup.createStore });
    try {
      await resumed.init();
      resumedTransport.connect("local", restoreProfile);
      await resumed.settle();
      expect(resumed.getLocalSession().gameplaySession.gemsCollected).toBe(10);
      expect(resumed.entityManager.entities.some((e) => e.proceduralId === gemId)).toBe(false);
      expect(resumed.entityManager.entities.filter((e) => e.type === "gem")).toHaveLength(
        count - 1,
      );
      const interior = resumed.worldInterior;
      if (!interior) throw Error("Missing resumed room");
      resumed.getLocalSession().player.position = { ...buildingDoor(interior).inside };
      resumedTransport.clientSend("local", { type: "exit-building", requestId: 9902 });
      await resumed.settle();
      expect(resumed.getLocalSession().gameplaySession.gemsCollected).toBe(10);
    } finally {
      await resumed.destroy();
    }
  } finally {
    await server.destroy();
  }
});
