import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { SeatSample } from "../input/SeatComposer.js";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import type { Movement } from "../shared/Movement.js";
import type { RequestMessage } from "../shared/requests.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { ClientSeat } from "./ClientSeat.js";
import { DeviceSeats, type Requester, type SeatFrame } from "./DeviceSeats.js";
import { composeDeviceTick } from "./DeviceTick.js";

const DT = 1 / 60;
const walk = (dx: number, extra: Partial<Movement> = {}): Movement => ({
  dx,
  dy: 0,
  sprinting: false,
  jump: false,
  ...extra,
});
const sample = (movement: Movement, extra: Partial<SeatSample> = {}): SeatSample => ({
  ...neutralSample(),
  manual: movement,
  steered: movement,
  ...extra,
});
const onFoot = { vehicle: undefined, locked: false, steering: true, joystick: false };
const still = { ...NEUTRAL_MOVEMENT, jumpPressed: false, reversing: false, relativeDriving: false };

/** A guest's devices that report fixed movement and held keys. */
function input(movement: Movement = walk(1), held = false) {
  return {
    steering: true,
    held: vi.fn(() => held),
    sample: vi.fn((locked: boolean) => (locked ? neutralSample() : sample(movement))),
    clear: vi.fn(),
    dispose: vi.fn(),
  } satisfies SeatInput;
}

/** Answers each request at once and records it. */
function requester() {
  const sent: RequestMessage[] = [];
  const request = (async (msg: RequestMessage) => {
    sent.push(msg);
    if (msg.type === "join-seat")
      return { type: "seat-joined", requestId: msg.requestId, seat: msg.seat, entityId: 9 };
    return { type: "seat-left", requestId: msg.requestId, seat: 1 };
  }) as Requester;
  return { request, sent };
}

describe("ClientSeat", () => {
  it("latches a jump, cancels onto its next command and addresses its messages", () => {
    const seat = new ClientSeat(2);
    seat.latchJump();
    expect(seat.takeJump()).toBe(true);
    expect(seat.takeJump()).toBe(false);
    seat.latchJump();
    seat.cancel();
    expect(seat.takeJump()).toBe(false);
    expect(seat.takeCancel()).toBe(true);
    expect(seat.takeCancel()).toBe(false);
    const horn = { type: "vehicle-horn", active: true } as const;
    expect(seat.address(horn)).toEqual({ type: "seat", seat: 2, message: horn });
    expect(new ClientSeat(0).address(horn)).toBe(horn);
  });

  it("clears its input set's held keys only when play stops, and restarts afresh", () => {
    const devices = input();
    const seat = new ClientSeat(1, devices);
    seat.cancel();
    expect(devices.clear).not.toHaveBeenCalled(); // a cancel keeps keys held
    seat.clear();
    expect(devices.clear).toHaveBeenCalledOnce();
    const composer = seat.composer;
    seat.restart();
    expect(seat.composer).not.toBe(composer);
    expect(seat.takeCancel()).toBe(false);
  });
});

