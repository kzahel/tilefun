import { afterEach, expect, it, vi } from "vitest";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { RecipeWorldAuthority } from "../scenarios/RecipeWorldAuthority.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { inProcessWorker } from "../server/testing/InProcessWorker.js";
import { fixedCamera, View } from "../session/View.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import type { VehicleHornMessage } from "../shared/protocol.js";
import { required } from "../shared/required.js";
import { RecipeWorldClient } from "./RecipeWorldClient.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "recipe-client",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: scenarioWalls(-400, -400, 400, 400),
  gravity: 0.5,
};
const move = (dx: number, dy = 0, jump = false): Movement => ({
  dx,
  dy,
  jump,
  sprinting: false,
});
const clients: RecipeWorldClient[] = [];
function connect(world = recipe) {
  const worker = inProcessWorker((transport) => new RecipeWorldAuthority(transport));
  const client = new RecipeWorldClient(world, { worker: () => worker.endpoint });
  clients.push(client);
  return { client, worker };
}
async function running(client: RecipeWorldClient) {
  await client.ready;
  client.setRunning(true);
  await vi.waitFor(() => expect(client.busy).toBe(false));
}
const frame = () => new Promise((resolve) => setTimeout(resolve, 1000 / 60));
afterEach(() => {
  vi.restoreAllMocks();
  for (const client of clients.splice(0)) client.dispose();
});

it("opens the recipe world and matches headless steps through the game transport", async () => {
  // A recipe body the wire cannot describe: replicas rebuild colliders by type.
  const narrow = createPlayer(0, 0);
  narrow.collider = { ...required(narrow.collider), width: 6 };
  const world = { ...recipe, player: narrow };
  const { client } = connect(world);
  await client.ready;
  const { replica } = client;
  expect(replica.serverPlayerEntity.position).toEqual({ wx: 0, wy: 0 });
  expect(client.predictor.player?.position).toEqual({ wx: 0, wy: 0 });
  expect(replica.serverPlayerEntity.collider?.width).toBe(6);
  expect(replica.props).toHaveLength(4);
  expect(client.clock).toEqual({ running: false, ticks: 0 });
  const direct = await ScenarioSession.create(world);
  try {
    for (let i = 0; i < 40; i++) {
      const input = move(i < 20 ? 1 : 0, i > 25 ? -1 : 0, i > 5 && i < 12);
      await Promise.all([client.step(input), direct.step(input)]);
      const server = replica.serverPlayerEntity;
      expect(server.position.wx).toBeCloseTo(direct.player.player.position.wx, 4);
      expect(server.position.wy).toBeCloseTo(direct.player.player.position.wy, 4);
      expect(server.wz ?? 0).toBeCloseTo(direct.player.player.wz ?? 0, 4);
    }
    expect(client.clock?.ticks).toBe(40);
  } finally {
    await direct.close();
  }
  // Real-time input continues the authority's sequence after manual steps.
  await running(client);
  expect(client.submitInput(move(1))).toBe(true);
  await vi.waitFor(() => {
    client.update();
    expect(replica.lastProcessedInputSeq).toBe(41);
  });
});

it("predicts real-time play on one input timeline and converges on the authority", async () => {
  const { client } = connect();
  await running(client);
  const { replica } = client;
  const reconcile = vi.spyOn(client.device, "reconcile");
  // The in-process authority shares this thread, so its input is observable.
  const accept = vi.spyOn(ScenarioSession.prototype, "accept");
  const range = { minCx: -1, minCy: -1, maxCx: 1, maxCy: 1 };
  let sent = 0;
  for (let i = 0; i < 70; i++) {
    client.update();
    if (client.submitInput(move(i < 40 ? 1 : 0, i < 5 ? 1 : 0), range)) sent++;
    // Unacknowledged input keeps the predicted seat ahead of the authority.
    if (i === 30)
      expect(replica.playerEntity.position.wx).toBeGreaterThan(
        replica.serverPlayerEntity.position.wx + 0.5,
      );
    await frame();
  }
  expect(sent).toBe(70);
  expect(reconcile).toHaveBeenCalledWith(false, undefined);
  // Diagonals reach the authority at unit length, quantized as on the wire.
  expect(accept).toHaveBeenCalledWith(
    expect.objectContaining({ seq: 1, dx: quantizeAxis(Math.SQRT1_2) }),
    range,
  );
  await vi.waitFor(() => {
    client.update();
    expect(replica.lastProcessedInputSeq).toBe(sent);
  });
  expect(replica.serverPlayerEntity.position.wx).toBeGreaterThan(20);
  expect(replica.playerEntity.position.wx).toBeCloseTo(replica.serverPlayerEntity.position.wx, 1);
  expect(replica.playerEntity.position.wy).toBeCloseTo(replica.serverPlayerEntity.position.wy, 1);
});

