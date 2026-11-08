import { afterEach, expect, it, vi } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { BufferedMessage, ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { World } from "../world/World.js";
import { RecipeWorldAuthority } from "./RecipeWorldAuthority.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "recipe-world",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: scenarioWalls(-400, -400, 400, 400),
};
const input = (seq: number, dx = 1): ClientMessage => ({
  type: "player-input",
  seq,
  dx,
  dy: 0,
  jump: false,
  sprinting: false,
});

/** The runtime's side of the connection: wire-encoded messages and a replica. */
function connection(writable = () => true) {
  let receive: ((id: string, message: ClientMessage) => void) | undefined;
  const sent: { id: string; message: ServerMessage }[] = [];
  const replica = new RemoteStateView(new World());
  const transport: IServerTransport = {
    canSend: (id) => id === undefined || writable(),
    send: (id, message) => {
      const wire = decodeServerMessage(encodeServerMessage(message));
      sent.push({ id, message: wire });
      if (wire.type === "world-loaded") replica.clear();
      else if (
        wire.type === "frame" ||
        (wire.type.startsWith("sync-") && wire.type !== "sync-cvars")
      )
        replica.applyMessage(wire as BufferedMessage);
    },
    broadcast: () => {
      throw Error("A recipe world addresses its seat");
    },
    onMessage: (handler) => {
      receive = handler;
    },
    onConnect() {},
    onDisconnect() {},
    close() {},
  };
  const types = () => sent.map((s) => s.message.type);
  return {
    sent,
    replica,
    transport,
    types,
    deliver: (message: ClientMessage, id = "local") => receive?.(id, message),
    frames: () => types().filter((type) => type === "frame").length,
  };
}

async function opened(writable?: () => boolean, world = recipe) {
  const link = connection(writable);
  const authority = new RecipeWorldAuthority(link.transport);
  authority.onLoopError = vi.fn();
  const result = await authority.admin({ kind: "open", recipe: world });
  return { link, authority, result };
}

const fake = () =>
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"],
  });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("stages a recipe on open and answers each request after a full snapshot", async () => {
  const { link, authority, result } = await opened();
  expect(link.types()[0]).toBe("world-loaded");
  expect(link.types()).toContain("frame");
  expect(link.sent.every((s) => s.id === "local")).toBe(true);
  expect(link.replica.serverPlayerEntity.position).toEqual({ wx: 0, wy: 0 });
  expect(link.replica.props).toHaveLength(4);
  expect(result).toEqual({ handles: {}, clock: { running: false, ticks: 0 } });

  link.sent.length = 0;
  await authority.admin({
    kind: "command",
    command: { kind: "teleport", position: { wx: 40, wy: 8 } },
  });
  expect(link.types().at(-1)).toBe("frame");
  expect(link.replica.serverPlayerEntity.position).toEqual({ wx: 40, wy: 8 });

  await expect(authority.admin({ kind: "open", recipe })).rejects.toThrow("already open");
  await expect(authority.admin({ kind: "rewind" })).rejects.toThrow("Unknown lab request");
  await expect(
    authority.admin({
      kind: "command",
      command: { kind: "teleport", position: { wx: Number.NaN, wy: 0 } },
    }),
  ).rejects.toThrow("Invalid teleport");
  await expect(authority.admin({ kind: "step", input: input(1) })).resolves.toMatchObject({
    clock: { running: false, ticks: 1 },
  });
  // Command errors are the lab's to report; only a lost world fails the authority.
  expect(authority.onLoopError).not.toHaveBeenCalled();
  await authority.destroy();
  await expect(authority.admin({ kind: "reload" })).rejects.toThrow("not open");
});

it("fails the authority when a world cannot be staged, and refuses two-seat recipes", async () => {
  for (const world of [
    { ...recipe, guest: createPlayer(20, 0) },
    { ...recipe, version: 2 as 1 },
  ]) {
    const authority = new RecipeWorldAuthority(connection().transport);
    authority.onLoopError = vi.fn();
    await expect(authority.admin({ kind: "open", recipe: world })).rejects.toThrow(
      world.guest ? "Two-seat" : "Unsupported scenario recipe",
    );
    expect(authority.onLoopError).toHaveBeenCalledOnce();
  }
  const { authority } = await opened();
  vi.spyOn(ScenarioSession.prototype, "reset").mockRejectedValue(Error("storage lost"));
  await expect(authority.admin({ kind: "reset" })).rejects.toThrow("storage lost");
  expect(authority.onLoopError).toHaveBeenCalledOnce();
  await authority.destroy();
});

