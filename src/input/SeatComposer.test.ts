import { describe, expect, it } from "vitest";
import { Direction, type Entity } from "../entities/Entity.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import { createVehicle } from "../traffic/Vehicle.js";
import {
  devicePacket,
  normalizesDiagonal,
  SeatComposer,
  type SeatSample,
  type SeatSituation,
} from "./SeatComposer.js";

const DT = 1 / 60;
const still = { dx: 0, dy: 0, sprinting: false, jump: false };

function sample(overrides: Partial<SeatSample> = {}): SeatSample {
  const manual = overrides.manual ?? still;
  return {
    manual,
    steered: overrides.steered ?? manual,
    honk: false,
    lights: false,
    style: false,
    throw: false,
    reverse: false,
    hornPressed: false,
    jumpPressed: false,
    ...overrides,
  };
}

function onFoot(overrides: Partial<SeatSituation> = {}): SeatSituation {
  return { vehicle: undefined, locked: false, steering: true, joystick: true, ...overrides };
}

const car = (model = "compact-1"): Entity => ({ ...createVehicle(model, 0, 0), id: 7 });

describe("SeatComposer", () => {
  it("quantizes movement, keeps the unquantized value and sends nothing else on foot", () => {
    const seat = new SeatComposer();
    const tick = seat.tick(
      sample({ manual: { ...still, dx: 0.3, sprinting: true } }),
      onFoot(),
      DT,
    );
    expect(tick).toEqual({
      before: [],
      movement: {
        dx: quantizeAxis(0.3),
        dy: 0,
        sprinting: true,
        jump: false,
        jumpPressed: false,
        reversing: false,
        relativeDriving: false,
      },
      after: [],
    });
    expect(seat.lastMovement).toEqual({ dx: 0.3, dy: 0 });
  });

  it("reports a jump press once per press, including a tap between ticks, never while seated", () => {
    const seat = new SeatComposer();
    const jump = { ...still, jump: true };
    const presses = [
      seat.tick(sample({ jumpPressed: true }), onFoot(), DT),
      seat.tick(sample({ manual: jump }), onFoot(), DT),
      seat.tick(sample({ manual: jump }), onFoot(), DT),
      seat.tick(sample({ manual: jump }), onFoot({ locked: true }), DT),
    ].map((t) => [t.movement.jump, t.movement.jumpPressed]);
    expect(presses).toEqual([
      [false, true],
      [true, true],
      [true, false],
      [true, false],
    ]);
    expect(
      seat.tick(sample({ jumpPressed: true }), onFoot({ locked: true }), DT).movement.jumpPressed,
    ).toBe(false);
    const seated = seat.tick(
      sample({ manual: jump, jumpPressed: true }),
      onFoot({ vehicle: car() }),
      DT,
    );
    expect(seated.movement).toMatchObject({ jump: false, jumpPressed: false });
  });

  it("holds the horn with a refresh and one release, and a short tap still honks", () => {
    const seat = new SeatComposer();
    const inCar = onFoot({ vehicle: car() });
    const horns: number[] = [];
    for (let i = 0; i < 30; i++)
      if (seat.tick(sample({ honk: true }), inCar, DT).before.length) horns.push(i);
    expect(horns[0]).toBe(0);
    for (let i = 1; i < horns.length; i++)
      expect([12, 13]).toContain((horns[i] ?? 0) - (horns[i - 1] ?? 0));
    expect(seat.tick(sample(), inCar, DT).before).toEqual([
      { type: "vehicle-horn", active: false },
    ]);
    expect(seat.tick(sample({ hornPressed: true }), inCar, DT).before).toEqual([
      { type: "vehicle-horn", active: true },
    ]);
    expect(seat.tick(sample(), inCar, DT).before).toEqual([
      { type: "vehicle-horn", active: false },
    ]);
    expect(seat.tick(sample({ honk: true }), onFoot(), DT).before).toEqual([]);
  });

  it("toggles sirens and style on press edges, ignoring keys held while boarding", () => {
    const seat = new SeatComposer();
    const ambulance = car("ambulance");
    expect(seat.board(ambulance, true, true)).toBe(true);
    expect(seat.board(ambulance, false, false)).toBe(false);
    const inside = onFoot({ vehicle: ambulance });
    expect(seat.tick(sample({ lights: true, style: true }), inside, DT).before).toEqual([]);
    seat.tick(sample(), inside, DT);
    expect(seat.tick(sample({ lights: true, style: true }), inside, DT).before).toEqual([
      { type: "vehicle-emergency", action: "toggle" },
      { type: "vehicle-emergency", action: "style" },
    ]);
    const truck = car("garbage-truck-green");
    seat.board(truck, false, false);
    seat.tick(sample(), onFoot({ vehicle: truck }), DT);
    expect(
      seat.tick(sample({ lights: true, style: true }), onFoot({ vehicle: truck }), DT).before,
    ).toEqual([{ type: "vehicle-emergency", action: "toggle" }]);
  });

  it("charges a throw while held and throws on release, aimed by movement or facing", () => {
    const seat = new SeatComposer();
    const facingLeft = onFoot({ facing: Direction.Left });
    for (let i = 0; i < 30; i++)
      expect(seat.tick(sample({ throw: true }), facingLeft, DT).after).toEqual([]);
    const [thrown] = seat.tick(sample(), facingLeft, DT).after;
    expect(thrown).toMatchObject({ type: "throw-ball", dirX: -1, dirY: 0 });
    expect((thrown as { force: number }).force).toBeCloseTo(0.5, 6);
    for (let i = 0; i < 90; i++) seat.tick(sample({ throw: true }), facingLeft, DT);
    expect(seat.tick(sample({ manual: { ...still, dy: 1 } }), facingLeft, DT).after).toEqual([
      { type: "throw-ball", dirX: 0, dirY: 1, force: 1 },
    ]);
    // Each throw charges from zero again.
    for (let i = 0; i < 15; i++) seat.tick(sample({ throw: true }), facingLeft, DT);
    const [quick] = seat.tick(sample(), facingLeft, DT).after;
    expect((quick as { force: number }).force).toBeCloseTo(0.25, 6);
    // No throw from a vehicle, or when the release lands while input is locked.
    seat.tick(sample({ throw: true }), onFoot({ vehicle: car() }), DT);
    expect(seat.tick(sample(), onFoot({ vehicle: car() }), DT).after).toEqual([]);
    seat.tick(sample({ throw: true }), facingLeft, DT);
    expect(seat.tick(sample(), { ...facingLeft, locked: true }, DT).after).toEqual([]);
  });

  it("drives with reverse and relative steering only for manual or joystick input", () => {
    const seat = new SeatComposer();
    const inCar = onFoot({ vehicle: car(), joystick: false });
    const forward = { ...still, dy: -1 };
    expect(seat.tick(sample({ manual: forward, reverse: true }), inCar, DT).movement).toMatchObject(
      {
        reversing: true,
        relativeDriving: true,
      },
    );
    // A tap/hold destination steers in world space.
    expect(seat.tick(sample({ steered: forward }), inCar, DT).movement).toMatchObject({
      dy: -1,
      relativeDriving: false,
    });
    expect(seat.tick(sample(), { ...inCar, joystick: true }, DT).movement.relativeDriving).toBe(
      true,
    );
    expect(
      seat.tick(sample({ manual: forward }), { ...inCar, steering: false }, DT).movement
        .relativeDriving,
    ).toBe(false);
    expect(seat.tick(sample({ reverse: true }), onFoot(), DT).movement.reversing).toBe(false);
    expect(normalizesDiagonal(car(), true)).toBe(false);
    expect(normalizesDiagonal(car(), false)).toBe(true);
    expect(normalizesDiagonal(undefined, true)).toBe(true);
  });

  it("cancel drops movement and a charged throw", () => {
    const seat = new SeatComposer();
    seat.tick(sample({ manual: { ...still, dx: 1 }, throw: true }), onFoot(), DT);
    seat.cancel();
    expect(seat.lastMovement).toEqual({ dx: 0, dy: 0 });
    expect(seat.tick(sample(), onFoot(), DT).after).toEqual([]);
  });
});

describe("devicePacket", () => {
  const walk = { dx: 1, dy: 0, sprinting: false, jump: false };
  it("sends seat 0 as today's player-input with explicit flags", () => {
    expect(devicePacket(4, [{ body: 1, movement: walk }])).toEqual({
      input: {
        type: "player-input",
        seq: 4,
        ...walk,
        jumpPressed: false,
        reversing: false,
        relativeDriving: false,
      },
      coSeats: undefined,
    });
  });

  it("puts every other seat under the same sequence, keyed by controlled body", () => {
    const drive = { ...walk, dy: -1, relativeDriving: true };
    const packet = devicePacket(9, [
      { body: 1, movement: walk },
      { body: 70, movement: drive },
    ]);
    expect(packet.input.seq).toBe(9);
    expect(packet.coSeats).toEqual(new Map([[70, drive]]));
    expect(() => devicePacket(1, [])).toThrow();
    expect(() =>
      devicePacket(1, [
        { body: 70, movement: walk },
        { body: 70, movement: drive },
      ]),
    ).toThrow("same body");
  });
});