it("resolves a command after its snapshot is applied and restarts prediction there", async () => {
  const { client } = connect();
  await running(client);
  const reconcile = vi.spyOn(client.device, "reconcile");
  // No lab tick runs here: the transport consumes packets while the command waits.
  await client.command({ kind: "teleport", position: { wx: 64, wy: 32 } });
  expect(client.replica.serverPlayerEntity.position).toEqual({ wx: 64, wy: 32 });
  expect(client.predictor.player?.position).toEqual({ wx: 64, wy: 32 });
  // A fence restarts prediction (a teleport never glides as a correction).
  expect(reconcile).toHaveBeenLastCalledWith(true, undefined);
  expect(client.busy).toBe(false);
  await expect(
    client.command({ kind: "teleport", position: { wx: Number.NaN, wy: 0 } }),
  ).rejects.toThrow("Invalid teleport");
  expect(() => client.update()).not.toThrow();
});

it("replaces the replica and every view's presentation on reload and reset", async () => {
  const { client } = connect();
  await client.ready;
  const view = new View(fixedCamera({ wx: 0, wy: 0 }));
  client.device.views.push(view);
  await client.command({ kind: "teleport", position: { wx: 120, wy: -40 } });
  view.fades.set("deck", { opacity: 0.5, time: 1 });
  await client.reload();
  expect(view.fades.size).toBe(0);
  expect(client.replica.serverPlayerEntity.position).toEqual({ wx: 120, wy: -40 });
  expect(client.replica.playerEntity.position).toEqual({ wx: 120, wy: -40 });
  await client.command({
    kind: "place-entity",
    entityType: "chicken",
    position: { wx: 40, wy: 0 },
  });
  expect(client.replica.entities.some((e) => e.type === "chicken")).toBe(true);
  await client.reload(true);
  expect(client.replica.serverPlayerEntity.position).toEqual({ wx: 0, wy: 0 });
  expect(client.replica.props).toHaveLength(4);
  // The restaged world never had the chicken; nothing of the old world lingers.
  expect(client.replica.entities.some((e) => e.type === "chicken")).toBe(false);
  client.setRunning(true);
  await vi.waitFor(() => expect(client.busy).toBe(false));
  const sample = client.samplePhysicsDiagnostics();
  expect(client.busy).toBe(false); // play continues while diagnostics are read
  expect(await sample).toMatchObject({ collision: expect.anything() });
});

it("refuses play while paused or busy and streams what a paused camera inspects", async () => {
  const { client } = connect();
  await client.ready;
  expect(client.submitInput(move(1))).toBe(false);
  expect(client.submitPress({ type: "vehicle-horn", active: true })).toBe(false);
  expect(client.replica.world.chunks.get(7, 1)).toBeUndefined();
  client.setVisibleRange({ minCx: 6, minCy: 0, maxCx: 7, maxCy: 1 });
  await vi.waitFor(() => {
    client.update();
    expect(client.replica.world.chunks.get(7, 1)).toBeDefined();
  });
  const clock = vi.spyOn(client.replica, "resetPresentationClock");
  client.setRunning(true);
  expect(client.busy).toBe(true);
  expect(client.submitInput(move(1))).toBe(false);
  await vi.waitFor(() => expect(client.busy).toBe(false));
  // The clock fence restarts presentation time at the authority's snapshot.
  expect(clock).toHaveBeenCalledWith(true);
  expect(client.submitInput(move(1))).toBe(true);
  await expect(client.step(move(1))).rejects.toThrow("Pause before stepping");
});