it("keeps beating while paused but advances the world only while it runs", async () => {
  const { link, authority } = await opened();
  fake();
  authority.startLoop();
  link.sent.length = 0;
  link.deliver(input(1));
  await vi.advanceTimersByTimeAsync(1000);
  expect(authority.completedTicks).toBeGreaterThanOrEqual(59);
  expect(link.frames()).toBe(0);
  expect((await authority.admin({ kind: "diagnostics" })).clock.ticks).toBe(0);
  expect(link.replica.lastProcessedInputSeq).toBe(0);

  await authority.admin({ kind: "clock", running: true });
  // Play sent while paused was dropped, not kept for the next tick.
  await vi.advanceTimersByTimeAsync(50);
  expect(link.replica.lastProcessedInputSeq).toBe(0);
  // Editing, identity and other connections have no say in a recipe world.
  link.deliver({ type: "set-editor-mode", enabled: true });
  for (let seq = 2; seq < 32; seq++) {
    link.deliver(input(seq));
    await vi.advanceTimersByTimeAsync(1000 / 60);
  }
  link.deliver(input(500, -1), "guest");
  await vi.advanceTimersByTimeAsync(100);
  expect(link.replica.lastProcessedInputSeq).toBe(31);
  await expect(authority.admin({ kind: "step", input: input(32) })).rejects.toThrow("Pause");
  expect(link.replica.serverPlayerEntity.position.wx).toBeGreaterThan(20);
  const { clock } = await authority.admin({ kind: "clock", running: false });
  expect(clock.ticks).toBeGreaterThanOrEqual(29);
  const paused = link.replica.serverPlayerEntity.position.wx;
  await vi.advanceTimersByTimeAsync(500);
  expect(link.replica.serverPlayerEntity.position.wx).toBe(paused);
  expect((await authority.admin({ kind: "diagnostics" })).clock.ticks).toBe(clock.ticks);
  authority.stopLoop();
  const beats = authority.completedTicks;
  await vi.advanceTimersByTimeAsync(500);
  expect(authority.completedTicks).toBe(beats);
  await authority.destroy();
});

it("discards queued input on pause and drops play while an instrument is busy", async () => {
  const { link, authority } = await opened();
  fake();
  authority.startLoop();
  await authority.admin({ kind: "clock", running: true });
  await vi.advanceTimersByTimeAsync(100);
  const before = link.replica.serverPlayerEntity.position.wx;
  for (let seq = 1; seq <= 3; seq++) link.deliver(input(seq));
  await authority.admin({ kind: "clock", running: false });
  expect(link.replica.lastProcessedInputSeq).toBe(3);
  expect(link.replica.serverPlayerEntity.position.wx).toBe(before);

  const { clock: start } = await authority.admin({ kind: "clock", running: true });
  let release!: () => void;
  vi.spyOn(ScenarioSession.prototype, "command").mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const busy = authority.admin({ kind: "command", command: { kind: "exit-vehicle" } });
  link.deliver(input(4));
  link.sent.length = 0;
  await vi.advanceTimersByTimeAsync(200);
  expect(link.frames()).toBe(0);
  release();
  await busy;
  expect((await authority.admin({ kind: "diagnostics" })).clock.ticks).toBe(start.ticks);
  // Play sent while busy was dropped, not deferred.
  await vi.advanceTimersByTimeAsync(50);
  expect(link.replica.lastProcessedInputSeq).toBe(3);
  expect(link.replica.serverPlayerEntity.position.wx).toBe(before);
  await authority.destroy();
});

it("streams a paused camera's range and hands a running one to the next input", async () => {
  const { link, authority } = await opened();
  link.sent.length = 0;
  link.deliver({ type: "visible-range", minCx: 6, minCy: 0, maxCx: 7, maxCy: 1 });
  await authority.settle();
  expect(link.types()).toContain("sync-chunks");
  expect(link.replica.world.chunks.get(7, 1)).toBeDefined();

  const accept = vi.spyOn(ScenarioSession.prototype, "accept");
  await authority.admin({ kind: "clock", running: true });
  link.sent.length = 0;
  link.deliver({ type: "visible-range", minCx: -3, minCy: -3, maxCx: 0, maxCy: 0 });
  expect(link.sent).toHaveLength(0);
  link.deliver(input(1));
  expect(accept).toHaveBeenLastCalledWith(input(1), { minCx: -3, minCy: -3, maxCx: 0, maxCy: 0 });
  await authority.destroy();
});

