import { expect, it } from "vitest";
import { decodeServerMessage, encodeServerMessage } from "./binaryCodec.js";
import type { FrameMessage } from "./protocol.js";

// The frame seat list (226 slice 4b-ii): an optional trailing extension.

const frame: FrameMessage = {
  type: "frame",
  serverTick: 7,
  simulationTime: 1.5,
  lastProcessedInputSeq: 9,
  playerEntityId: 42,
  entityExits: [5],
};
const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString("hex");

it("keeps a frame without seats byte for byte, and appends a seat list after the physics", () => {
  const single = encodeServerMessage(frame);
  expect(hex(single)).toBe(
    // tag, tick, ack, player, simulation time, counts (0, 0, 1), exit 5, no physics
    "16" +
      "07000000" +
      "09000000" +
      "2a000000" +
      "000000000000f83f" +
      "000000000100" +
      "05000000" +
      "00",
  );
  const seats = [
    { seat: 0, entityId: 42 },
    { seat: 2, entityId: 0xffff_fffe },
  ];
  const multi = encodeServerMessage({ ...frame, seats });
  // Count 2, then seat 0 → entity 42 and seat 2 → entity 0xfffffffe.
  expect(hex(multi)).toBe(`${hex(single)}02002a00000002feffffff`);
  expect(decodeServerMessage(multi)).toEqual({ ...frame, seats });
  expect(decodeServerMessage(single)).toEqual(frame);
});

it("refuses seat lists that are empty, too long, out of order or out of range", () => {
  for (const seats of [
    [],
    [0, 1, 2, 3, 0].map((seat) => ({ seat, entityId: 1 })),
    [
      { seat: 1, entityId: 1 },
      { seat: 0, entityId: 2 },
    ],
    [
      { seat: 1, entityId: 1 },
      { seat: 1, entityId: 2 },
    ],
    [{ seat: 4, entityId: 1 }],
    [{ seat: 0.5, entityId: 1 }],
    [{ seat: 0, entityId: -1 }],
    [{ seat: 0, entityId: 2 ** 32 }],
  ])
    expect(() => encodeServerMessage({ ...frame, seats })).toThrow(/seat list/);

  const wire = new Uint8Array(encodeServerMessage({ ...frame, seats: [{ seat: 1, entityId: 3 }] }));
  const end = wire.byteLength - 6;
  const patched = (edit: (bytes: Uint8Array) => void) => {
    const copy = wire.slice();
    edit(copy);
    return copy.buffer;
  };
  // A zero count, a count past the end, a seat out of range, and bytes after the list.
  expect(() => decodeServerMessage(patched((b) => b.fill(0, end, end + 1)))).toThrow(/trailing/);
  expect(() => decodeServerMessage(patched((b) => b.fill(2, end, end + 1)))).toThrow(/length/);
  expect(() => decodeServerMessage(patched((b) => b.fill(4, end + 1, end + 2)))).toThrow(
    /seat list/,
  );
  const longer = new Uint8Array(wire.byteLength + 1);
  longer.set(wire);
  expect(() => decodeServerMessage(longer.buffer)).toThrow(/trailing/);
});