it("reports the authority's clock between answers and the outgoing channel", async () => {
  const { client } = connect();
  expect(client.getDiagnostics().clock).toBeUndefined(); // no answer yet
  await client.ready;
  for (let i = 0; i < 3; i++) await client.step(move(0));
  // The realm's tick counter is the authority's clock (both restart with a new
  // world): the answer and the applied frames agree, and the live clock is theirs.
  expect(client.clock).toEqual({ running: false, ticks: 3 });
  expect(client.replica.serverTick).toBe(3);
  expect(client.getDiagnostics().clock).toEqual({ running: false, ticks: 3 });
  await running(client);
  const answered = required(client.clock).ticks;
  // Frames carry the ticks the authority runs between answers.
  let live = 0;
  await vi.waitFor(() => {
    client.update();
    live = required(client.getDiagnostics().clock).ticks;
    expect(live).toBeGreaterThan(answered + 5);
  });
  expect(client.clock?.ticks).toBe(answered);
  // At a lab's tick cadence, the authority's own answer is never behind and is
  // ahead only by frames not yet applied: those of the ticks since the lab began
  // pumping at that cadence (frames arrive a batch per pump).
  const cadence = performance.now();
  for (let i = 0; i < 5; i++) {
    await frame();
    client.update();
  }
  live = required(client.getDiagnostics().clock).ticks;
  const asked = performance.now();
  await client.samplePhysicsDiagnostics();
  const elapsed = (performance.now() - cadence) / (1000 / 60);
  const truth = required(client.clock).ticks;
  expect(truth - live).toBeGreaterThanOrEqual(0);
  expect(truth - live).toBeLessThanOrEqual(elapsed + 3);
  // The answer's snapshot is applied, and with it any frames the same pump batch
  // carried behind the answer (a running world under load): the live clock counts
  // those too, so it is never behind the answer and ahead only by ticks run since.
  const after = required(client.getDiagnostics().clock);
  expect(after.running).toBe(true);
  expect(after.ticks - truth).toBeGreaterThanOrEqual(0);
  expect(after.ticks - truth).toBeLessThanOrEqual((performance.now() - asked) / (1000 / 60) + 3);
  // A paused world's streamed frames repeat its tick.
  client.setRunning(false);
  await vi.waitFor(() => expect(client.busy).toBe(false));
  const paused = client.getDiagnostics().clock;
  expect(paused).toEqual(client.clock);
  client.setVisibleRange({ minCx: 6, minCy: 0, maxCx: 7, maxCy: 1 });
  await vi.waitFor(() => {
    client.update();
    expect(client.replica.world.chunks.get(7, 1)).toBeDefined();
  });
  expect(client.getDiagnostics().clock).toEqual(paused);
  // A new world restarts both counts.
  await client.reload(true);
  expect(client.clock).toEqual({ running: false, ticks: 0 });
  expect(client.getDiagnostics().clock).toEqual({ running: false, ticks: 0 });
  // The client's messages (start, clock changes, admin requests) went through the
  // ordered channel, and none is left queued.
  const { channel } = client.getDiagnostics();
  expect(channel.highWaterCount).toBeGreaterThan(0);
  expect(channel.queued).toBe(0);
});

it("sends a driver's horn press on the play path and hears the authority's horn", async () => {
  const { client } = connect({
    ...recipe,
    player: createPlayer(80, -28),
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 80, wy: 0, facing: Direction.Right }],
  });
  const horns: VehicleHornMessage[] = [];
  client.onHorn = (message) => horns.push(message);
  await client.ready;
  const car = client.handles.car;
  if (car === undefined) throw Error("Missing car handle");
  const reconcile = vi.spyOn(client.device, "reconcile");
  await client.command({ kind: "enter-vehicle", entityId: car });
  expect(client.replica.serverPlayerEntity.parentId).toBe(car);
  // Lab resets seat the predicted player on its parent.
  expect(reconcile).toHaveBeenLastCalledWith(true, car);
  expect(client.predictor.mount?.id).toBe(car);
  await running(client);
  expect(client.submitPress({ type: "vehicle-horn", active: true })).toBe(true);
  await vi.waitFor(() => {
    client.update();
    expect(horns.at(-1)).toMatchObject({ vehicleId: car, active: true });
  });
});

it("shuts its Worker down on dispose and fails with the authority", async () => {
  const disposed = connect();
  await running(disposed.client);
  const pending = disposed.client.command({ kind: "teleport", position: { wx: 8, wy: 8 } });
  disposed.client.dispose();
  await expect(pending).rejects.toThrow("closed");
  await vi.waitFor(() => expect(disposed.worker.terminated).toBe(1));
  expect(() => disposed.client.update()).not.toThrow();
  expect(disposed.client.submitInput(move(1))).toBe(false);
  // A clock change cut short by dispose is not a failure either.
  const pausing = connect();
  await running(pausing.client);
  pausing.client.setRunning(false);
  pausing.client.dispose();
  await vi.waitFor(() => expect(pausing.worker.terminated).toBe(1));
  expect(() => pausing.client.setRunning(true)).not.toThrow();

  // A clock change the authority refuses fails the lab and stops its Worker.
  const refusedClock = connect();
  await refusedClock.client.ready;
  vi.spyOn(RecipeWorldAuthority.prototype, "admin").mockRejectedValueOnce(Error("clock jammed"));
  refusedClock.client.setRunning(true);
  await vi.waitFor(() => expect(() => refusedClock.client.update()).toThrow("clock jammed"));
  await vi.waitFor(() => expect(refusedClock.worker.terminated).toBe(1));

  const failed = connect();
  await running(failed.client);
  failed.worker.runtime.fail(new Error("tick exploded"));
  await vi.waitFor(() => expect(() => failed.client.update()).toThrow("tick exploded"));
  expect(() => failed.client.setRunning(false)).toThrow("tick exploded");
  expect(failed.worker.terminated).toBe(1);

  const refused = connect({ ...recipe, guest: createPlayer(20, 0) });
  await expect(refused.client.ready).rejects.toThrow("Two-seat");
  await vi.waitFor(() => expect(refused.worker.terminated).toBe(1));
});
