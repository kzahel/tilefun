import { afterEach, describe, expect, it } from "vitest";
import type { SavedMeta } from "../persistence/SaveManager.js";
import type { ServerMessage, SyncSkyMessage } from "../shared/protocol.js";
import { DAY_SECONDS, START_SECONDS } from "../sky/Sky.js";
import type { GameServer } from "./GameServer.js";
import { SkyClocks } from "./SkyClocks.js";
import { memoryServer } from "./test/MemoryServer.js";

const servers: GameServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.destroy();
});

async function start() {
  const rig = await memoryServer();
  servers.push(rig.server);
  rig.server.broadcasting = true;
  const messages: ServerMessage[] = [];
  rig.transport.clientSide.onMessage((message) => messages.push(message));
  const synced = () => messages.filter((m): m is SyncSkyMessage => m.type === "sync-sky");
  const rcon = (command: string) =>
    rig.transport.clientSide.send({ type: "rcon", requestId: 1, command });
  const output = () =>
    messages.flatMap((message) => (message.type === "rcon-response" ? message.output : []));
  return { ...rig, messages, synced, rcon, output };
}

describe("world clocks", () => {
  it("share one clock between a world's realms, counted once per server tick", () => {
    const clocks = new SkyClocks();
    const outdoors = clocks.adopt("world", 7, undefined);
    const interior = clocks.adopt("world", 7, undefined);
    expect(interior).toBe(outdoors);
    expect(outdoors).toMatchObject({ seed: 7, time: START_SECONDS });
    for (let tick = 0; tick < 60; tick++) {
      clocks.tick++;
      outdoors.advance(1 / 60);
      interior.advance(1 / 60);
    }
    expect(outdoors.time).toBeCloseTo(START_SECONDS + 1, 9);
    expect(clocks.adopt("other", 7, undefined).time).toBe(START_SECONDS);
  });

  it("take the latest time any of the world's realms saved", () => {
    const clocks = new SkyClocks();
    // An interior loaded first with an older save, then its world with a newer one.
    expect(clocks.adopt("world", 7, 900).time).toBe(900);
    expect(clocks.adopt("world", 7, 2500).time).toBe(2500);
    expect(clocks.adopt("world", 7, 1200).time).toBe(2500);
    expect(clocks.adopt("world", 7, Number.NaN).time).toBe(2500);
    clocks.forget("world");
    expect(clocks.adopt("world", 7, undefined).time).toBe(START_SECONDS);
  });
});

describe("the world's clock on a server", () => {
  it("sends the clock once and lets frame ticks carry it", async () => {
    const { server, synced, messages } = await start();
    for (let tick = 0; tick < 120; tick++) server.tick(1 / 60);
    const [sky, ...more] = synced();
    expect(more).toEqual([]);
    expect(sky).toMatchObject({ seed: 42 });
    expect(sky?.weather).toBeUndefined();
    const clock = server.skyOf(server.getLocalSession());
    expect(clock?.time).toBeCloseTo(START_SECONDS + 2, 6);
    // The replica's arithmetic: the given time plus the ticks since.
    const frame = messages.filter((message) => message.type === "frame").at(-1);
    if (!sky || frame?.type !== "frame") throw Error("No sky or frame");
    expect(sky.time + (frame.serverTick - sky.tick) / 60).toBeCloseTo(clock?.time ?? 0, 6);
  });

  it("moves forward on a time command and tells its replicas", async () => {
    const { server, synced, rcon, output } = await start();
    server.tick(1 / 60);
    rcon("time night");
    expect(output().at(-1)).toMatch(/^Day 1, 9:00 PM, /);
    server.tick(1 / 60);
    expect(synced()).toHaveLength(2);
    expect(synced()[1]?.time).toBeCloseTo((21 * DAY_SECONDS) / 24, 1);
    // Morning again is tomorrow's: the clock never runs back.
    rcon("time morning");
    expect(output().at(-1)).toMatch(/^Day 2, 8:00 AM, /);
    rcon("time 25");
    expect(output().at(-1)).toMatch(/^Usage: time /);
    expect(server.skyOf(server.getLocalSession())?.time).toBe(DAY_SECONDS + START_SECONDS);
  });

  it("holds weather on command until it is released", async () => {
    const { server, synced, rcon, output } = await start();
    server.tick(1 / 60);
    rcon("weather storm");
    expect(output()).toContain("Weather: storm (held)");
    server.tick(1 / 60);
    expect(synced().at(-1)?.weather).toBe("storm");
    rcon("weather sideways");
    expect(output().at(-1)).toMatch(/^Usage: weather /);
    rcon("weather auto");
    server.tick(1 / 60);
    expect(synced()).toHaveLength(3);
    expect(synced().at(-1)?.weather).toBeUndefined();
  });

  it("saves the clock with the world", async () => {
    const { server, stores, rcon } = await start();
    rcon("time noon");
    for (let tick = 0; tick < 30; tick++) server.tick(1 / 60);
    await server.flushAsync();
    const saved = (await stores.get("test")?.get("meta", "state")) as SavedMeta;
    expect(saved.skyTime).toBeCloseTo(DAY_SECONDS / 2 + 0.5, 6);
  });
});
