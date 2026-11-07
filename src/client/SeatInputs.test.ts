import { describe, expect, it } from "vitest";
import type { Movement } from "../shared/Movement.js";
import { SeatReplay } from "./SeatInputs.js";

const move = (dx: number, jump = false): Movement => ({ dx, dy: 0, sprinting: false, jump });

describe("SeatReplay", () => {
  it("coalesces due inputs to the latest axes but keeps a jump press edge once", () => {
    const replay = new SeatReplay(() => false);
    replay.consume(new Map([[7, move(1, true)]]));
    replay.consume(new Map([[7, move(-1, true)]]));
    expect(replay.take()?.get(7)).toMatchObject({ dx: -1, jump: true, jumpPressed: true });
    expect(replay.take()?.get(7)).toMatchObject({ dx: -1, jumpPressed: false });
  });

  it("seeds jump state from the snapshot so a held jump is not a new press", () => {
    const replay = new SeatReplay((id) => id === 7);
    replay.consume(new Map([[7, move(0, true)]]));
    expect(replay.take()?.get(7)?.jumpPressed).toBe(false);
  });

  it("stops holding a seat that leaves the device's input and drops its press", () => {
    const replay = new SeatReplay(() => false);
    replay.consume(new Map([[7, move(1)]]));
    replay.consume(new Map([[8, move(0, true)]]));
    replay.consume(new Map([[9, move(1)]]));
    expect([...(replay.take()?.keys() ?? [])]).toEqual([9]);
    replay.consume(undefined);
    expect(replay.take()).toBeUndefined();
    replay.consume(new Map([[8, move(0)]]));
    expect(replay.take()?.get(8)?.jumpPressed).toBe(false);
  });
});
