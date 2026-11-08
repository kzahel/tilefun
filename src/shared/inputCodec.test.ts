import { describe, expect, it } from "vitest";
import { decodeClientMessage, encodeClientMessage } from "./binaryCodec.js";
import type { ClientMessage } from "./protocol.js";

type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;

const seat0 = { dx: 1, dy: -1, sprinting: true, jump: false, relativeDriving: true };

describe("device input packet (226)", () => {
  it("keeps a single seat's eight bytes", () => {
    const bytes = new Uint8Array(
      encodeClientMessage({ type: "player-input", seq: 0x01020304, ...seat0 }),
    );
    expect([...bytes]).toEqual([0x81, 0x04, 0x03, 0x02, 0x01, 127, 129, 0x11]);
  });

  it("carries the other seats' movement on the same sequence, four bytes each", () => {
    const input: PlayerInput = {
      type: "player-input",
      seq: 77,
      ...seat0,
      seats: [
        { seat: 3, dx: 0, dy: 1, sprinting: false, jump: true, jumpPressed: true },
        { seat: 1, dx: -0.5, dy: 0, sprinting: false, jump: false, reversing: true },
      ],
    };
    const buffer = encodeClientMessage(input);
    expect(buffer.byteLength).toBe(16);
    const decoded = decodeClientMessage(buffer) as PlayerInput;
    expect(decoded).toMatchObject({ seq: 77, ...seat0 });
    expect(decoded.seats).toEqual([
      { seat: 3, dx: 0, dy: 1, sprinting: false, jump: true, jumpPressed: true },
      { seat: 1, dx: -63 / 127, dy: 0, sprinting: false, jump: false, reversing: true },
    ]);
    expect(decodeClientMessage(encodeClientMessage({ ...input, seats: [] }))).not.toHaveProperty(
      "seats",
    );
  });

  it("refuses seats outside the device and malformed lengths", () => {
    const base: PlayerInput = { type: "player-input", seq: 1, ...seat0 };
    const other = { dx: 0, dy: 0, sprinting: false, jump: false };
    for (const seat of [0, 4, 1.5])
      expect(() => encodeClientMessage({ ...base, seats: [{ seat, ...other }] })).toThrow(
        "Invalid input seat",
      );
    const four = [1, 2, 3, 1].map((seat) => ({ seat, ...other }));
    expect(() => encodeClientMessage({ ...base, seats: four })).toThrow("Too many seats");

    const packet = (seat: number) => {
      const buffer = encodeClientMessage({ ...base, seats: [{ seat: 2, ...other }] });
      new DataView(buffer).setUint8(8, seat);
      return buffer;
    };
    expect(() => decodeClientMessage(packet(0))).toThrow("Invalid input seat");
    expect(() => decodeClientMessage(packet(4))).toThrow("Invalid input seat");
    const short = encodeClientMessage({ ...base, seats: [{ seat: 1, ...other }] }).slice(0, 10);
    expect(() => decodeClientMessage(short)).toThrow("input length");
    const long = new ArrayBuffer(8 + 4 * 4);
    new DataView(long).setUint8(0, 0x81);
    expect(() => decodeClientMessage(long)).toThrow("input length");
  });
});