it("keeps streaming a paused camera's range into new worlds, teleports and steps", async () => {
  const { link, authority } = await opened();
  const far = { minCx: 6, minCy: 0, maxCx: 7, maxCy: 1 };
  link.deliver({ type: "visible-range", ...far });
  // A step ticks with the camera's range, so far chunks never leave residency.
  const step = vi.spyOn(ScenarioSession.prototype, "step");
  for (const request of [
    { kind: "reset" },
    { kind: "command", command: { kind: "teleport", position: { wx: -40, wy: 0 } } },
    { kind: "step", input: input(1) },
  ] as const) {
    await authority.admin(request);
    expect(link.replica.world.chunks.get(7, 1), request.kind).toBeDefined();
  }
  expect(step).toHaveBeenCalledWith(input(1), far);
  // A lab's own view-range command is the same camera range.
  await authority.admin({
    kind: "command",
    command: { kind: "view-range", range: { minCx: -8, minCy: 0, maxCx: -7, maxCy: 0 } },
  });
  await authority.admin({ kind: "reset" });
  expect(link.replica.world.chunks.get(-8, 0)).toBeDefined();
  expect(link.replica.world.chunks.get(7, 1)).toBeUndefined();
  // A range the session refuses is the lab's error, never the world's.
  await expect(
    authority.admin({
      kind: "command",
      command: { kind: "view-range", range: { minCx: 0, minCy: 0, maxCx: 99, maxCy: 99 } },
    }),
  ).rejects.toThrow("Invalid scenario view range");
  await authority.admin({
    kind: "command",
    command: { kind: "teleport", position: { wx: 8, wy: 8 } },
  });
  await authority.admin({ kind: "reset" });
  expect(link.replica.world.chunks.get(-8, 0)).toBeDefined();
  expect(authority.onLoopError).not.toHaveBeenCalled();
  await authority.destroy();
});

it("reads diagnostics beside play without dropping it", async () => {
  const { link, authority } = await opened();
  fake();
  authority.startLoop();
  await authority.admin({ kind: "clock", running: true });
  const reading = authority.admin({ kind: "diagnostics" });
  link.deliver(input(1));
  await reading;
  await vi.advanceTimersByTimeAsync(50);
  expect(link.replica.lastProcessedInputSeq).toBe(1);
  await authority.destroy();
});

it("announces reset and reload as a new world and restarts the clock count", async () => {
  const { link, authority } = await opened();
  await authority.admin({ kind: "step", input: input(1) });
  await authority.admin({
    kind: "command",
    command: { kind: "teleport", position: { wx: 120, wy: -40 } },
  });
  link.sent.length = 0;
  const reloaded = await authority.admin({ kind: "reload" });
  expect(link.types()[0]).toBe("world-loaded");
  expect(link.replica.serverPlayerEntity.position).toEqual({ wx: 120, wy: -40 });
  expect(reloaded.clock.ticks).toBe(0);
  link.sent.length = 0;
  await authority.admin({ kind: "reset" });
  expect(link.types()[0]).toBe("world-loaded");
  expect(link.replica.serverPlayerEntity.position).toEqual({ wx: 0, wy: 0 });
  const { physics } = await authority.admin({ kind: "diagnostics", reset: true });
  expect(physics?.timings).toBeDefined();
  expect(physics?.collision).not.toBeNull();
  await authority.destroy();
});

it("leaves publication to the connection's backpressure, as the game does", async () => {
  let writable = true;
  const { link, authority } = await opened(() => writable);
  fake();
  authority.startLoop();
  await authority.admin({ kind: "clock", running: true });
  writable = false;
  link.sent.length = 0;
  await vi.advanceTimersByTimeAsync(200);
  expect(link.frames()).toBe(0);
  writable = true;
  await vi.advanceTimersByTimeAsync(50);
  expect(link.frames()).toBeGreaterThan(0);
  await authority.destroy();
});

it("routes a driver's horn press to the seat that hears it", async () => {
  const { link, authority, result } = await opened(undefined, {
    ...recipe,
    player: createPlayer(80, -28),
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 80, wy: 0, facing: Direction.Right }],
  });
  const car = result.handles.car;
  if (car === undefined) throw Error("Missing car handle");
  await authority.admin({ kind: "command", command: { kind: "enter-vehicle", entityId: car } });
  await authority.admin({ kind: "clock", running: true });
  link.sent.length = 0;
  link.deliver({ type: "vehicle-horn", active: true });
  fake();
  authority.startLoop();
  await vi.advanceTimersByTimeAsync(50);
  expect(link.sent.find((s) => s.message.type === "vehicle-horn")?.message).toMatchObject({
    vehicleId: car,
    active: true,
  });
  await authority.destroy();
});
