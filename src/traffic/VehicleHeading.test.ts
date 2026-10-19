import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import {
  deserializeEntity,
  reuseEntitySnapshot,
  serializeEntity,
} from "../shared/serialization.js";
import { createVehicle } from "./Vehicle.js";

it("transmits continuous heading baselines and deltas, invalidates snapshot reuse and removes state", () => {
  const car = createVehicle("ambulance", 100, 100, Direction.Right);
  car.id = 9;
  car.vehicleHeading = Math.fround(1.23);
  const original = serializeEntity(car);
  const roundtrip = (state: ReturnType<typeof serializeEntity>) => {
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 1,
        playerEntityId: 0,
        lastProcessedInputSeq: 0,
        entityBaselines: [state],
      }),
    );
    if (frame.type !== "frame" || !frame.entityBaselines?.[0]) throw Error("Missing baseline");
    return deserializeEntity(frame.entityBaselines[0]);
  };
  const replica = roundtrip(original);
  expect(replica.vehicleHeading).toBe(car.vehicleHeading);
  for (const state of [Math.fround(-3.13), Math.fround(0.75), 0, undefined]) {
    const before = serializeEntity(car);
    if (state === undefined) delete car.vehicleHeading;
    else car.vehicleHeading = state;
    const after = reuseEntitySnapshot(car, before);
    expect(after).not.toBe(before);
    const delta = diffEntitySnapshots(before, after);
    if (!delta) throw Error("Missing delta");
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 2,
        playerEntityId: 0,
        lastProcessedInputSeq: 0,
        entityDeltas: [delta],
      }),
    );
    if (frame.type !== "frame" || !frame.entityDeltas?.[0]) throw Error("Missing decoded delta");
    applyEntityDelta(replica, frame.entityDeltas[0]);
    expect(replica.vehicleHeading).toBe(state);
  }
});
