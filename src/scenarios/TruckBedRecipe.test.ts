import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { bedLocalPoint, DUMP_BED, vehicleBedBlocks } from "../traffic/VehicleBed.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { truckBedRecipe } from "./TruckBedRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("walks on the recessed floor, meets sloped walls and can jump out", async () => {
  const session = await ScenarioSession.create(truckBedRecipe());
  try {
    const player = session.player.player;
    const truck = session.realm.entityManager.byId.get(session.handles.truck ?? -1);
    expect(truck?.vehicleBed).toBe(true);
    if (!truck || !player.collider) throw new Error("Missing fixture body");
    for (let i = 0; i < 35; i++) await session.step({ ...idle, dx: 1 });
    expect(player.wz).toBeCloseTo(DUMP_BED.floorZ, 4);
    expect(player.position.wx).toBeGreaterThan(DUMP_BED.center.x + 10);
    expect(
      vehicleBedBlocks(truck, getEntityAABB(player.position, player.collider), player.wz ?? 0, 12),
    ).toBe(false);
    expect(player.position.wx + 5).toBeLessThanOrEqual((0.56 * 400) / 23 + 0.01);
    expect(roofSupport(player, [truck])?.id).toBe(truck.id);
    await session.command({ kind: "vehicle-bed", action: "board" });
    for (let i = 0; i < 35; i++) await session.step({ ...idle, dx: -1 });
    const wallX = player.position.wx;
    for (let i = 0; i < 90; i++) await session.step({ ...idle, dx: -1, jump: i < 25 });
    expect(player.position.wx).toBeLessThan(wallX - 20);
    expect(player.wz).toBeCloseTo(0, 4);
    expect(roofSupport(player, [truck])).toBeUndefined();
  } finally {
    await session.close();
  }
}, 30000);

it("carries a standing player while moving/braking and restores the actual bed height", async () => {
  const session = await ScenarioSession.create(truckBedRecipe());
  try {
    const player = session.player.player;
    let truck = session.realm.entityManager.byId.get(session.handles.truck ?? -1);
    if (!truck) throw new Error("Missing truck");
    const initial = bedLocalPoint(truck, player.position);
    await session.command({ kind: "vehicle-bed", action: "drive" });
    for (let i = 0; i < 120; i++) await session.step(idle);
    expect(truck.position.wx).toBeGreaterThan(25);
    expect(bedLocalPoint(truck, player.position).x).toBeCloseTo(initial.x, 4);
    expect(player.wz).toBeCloseTo(DUMP_BED.floorZ, 4);
    await session.command({ kind: "vehicle-bed", action: "stop" });
    for (let i = 0; i < 90; i++) await session.step(idle);
    expect(Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0)).toBeLessThan(0.01);
    await session.reload();
    truck = session.realm.entityManager.byId.get(session.handles.truck ?? -1);
    expect(truck?.vehicleBed).toBe(true);
    expect(session.player.player.wz).toBeCloseTo(DUMP_BED.floorZ, 4);
    expect(roofSupport(session.player.player, session.realm.entityManager.entities)?.id).toBe(
      truck?.id,
    );
  } finally {
    await session.close();
  }
}, 30000);

it("replicates opt-in bed geometry and its removal through the ordinary binary frame", async () => {
  const session = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = session.realm.entityManager.byId.get(session.handles.truck ?? -1);
    if (!truck) throw new Error("Missing truck");
    const before = serializeEntity(truck),
      copy = deserializeEntity(before);
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 1,
        lastProcessedInputSeq: 0,
        playerEntityId: session.player.player.id,
        entityBaselines: [before],
      }),
    );
    if (frame.type !== "frame") throw new Error("Missing frame");
    expect(frame.entityBaselines?.[0]?.vehicleBed).toBe(true);
    delete truck.vehicleBed;
    const delta = diffEntitySnapshots(before, serializeEntity(truck));
    const changed = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 2,
        lastProcessedInputSeq: 0,
        playerEntityId: session.player.player.id,
        entityDeltas: delta ? [delta] : [],
      }),
    );
    if (changed.type !== "frame" || !changed.entityDeltas?.[0]) throw new Error("Missing delta");
    expect(changed.entityDeltas[0].vehicleBed).toBeNull();
    applyEntityDelta(copy, changed.entityDeltas[0]);
    expect(copy.vehicleBed).toBeUndefined();
    expect(roofSupport(session.player.player, [truck])).toBeUndefined();
    const absent = serializeEntity(truck);
    truck.vehicleBed = true;
    const added = diffEntitySnapshots(absent, serializeEntity(truck));
    const addition = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 3,
        lastProcessedInputSeq: 0,
        playerEntityId: session.player.player.id,
        entityDeltas: added ? [added] : [],
      }),
    );
    if (addition.type !== "frame" || !addition.entityDeltas?.[0])
      throw new Error("Missing added profile");
    applyEntityDelta(copy, addition.entityDeltas[0]);
    expect(copy.vehicleBed).toBe(true);
  } finally {
    await session.close();
  }
}, 30000);
