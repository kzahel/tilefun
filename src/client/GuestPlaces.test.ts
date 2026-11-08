/**
 * Guests' place controls (226 slice 5-ii-b): a guest's own enter and equipment keys
 * (or pad buttons) act for its own body, in its envelope, with prompts in its view.
 */
import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { ActionManager } from "../input/ActionManager.js";
import { seatKeyMap } from "../input/KeyboardSchemes.js";
import { PadActions } from "../input/PadActions.js";
import { ActionSeatInput } from "../input/SeatInput.js";
import { DeviceSeats } from "../session/DeviceSeats.js";
import { createVehicle } from "../traffic/Vehicle.js";
import type { DoorRequest, VehicleRequest } from "../ui/PlacePrompts.js";
import { GuestPlaces, type GuestPlacesHost } from "./GuestPlaces.js";

const DT = 1 / 60;
const requester = async () => ({}) as never;

/** A country house whose street door threshold is at (100, 100). */
const house = {
  id: 50,
  type: "prop-country-house",
  proceduralId: "farmstead:0:0:east:house",
  position: { wx: 100, wy: 92 },
} as unknown as Prop;

async function harness() {
  const host0: Entity = { ...createPlayer(600, 600), id: 1 };
  const guest: Entity = { ...createPlayer(400, 100), id: 2 };
  const replica = {
    seats: {
      entities: new Map([
        [0, 1],
        [1, 2],
      ]),
    },
    serverEntities: [host0, guest] as Entity[],
    entities: [host0, guest] as Entity[],
    props: [] as Prop[],
    editorEnabled: false,
    interior: null,
  };
  const seats = new DeviceSeats();
  const order: string[] = [];
  const requests: { message: DoorRequest | VehicleRequest; seat: number }[] = [];
  let reject: Error | undefined;
  const presentation = {
    busy: false,
    begin: vi.fn(() => {
      order.push("begin");
      presentation.busy = true;
    }),
    cancel: vi.fn(() => {
      order.push("cancel");
      presentation.busy = false;
    }),
  };
  const host = {
    session: { seats, replica, prediction: null } as unknown as GuestPlacesHost["session"],
    doorPresentation: presentation,
    playing: true,
    overlayOpen: false,
    inputBlocked: false,
    storagePaused: false,
    clearPlayInput: vi.fn((sendNeutral?: boolean) => {
      order.push(`clear:${sendNeutral ?? true}`);
    }),
    request: vi.fn(async (message: DoorRequest | VehicleRequest, seat: number) => {
      order.push(`request:${message.type}`);
      requests.push({ message, seat });
      if (reject) {
        const error = reject;
        reject = undefined;
        throw error;
      }
    }),
  };
  const places = new GuestPlaces(host);
  const keys = new ActionManager(seatKeyMap("right"));
  keys.disableGamepad();
  const input = new ActionSeatInput(keys);
  const seat = await seats.join(requester, 1, 1, input);
  return {
    replica,
    guest,
    host,
    seats,
    seat,
    keys,
    places,
    presentation,
    order,
    requests,
    failNext(error: Error) {
      reject = error;
    },
    step(ticks = 1, ready = true) {
      for (let i = 0; i < ticks; i++) places.update(DT, ready);
    },
    press(code: string) {
      keys.pressKey(code);
      keys.releaseKey(code);
    },
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

describe("guests' place controls (226)", () => {
  it("a guest's enter key drives the car beside its own body, stopping only its seat", async () => {
    const h = await harness();
    const car = { ...createVehicle("compact-1", 416, 100), id: 7 };
    h.replica.entities.push(car);
    h.replica.serverEntities.push(car);
    h.step();
    expect(h.seat.prompts).toEqual(["Drive car · '"]);
    h.keys.pressKey("ArrowUp"); // held while boarding
    h.press("Quote");
    await h.settle();
    expect(h.requests).toEqual([{ message: { type: "enter-vehicle", entityId: 7 }, seat: 1 }]);
    expect(h.host.clearPlayInput).not.toHaveBeenCalled(); // seat 0 keeps moving
    expect(h.seat.takeCancel()).toBe(true); // the guest's next command is still
    expect(h.keys.isHeld("move_up")).toBe(false); // and its held keys are forgotten
    // Seated, the same key gets out.
    h.guest.parentId = 7;
    h.step();
    expect(h.seat.prompts).toEqual(["Get out · '"]);
    h.press("Quote");
    await h.settle();
    expect(h.requests.at(-1)).toEqual({ message: { type: "exit-vehicle" }, seat: 1 });
  });

  it("its equipment key runs the equipment beside a stopped truck; a pad labels its buttons", async () => {
    const h = await harness();
    const truck = { ...createVehicle("dump-truck", 430, 100), id: 9 };
    h.replica.entities.push(truck);
    h.step();
    expect(h.seat.prompts).toEqual(["Tip bed · ;", "Drive car · '"]);
    h.press("Semicolon");
    await h.settle();
    expect(h.requests).toEqual([
      { message: { type: "vehicle-equipment", entityId: 9, action: "tip" }, seat: 1 },
    ]);

    const pad = new PadActions(1);
    const padGuest = await h.seats.join(requester, 2, 2, new ActionSeatInput(pad));
    h.replica.seats.entities.set(2, 3);
    const padBody = { ...createPlayer(420, 120), id: 3 };
    h.replica.serverEntities.push(padBody);
    h.step();
    expect(padGuest.prompts).toEqual(["Tip bed · D↓", "Drive car · Y"]);
    const buttons = (pressed: number[]) =>
      Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) }));
    pad.poll({ connected: true, axes: [0, 0], buttons: buttons([]) }, false);
    pad.poll({ connected: true, axes: [0, 0], buttons: buttons([3]) }, false);
    await h.settle();
    expect(h.requests.at(-1)).toEqual({ message: { type: "enter-vehicle", entityId: 9 }, seat: 2 });
  });

  it("a door takes the device through: pressed, or walked into after a fresh approach", async () => {
    const h = await harness();
    h.replica.props.push(house);
    h.step(); // a fresh approach, far from the door
    h.guest.position = { wx: 100, wy: 110 };
    h.step();
    expect(h.seat.prompts).toEqual(["Enter home · '"]);
    h.press("Quote");
    await h.settle();
    expect(h.requests).toEqual([
      {
        message: {
          type: "enter-building",
          featureId: "farmstead:0:0:east:house",
          doorId: "street",
        },
        seat: 1,
      },
    ]);
    // The device stops together for a pressed trip.
    expect(h.order).toEqual(["clear:true", "request:enter-building"]);

    const walk = await harness();
    walk.replica.props.push(house);
    walk.step();
    walk.guest.position = { wx: 100, wy: 104 };
    walk.seat.composer.lastMovement = { dx: 0, dy: -1 };
    walk.step(5);
    expect(walk.requests).toEqual([]); // intent must last 0.1 s
    walk.step(2);
    await walk.settle();
    expect(walk.requests.map((r) => [r.message, r.seat])).toEqual([
      [
        {
          type: "enter-building",
          featureId: "farmstead:0:0:east:house",
          doorId: "street",
          walkThrough: true,
        },
        1,
      ],
    ]);
    // The walk keeps the guest's last direction for the authority's approach check,
    // and the device veil holds every seat.
    expect(walk.order).toEqual(["clear:false", "begin", "request:enter-building"]);
  });

  it("a refused request shows in its view until its target changes; a failed walk lifts the veil", async () => {
    const h = await harness();
    const car = { ...createVehicle("compact-1", 416, 100), id: 7 };
    h.replica.entities.push(car);
    h.step();
    h.failNext(new Error("That car is taken."));
    h.press("Quote");
    await h.settle();
    h.step();
    expect(h.seat.prompts).toEqual(["Drive car · '", "Error: That car is taken."]);
    h.replica.entities.pop();
    h.step();
    expect(h.seat.prompts).toEqual([]);

    const walk = await harness();
    walk.replica.props.push(house);
    walk.step();
    walk.guest.position = { wx: 100, wy: 104 };
    walk.seat.composer.lastMovement = { dx: 0, dy: -1 };
    walk.failNext(new Error("blocked"));
    walk.step(7);
    await walk.settle();
    expect(walk.order).toEqual(["clear:false", "begin", "request:enter-building", "cancel"]);
  });

  it("presses act only in play with input unblocked; a storage pause locks only the car", async () => {
    const h = await harness();
    const car = { ...createVehicle("compact-1", 416, 100), id: 7 };
    h.replica.entities.push(car);
    h.step();
    h.host.inputBlocked = true;
    h.press("Quote");
    h.host.inputBlocked = false;
    h.host.playing = false;
    h.press("Quote");
    h.host.playing = true;
    h.host.storagePaused = true;
    h.press("Quote"); // the car prompt still claims the key
    h.press("Semicolon");
    h.host.storagePaused = false;
    h.presentation.busy = true;
    h.press("Quote");
    await h.settle();
    expect(h.requests).toEqual([]);

    const door = await harness();
    door.replica.props.push(house);
    door.step();
    door.guest.position = { wx: 100, wy: 110 };
    door.step();
    door.host.storagePaused = true;
    door.press("Quote");
    await door.settle();
    expect(door.requests).toHaveLength(1);
    door.presentation.busy = true;
    door.press("Quote");
    await door.settle();
    expect(door.requests).toHaveLength(1);
  });

  it("a car beside a door claims the key; overlays hide the door; a train call is announced", async () => {
    const h = await harness();
    h.replica.props.push(house);
    h.step();
    h.guest.position = { wx: 100, wy: 110 };
    const car = { ...createVehicle("compact-1", 116, 110), id: 7 };
    h.replica.entities.push(car);
    h.step();
    expect(h.seat.prompts).toEqual(["Drive car · '"]);
    h.press("Quote");
    await h.settle();
    expect(h.requests.map((r) => r.message.type)).toEqual(["enter-vehicle"]);
    // Walking into the doorway beside the car does not go through either.
    h.guest.position = { wx: 100, wy: 104 };
    h.seat.composer.lastMovement = { dx: 0, dy: -1 };
    h.step(20);
    await h.settle();
    expect(h.requests.map((r) => r.message.type)).toEqual(["enter-vehicle"]);
    h.replica.entities.pop();
    h.host.overlayOpen = true; // the world map or a catalog over play
    h.step();
    expect(h.seat.prompts).toEqual([]);

    const train = await harness();
    const bench = {
      id: 60,
      type: "prop-rail-bench",
      proceduralId: "rail:0:bench:0",
      position: { wx: 400, wy: 100 },
      collider: { offsetX: 0, offsetY: 0, width: 16, height: 8 },
    } as unknown as Prop;
    train.replica.props.push(bench);
    train.step();
    expect(train.seat.prompts).toEqual(["Call train · '"]);
    train.press("Quote");
    await train.settle();
    train.step();
    expect(train.requests).toEqual([{ message: { type: "call-train", benchId: 60 }, seat: 1 }]);
    expect(train.seat.prompts).toEqual(["Call train · '", "Poof! Your train is here."]);
  });

  it("blocked input stops a door press and a walk-through", async () => {
    const h = await harness();
    h.replica.props.push(house);
    h.step();
    h.guest.position = { wx: 100, wy: 104 };
    h.step();
    expect(h.seat.prompts).toEqual(["Enter home · '"]);
    h.host.inputBlocked = true; // a menu, Options or lost focus
    h.press("Quote");
    h.seat.composer.lastMovement = { dx: 0, dy: -1 };
    h.step(20);
    await h.settle();
    expect(h.requests).toEqual([]);
  });

  it("reads the guest's predicted body where the predictor publishes it", async () => {
    const h = await harness();
    const car = { ...createVehicle("compact-1", 216, 300), id: 7 };
    h.replica.entities.push(car);
    const predicted = { ...h.guest, position: { wx: 200, wy: 300 } };
    const published = vi.fn((id: number) => ({ tick: 1, body: id === 2 ? predicted : undefined }));
    Object.assign(h.host.session, { prediction: { publishedBody: published } });
    h.step();
    expect(h.seat.prompts).toEqual(["Drive car · '"]); // the replica's pose is far away

    // A doorway needs authority there too: the predicted body alone does not go through.
    const door = await harness();
    door.replica.props.push(house);
    door.step();
    const ahead = { ...door.guest, position: { wx: 100, wy: 104 } };
    Object.assign(door.host.session, {
      prediction: { publishedBody: () => ({ tick: 1, body: ahead }) },
    });
    door.guest.position = { wx: 100, wy: 140 }; // authority has not caught up
    door.seat.composer.lastMovement = { dx: 0, dy: -1 };
    door.step(20);
    await door.settle();
    expect(door.requests).toEqual([]);
  });

  it("a guest that leaves stops listening; a guest not yet streamed has no prompts", async () => {
    const h = await harness();
    const car = { ...createVehicle("compact-1", 416, 100), id: 7 };
    h.replica.entities.push(car);
    h.step();
    h.replica.seats.entities.delete(1);
    h.step();
    expect(h.seat.prompts).toEqual([]);
    h.press("Quote");
    await h.settle();
    expect(h.requests).toEqual([]);
    h.replica.seats.entities.set(1, 2);
    h.step();
    expect(h.seat.prompts).toEqual(["Drive car · '"]);
    h.seats.drop(1);
    expect(h.seat.prompts).toEqual([]);
    h.press("Quote");
    await h.settle();
    expect(h.requests).toEqual([]);
    // Destroyed with the page: a new guest gets no controls.
    h.places.destroy();
    const again = await h.seats.join(requester, 3, 1, new ActionSeatInput(h.keys));
    h.step();
    expect(again.prompts).toEqual([]);
  });
});
