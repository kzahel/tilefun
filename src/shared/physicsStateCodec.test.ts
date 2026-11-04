import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import {
  MAX_PREDICTION_BODIES,
  type PhysicsBodyState,
  type PhysicsState,
} from "../physics/PhysicsState.js";
import { World } from "../world/World.js";
import { decodeServerMessage, encodeServerMessage } from "./binaryCodec.js";
import type { FrameMessage } from "./protocol.js";

const body: PhysicsBodyState = {
  id: 7,
  kind: "character",
  x: 12345678.125,
  y: -9876543.625,
  z: 4.25,
  prevX: 12345677.125,
  prevY: -9876543.125,
  prevZ: 3.75,
  vx: 32.5,
  vy: -16.25,
  vz: 48,
  heading: 1.5,
  prevHeading: 1.25,
  groundZ: 2.5,
  jumpHeld: true,
  jumpQueued: true,
  grounded: false,
  desiredVx: 64,
  desiredVy: 0,
  normalX: 0,
  normalY: 1,
  normalZ: 0,
  supportId: 11,
  inheritedVx: 48.5,
  inheritedVy: -32,
  controlUntil: 1015,
  altitude: 24,
  desiredHeading: -0.75,
  desiredDriveSpeed: -56,
  desiredSteering: 0.5,
};
const state: PhysicsState = { epoch: 42, tick: 1001, omitted: 3, bodies: [body], contacts: [] };
function frame(physics: PhysicsState): FrameMessage {
  return { type: "frame", serverTick: 1010, lastProcessedInputSeq: 99, playerEntityId: 7, physics };
}
it("ordinary binary frames retain one common physics tick, motor/support state and precise world coordinates", () => {
  const wire = encodeServerMessage(frame(state));
  expect(decodeServerMessage(wire)).toEqual(frame(state));
  expect(wire.byteLength).toBe(27 + 1 + 16 + 118);
  const minimal = { ...state, bodies: [{ ...body, kind: "loose" as const }] };
  delete minimal.bodies[0]?.altitude;
  delete minimal.bodies[0]?.desiredHeading;
  delete minimal.bodies[0]?.supportId;
  expect(decodeServerMessage(encodeServerMessage(frame(minimal)))).toEqual(frame(minimal));
});
it("rejects oversized, duplicate, nonfinite, truncated and trailing physics state", () => {
  expect(() =>
    encodeServerMessage(frame({ ...state, bodies: Array(MAX_PREDICTION_BODIES + 1).fill(body) })),
  ).toThrow(/limit/);
  expect(() => encodeServerMessage(frame({ ...state, bodies: [body, body] }))).toThrow(/Duplicate/);
  expect(() =>
    encodeServerMessage(frame({ ...state, bodies: [{ ...body, vx: Infinity }] })),
  ).toThrow(/finite/);
  const wire = encodeServerMessage(frame(state));
  expect(() => decodeServerMessage(wire.slice(0, -1))).toThrow(/length/);
  const extra = new Uint8Array(wire.byteLength + 1);
  extra.set(new Uint8Array(wire));
  expect(() => decodeServerMessage(extra.buffer)).toThrow(/trailing/);
  new DataView(wire).setUint16(40, MAX_PREDICTION_BODIES + 1, true);
  expect(() => decodeServerMessage(wire)).toThrow(/count/);
});

it("round-trips bounded solved pairs and rejects duplicate or unknown contact identities", () => {
  const coupled: PhysicsState = {
    ...state,
    bodies: [body, { ...body, id: 11 }],
    contacts: [[7, 11]],
  };
  const wire = encodeServerMessage(frame(coupled));
  expect(decodeServerMessage(wire)).toEqual(frame(coupled));
  expect(wire.byteLength).toBe(27 + 1 + 16 + 2 * 118 + 8);
  expect(() =>
    encodeServerMessage(
      frame({
        ...coupled,
        contacts: [
          [7, 11],
          [7, 11],
        ],
      }),
    ),
  ).toThrow(/contact/);
  new DataView(wire).setUint32(wire.byteLength - 4, 99, true);
  expect(() => decodeServerMessage(wire)).toThrow(/contact/);
});

it("replicas retain frame physics state and clear it across world resets", () => {
  const view = new RemoteStateView(new World());
  const decoded = decodeServerMessage(encodeServerMessage(frame(state)));
  if (decoded.type !== "frame") throw Error("Expected frame");
  view.applyFrame(decoded);
  expect(view.physicsState).toEqual(state);
  view.clear();
  expect(view.physicsState).toBeUndefined();
});