describe("DeviceSeats", () => {
  it("joins and leaves guests through authority, keeping seat 0", async () => {
    const seats = new DeviceSeats();
    const { request, sent } = requester();
    const devices = input();
    const guest = await seats.join(request, 4, 2, devices, { displayName: "Kid" });
    expect(sent).toEqual([{ type: "join-seat", requestId: 4, seat: 2, displayName: "Kid" }]);
    expect(seats.list().map((s) => s.seat)).toEqual([0, 2]);
    expect(seats.get(2)).toBe(guest);
    await expect(seats.join(request, 5, 2, input())).rejects.toThrow("taken");
    await expect(seats.join(request, 5, 0, input())).rejects.toThrow("taken");
    await seats.leave(request, 6, 2);
    expect(sent.at(-1)).toEqual({ type: "leave-seat", requestId: 6, seat: 2 });
    expect(devices.dispose).toHaveBeenCalledOnce();
    expect(seats.list().map((s) => s.seat)).toEqual([0]);
    await expect(seats.leave(request, 7, 2)).rejects.toThrow("not playing");
    await expect(seats.leave(request, 7, 0)).rejects.toThrow("not playing");
  });

  it("keeps a guest whose join or leave authority refuses", async () => {
    const seats = new DeviceSeats();
    const refuse = (async () => {
      throw Error("refused");
    }) as Requester;
    await expect(seats.join(refuse, 1, 1, input())).rejects.toThrow("refused");
    expect(seats.get(1)).toBeUndefined();
    const { request } = requester();
    await seats.join(request, 2, 1, input());
    await expect(seats.leave(refuse, 3, 1)).rejects.toThrow("refused");
    expect(seats.get(1)).toBeDefined();
    seats.drop(0); // seat 0 never goes
    seats.drop(1);
    expect(seats.list().map((s) => s.seat)).toEqual([0]);
    // Teardown releases every guest's input set.
    const devices = [input(), input()];
    await seats.join(request, 4, 1, devices[0] as SeatInput);
    await seats.join(request, 5, 3, devices[1] as SeatInput);
    seats.dispose();
    expect(seats.list().map((s) => s.seat)).toEqual([0]);
    for (const d of devices) expect(d.dispose).toHaveBeenCalledOnce();
  });

  it("samples each guest from its devices beside its body or vehicle; a device-less guest stands still", async () => {
    const seats = new DeviceSeats();
    const { request } = requester();
    const devices = input(walk(1), true);
    await seats.join(request, 1, 2, devices);
    await seats.join(request, 2, 1, null as unknown as SeatInput);
    const car = { ...createVehicle("compact-1", 0, 0), id: 9 };
    const rider: Entity = { ...createPlayer(0, 0), id: 5, parentId: 9 };
    const walker: Entity = { ...createPlayer(0, 0), id: 6 };
    const world = {
      seats: {
        entities: new Map([
          [0, 1],
          [1, 6],
          [2, 5],
        ]),
      },
      serverEntities: [car, rider, walker],
    };
    const [first, second] = seats.guestFrames(world, false);
    expect(first?.seat.seat).toBe(1);
    expect(first?.sample).toEqual(neutralSample());
    expect(first?.situation).toMatchObject({ vehicle: undefined, steering: false });
    expect(second?.seat.seat).toBe(2);
    expect(second?.situation).toMatchObject({ vehicle: car, locked: false, steering: true });
    expect(second?.sample.manual).toEqual(walk(1));
    expect(devices.sample).toHaveBeenLastCalledWith(false, car);
    // Keys held while boarding do not toggle sirens or style until released.
    expect(devices.held).toHaveBeenCalledWith("vehicle_lights");
    expect(second?.seat.composer.board(car, false, false)).toBe(false);
    seats.guestFrames(world, true);
    expect(devices.sample).toHaveBeenLastCalledWith(true, car);
  });

  it("stops every seat: guests' horns released in their envelopes, then one still packet", async () => {
    const seats = new DeviceSeats();
    const { request } = requester();
    const devices = input();
    await seats.join(request, 1, 1, devices);
    seats.host.latchJump();
    expect(seats.stopHorns()).toEqual([
      { type: "seat", seat: 1, message: { type: "vehicle-horn", active: false } },
    ]);
    seats.clear();
    expect(seats.host.takeJump()).toBe(false);
    expect(devices.clear).toHaveBeenCalledOnce();
    expect(seats.neutralPacket(12)).toEqual({
      type: "player-input",
      seq: 12,
      ...still,
      seats: [{ seat: 1, ...still }],
    });
    const composers = seats.list().map((s) => s.composer);
    seats.restart();
    expect(seats.list().some((s, i) => s.composer === composers[i])).toBe(false);
  });
});

describe("composeDeviceTick", () => {
  it("sends every seat's command on one sequence, each seat's presses in its envelope", () => {
    const host = new ClientSeat(0);
    const guest = new ClientSeat(1);
    const car = { ...createVehicle("compact-1", 0, 0), id: 9 };
    guest.composer.board(car, false, false);
    const frames: SeatFrame[] = [
      { seat: host, sample: sample(walk(1)), situation: onFoot },
      {
        seat: guest,
        sample: sample(walk(0, { dy: -1 } as Partial<Movement>), { honk: true }),
        situation: { ...onFoot, vehicle: car },
      },
    ];
    const tick = composeDeviceTick(frames, 7, DT);
    expect(tick.before).toEqual([
      { type: "seat", seat: 1, message: { type: "vehicle-horn", active: true } },
    ]);
    expect(tick.input).toMatchObject({
      type: "player-input",
      seq: 7,
      dx: 1,
      seats: [{ seat: 1, dy: -1 }],
    });
    expect(tick.host.movement).toMatchObject({ dx: 1 });
    expect(tick.coSeats?.get(1)).toMatchObject({ dy: -1, relativeDriving: true });
    expect(() => composeDeviceTick([], 8, DT)).toThrow("seat 0");
  });

  it("makes a cancelled seat's command still on its next tick only, keeping other seats moving", () => {
    const host = new ClientSeat(0);
    const guest = new ClientSeat(1);
    const frames = (): SeatFrame[] => [
      { seat: host, sample: sample(walk(1), { jumpPressed: true }), situation: onFoot },
      { seat: guest, sample: sample(walk(-1)), situation: onFoot },
    ];
    host.cancel();
    const cancelled = composeDeviceTick(frames(), 1, DT);
    expect(cancelled.host.movement).toMatchObject({ dx: 0, jumpPressed: false });
    expect(cancelled.coSeats?.get(1)).toMatchObject({ dx: -1 });
    expect(host.composer.lastMovement).toEqual({ dx: 0, dy: 0 });
    expect(composeDeviceTick(frames(), 2, DT).host.movement).toMatchObject({ dx: 1 });
  });
});
