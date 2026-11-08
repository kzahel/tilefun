/**
 * Characterization of the E/F place controls (tactical 226, slice 2): the
 * vehicle prompt before doors, door walk-through from the play movement, and the
 * request ordering around neutral input. The real VehicleControl, DoorControl
 * and ActionManager run against a minimal DOM stand-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { ActionManager } from "../input/ActionManager.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { createVehicle } from "../traffic/Vehicle.js";
import type { DoorRequest } from "../ui/DoorControl.js";
import type { VehicleRequest } from "../ui/VehicleControl.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { DoorPresentation } from "./DoorPresentation.js";
import { PlaceControls } from "./PlaceControls.js";

const DT = 1 / 60;

function element(): Record<string, unknown> {
  return {
    style: {},
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: "",
    append() {},
    setAttribute() {},
    remove() {},
  };
}

beforeEach(() => {
  vi.stubGlobal("document", { createElement: element, body: element() });
});
afterEach(() => vi.unstubAllGlobals());

/** A country house whose street door threshold is at (100, 100). */
function house(): Prop {
  return {
    id: 50,
    type: "prop-country-house",
    proceduralId: "farmstead:0:0:east:house",
    position: { wx: 100, wy: 92 },
  } as unknown as Prop;
}

function harness() {
  const player: Entity = { ...createPlayer(100, 200), id: 1 };
  const view = {
    playerEntity: player,
    entities: [player] as Entity[],
    props: [] as Prop[],
    editorEnabled: false,
    interior: undefined,
    get serverPlayerPosition() {
      return player.position;
    },
  };
  const order: string[] = [];
  const requests: (DoorRequest | VehicleRequest)[] = [];
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
    stateView: view as unknown as RemoteStateView,
    doorPresentation: presentation as unknown as DoorPresentation,
    playing: true,
    overlayOpen: false,
    inputBlocked: false,
    storagePaused: false,
    movementMode: "joystick" as TouchMovementMode,
    carDriving: "steering" as CarDrivingStyle,
    movement: { dx: 0, dy: 0 },
    clearPlayInput: vi.fn((sendNeutral?: boolean) => {
      order.push(`clear:${sendNeutral ?? true}`);
    }),
    request: vi.fn(async (message: DoorRequest | VehicleRequest) => {
      order.push(`request:${message.type}`);
      requests.push(message);
      if (reject) throw reject;
    }),
  };
  const actions = new ActionManager();
  const controls = new PlaceControls(host, actions);
  return {
    player,
    view,
    host,
    actions,
    controls,
    presentation,
    order,
    requests,
    failNext(error: Error) {
      reject = error;
    },
    step(ticks = 1, ready = true) {
      for (let i = 0; i < ticks; i++) controls.update(DT, ready);
    },
    press(code: string) {
      actions.pressKey(code);
      actions.releaseKey(code);
    },
    /** Let pending request promises settle (busy flags clear in `finally`). */
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

describe("place controls characterization (pre-226 wiring)", () => {
  it("E drives a nearby car ahead of a door, after clearing play input", async () => {
    const h = harness();
    h.view.props = [house()];
    h.step(); // fresh approach far from the door
    h.player.position = { wx: 100, wy: 104 };
    const car = { ...createVehicle("compact-1", 116, 104), id: 7 };
    h.view.entities = [h.player, car];
    h.host.movement = { dx: 0, dy: -1 };
    h.step(20);
    // The vehicle prompt hides the door, so walking into it does nothing.
    expect(h.requests).toEqual([]);
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([{ type: "enter-vehicle", entityId: 7 }]);
    expect(h.order).toEqual(["clear:true", "request:enter-vehicle"]);

    // Once seated, the same key gets out again.
    h.player.parentId = 7;
    h.step();
    h.press("KeyE");
    await h.settle();
    expect(h.requests.at(-1)).toEqual({ type: "exit-vehicle" });
  });

  it("without a vehicle prompt, E opens the nearest door", async () => {
    const h = harness();
    h.view.props = [house()];
    h.step();
    h.player.position = { wx: 100, wy: 110 };
    h.step(1, false); // not ready: no door prompt
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
    h.step();
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([
      { type: "enter-building", featureId: "farmstead:0:0:east:house", doorId: "street" },
    ]);
    expect(h.order).toEqual(["clear:true", "request:enter-building"]);
    expect(h.presentation.begin).not.toHaveBeenCalled();
  });

  it("walking into a door after a fresh approach starts a walk-through without neutral input", async () => {
    const h = harness();
    h.view.props = [house()];
    h.step();
    h.player.position = { wx: 100, wy: 104 };
    h.host.movement = { dx: 0, dy: -1 };
    h.step(5);
    expect(h.requests).toEqual([]); // intent must last 0.1 s
    h.step(2);
    await h.settle();
    expect(h.requests).toEqual([
      {
        type: "enter-building",
        featureId: "farmstead:0:0:east:house",
        doorId: "street",
        walkThrough: true,
      },
    ]);
    // The walk keeps the last directional input for the authority's approach check.
    expect(h.order).toEqual(["clear:false", "begin", "request:enter-building"]);

    // Sideways or backwards movement never walks through.
    const side = harness();
    side.view.props = [house()];
    side.step();
    side.player.position = { wx: 100, wy: 104 };
    side.host.movement = { dx: 1, dy: -1 };
    side.step(20);
    side.host.movement = { dx: 0, dy: 1 };
    side.step(20);
    expect(side.requests).toEqual([]);
  });

  it("a player who appears at a door must step away before walking through", async () => {
    const h = harness();
    h.view.props = [house()];
    h.player.position = { wx: 100, wy: 104 };
    h.host.movement = { dx: 0, dy: -1 };
    h.step(20);
    expect(h.requests).toEqual([]);
    h.player.position = { wx: 100, wy: 200 };
    h.step();
    h.player.position = { wx: 100, wy: 104 };
    h.step(7);
    await h.settle();
    expect(h.requests).toHaveLength(1);
  });

  it("a failed door trip cancels the walk-through presentation", async () => {
    const h = harness();
    h.view.props = [house()];
    h.failNext(new Error("blocked"));
    h.step();
    h.player.position = { wx: 100, wy: 104 };
    h.host.movement = { dx: 0, dy: -1 };
    h.step(7);
    await h.settle();
    expect(h.order).toEqual(["clear:false", "begin", "request:enter-building", "cancel"]);
  });

  it("E and F act only in play with input unblocked; a busy door drops door requests", async () => {
    const h = harness();
    h.view.props = [house()];
    h.step();
    h.player.position = { wx: 100, wy: 110 };
    h.step();
    h.host.inputBlocked = true;
    h.press("KeyE");
    h.host.inputBlocked = false;
    h.host.playing = false;
    h.press("KeyE");
    h.host.playing = true;
    h.presentation.busy = true;
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
    expect(h.order).toEqual([]);
  });

  it("locks stop walk-throughs, and overlays or a vehicle-only lock change which prompt applies", async () => {
    for (const lock of ["inputBlocked", "overlayOpen"] as const) {
      const locked = harness();
      locked.view.props = [house()];
      locked.step(); // fresh approach away from the door
      locked.host[lock] = true;
      locked.player.position = { wx: 100, wy: 104 };
      locked.host.movement = { dx: 0, dy: -1 };
      locked.step(20);
      expect(locked.requests, lock).toEqual([]);
    }

    const h = harness();
    h.view.props = [house()];
    h.step();

    // Storage pause locks the vehicle button only: a stored car prompt still
    // claims E (busy) instead of falling through to the door.
    h.host.overlayOpen = false;
    const car = { ...createVehicle("compact-1", 116, 110), id: 7 };
    h.view.entities = [h.player, car];
    h.player.position = { wx: 100, wy: 110 };
    h.host.movement = { dx: 0, dy: 0 };
    h.host.storagePaused = true;
    h.step();
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
  });

  it("a door presentation or blocked input locks the vehicle button", async () => {
    const h = harness();
    const car = { ...createVehicle("compact-1", 116, 200), id: 7 };
    h.view.entities = [h.player, car];
    h.host.inputBlocked = true;
    h.step();
    expect(h.controls.vehicle.button.disabled).toBe(true);
    h.host.inputBlocked = false;
    h.presentation.busy = true; // e.g. mid walk-through
    h.step();
    expect(h.controls.vehicle.button.disabled).toBe(true);
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
    h.presentation.busy = false;
    h.step();
    expect(h.controls.vehicle.button.disabled).toBe(false);
  });

  it("vehicle prompts need a ready world and the play scene", async () => {
    const h = harness();
    const car = { ...createVehicle("compact-1", 116, 200), id: 7 };
    h.view.entities = [h.player, car];
    h.step(1, false);
    h.press("KeyE");
    h.host.playing = false;
    h.step();
    h.host.playing = true;
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
    h.step();
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([{ type: "enter-vehicle", entityId: 7 }]);
  });

  it("F runs the equipment action beside a stopped dump truck while E still drives", async () => {
    const h = harness();
    const truck = { ...createVehicle("dump-truck", 130, 200), id: 9 };
    h.view.entities = [h.player, truck];
    h.step();
    h.host.inputBlocked = true;
    h.press("KeyF");
    h.host.inputBlocked = false;
    h.host.playing = false;
    h.press("KeyF");
    h.host.playing = true;
    await h.settle();
    expect(h.requests).toEqual([]);
    h.press("KeyF");
    await h.settle();
    expect(h.requests).toEqual([{ type: "vehicle-equipment", entityId: 9, action: "tip" }]);
    h.press("KeyE");
    await h.settle();
    expect(h.requests.at(-1)).toEqual({ type: "enter-vehicle", entityId: 9 });
    expect(h.host.clearPlayInput).toHaveBeenCalledTimes(2);
  });

  it("destroy removes the E/F subscriptions", async () => {
    const h = harness();
    const car = { ...createVehicle("compact-1", 116, 200), id: 7 };
    h.view.entities = [h.player, car];
    h.step();
    h.controls.destroy();
    h.press("KeyE");
    await h.settle();
    expect(h.requests).toEqual([]);
  });
});
