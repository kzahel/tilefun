import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import {
  deserializeEntity,
  reuseEntitySnapshot,
  serializeEntity,
} from "../shared/serialization.js";
import {
  emergencyEnabled,
  nextEmergencyState,
  sirenStyle,
  validEmergencyState,
} from "./EmergencyVehicle.js";
import { createVehicle } from "./Vehicle.js";

it("retains style through toggles and cycles lights-only/two-tone/wail", () => {
  expect(nextEmergencyState(undefined, "toggle")).toBe(3);
  let state = 3;
  for (const expected of [5, 1, 3]) {
    state = nextEmergencyState(state, "style");
    expect(state).toBe(expected);
  }
  expect(nextEmergencyState(5, "toggle")).toBe(4);
  expect(sirenStyle(4)).toBe(2);
  expect(emergencyEnabled(4)).toBe(false);
  for (const bad of [-1, 6, 2.5, NaN, "3"]) expect(validEmergencyState(bad)).toBe(false);
});

it("transmits on/off/style baselines and deltas, invalidates snapshot reuse and removes state", () => {
  const car = createVehicle("ambulance", 100, 100, Direction.Right);
  car.id = 9;
  car.emergencyState = 3;
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
  expect(replica.emergencyState).toBe(3);
  for (const state of [5, 1, 0, undefined]) {
    const before = serializeEntity(car);
    if (state === undefined) delete car.emergencyState;
    else car.emergencyState = state;
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
    expect(replica.emergencyState).toBe(state);
  }
});
