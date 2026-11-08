import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { InteriorIdentity } from "../interiors/GameplayInterior.js";
import { INTERIOR_EXIT } from "../interiors/InteriorIdentity.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { DoorWalk, doorChoice, type PlaceView, vehicleChoice } from "./PlacePrompts.js";

/** One seat's view: its body at (wx, wy) among `entities` and `props`. */
function seatView(wx: number, wy: number, extra: Partial<PlaceView> = {}) {
  const player: Entity = { ...createPlayer(wx, wy), id: 1 };
  const view = {
    playerEntity: player,
    entities: [player] as readonly Entity[],
    props: [] as readonly Prop[],
    editorEnabled: false,
    interior: null as InteriorIdentity | null,
    serverPlayerPosition: { wx, wy } as PlaceView["serverPlayerPosition"],
    ...extra,
  };
  return view;
}

/** A station bench whose seat spans x 92..108 at y 100. */
const bench = {
  id: 60,
  type: "prop-rail-bench",
  proceduralId: "rail:0:bench:0",
  position: { wx: 100, wy: 100 },
  collider: { offsetX: 0, offsetY: 0, width: 16, height: 8 },
} as unknown as Prop;

const building = (type: string, id: string, wx = 100, wy = 92) =>
  ({ id: 50, type, proceduralId: id, position: { wx, wy } }) as unknown as Prop;

describe("vehicle choice (226: seat 0's page controls and guests share it)", () => {
  it("drives the nearest car, gets out of the one the seat is in, or calls a train", () => {
    const view = seatView(100, 100);
    const car = { ...createVehicle("compact-1", 116, 100), id: 7 };
    view.entities = [view.playerEntity, car];
    expect(vehicleChoice(view, true)).toMatchObject({
      request: { type: "enter-vehicle", entityId: 7 },
      label: "Drive car",
      key: "near:7",
      inside: false,
    });
    view.playerEntity.parentId = 7;
    expect(vehicleChoice(view, true)).toMatchObject({
      request: { type: "exit-vehicle" },
      label: "Get out",
      key: "inside:7",
      inside: true,
    });
    // Not allowed (not ready, not playing) or editing: no request, the target stays.
    expect(vehicleChoice(view, false)).toMatchObject({ request: null, key: "inside:7" });
    expect(vehicleChoice({ ...view, editorEnabled: true }, true).request).toBeNull();
    const alone = seatView(100, 100);
    expect(vehicleChoice(alone, true)).toMatchObject({ request: null, key: "", equipment: null });
  });

  it("calls a train from a station bench, unless a car is nearer to hand", () => {
    const view = seatView(100, 110, { props: [bench] });
    expect(vehicleChoice(view, true)).toMatchObject({
      request: { type: "call-train", benchId: 60 },
      label: "Call train",
      key: "station:60",
    });
    const car = { ...createVehicle("compact-1", 116, 110), id: 7 };
    view.entities = [view.playerEntity, car];
    expect(vehicleChoice(view, true)).toMatchObject({
      request: { type: "enter-vehicle", entityId: 7 },
      label: "Drive car",
    });
  });

  it("offers a stopped dump truck's equipment beside it", () => {
    const view = seatView(100, 200);
    const truck = { ...createVehicle("dump-truck", 130, 200), id: 9 };
    view.entities = [view.playerEntity, truck];
    expect(vehicleChoice(view, true).equipment).toEqual({
      request: { type: "vehicle-equipment", entityId: 9, action: "tip" },
      label: "Tip bed",
    });
    expect(vehicleChoice(view, false).equipment).toBeNull();
  });
});

describe("door choice", () => {
  it("names the building and finds its street door within reach on the ground", () => {
    const labels = [
      ["prop-country-house", "farmstead:0:0:east:house", "Enter home"],
      ["prop-shed", "farmstead:0:0:east:shed", "Enter outbuilding"],
      ["prop-regional-bakery", "settlement:0:0:block:0:0:lot:1", "Enter shop"],
      ["prop-regional-apartment-2", "settlement:0:0:block:0:0:lot:2", "Enter apartment"],
    ] as const;
    for (const [type, id, label] of labels) {
      const prop = building(type, id);
      // The recipes' entrances: a shop's 40 px in, an apartment's 24, a farm door's 0.
      const dx = type.includes("bakery") ? 40 : type.includes("apartment") ? 24 : 0;
      const door = { wx: 100 + dx, wy: 100 };
      const view = seatView(door.wx, door.wy + 24, { props: [prop] });
      const choice = doorChoice(view, true);
      expect(choice, type).toMatchObject({
        request: { type: "enter-building", featureId: id, doorId: "street" },
        label,
        nearby: [`${id}:street`],
        threshold: null,
      });
      // Standing in the doorway (and authority agreeing) makes it the threshold.
      const there = seatView(door.wx, door.wy, { props: [prop] });
      expect(doorChoice(there, true).threshold, type).toBe(`${id}:street`);
    }
    const house = building("prop-country-house", "farmstead:0:0:east:house");
    expect(doorChoice(seatView(100, 160, { props: [house] }), true).request).toBeNull();
    const raised = seatView(100, 110, { props: [house] });
    raised.playerEntity.wz = 12; // on a roof or a deck: no door
    expect(doorChoice(raised, true).request).toBeNull();
    expect(doorChoice(seatView(100, 110, { props: [house] }), false)).toEqual({
      request: null,
      label: "",
      nearby: [],
      threshold: null,
    });
  });

  it("inside, returns to the street by the nearest door", () => {
    const interior = {
      version: "interior-v1",
      parentWorldId: "world",
      featureId: "farmstead:0:0:east:house",
      buildingType: "prop-country-house",
      floor: 0,
      returnX: 6,
      returnY: 7,
    } as const;
    const view = seatView(INTERIOR_EXIT.wx, INTERIOR_EXIT.wy - 20, { interior });
    expect(doorChoice(view, true)).toMatchObject({
      request: { type: "exit-building", doorId: "street" },
      label: "Return to street",
      nearby: ["street"],
    });
    expect(doorChoice(seatView(INTERIOR_EXIT.wx, 40, { interior }), true).request).toBeNull();
    const there = seatView(INTERIOR_EXIT.wx, INTERIOR_EXIT.wy, { interior });
    expect(doorChoice(there, true).threshold).toBe("street");
  });
});

describe("door walk", () => {
  it("walks through only after a fresh approach toward the door, and never when locked", () => {
    const prop = building("prop-country-house", "farmstead:0:0:east:house");
    const walk = new DoorWalk();
    const far = seatView(100, 200, { props: [prop] });
    const up = { dx: 0, dy: -1 };
    expect(walk.update(far, doorChoice(far, true), true, false, up, 1 / 60)).toBe(false);
    const at = seatView(100, 104, { props: [prop] });
    const choice = doorChoice(at, true);
    const steps = (count: number, locked = false) => {
      let through = false;
      for (let i = 0; i < count; i++) through ||= walk.update(at, choice, true, locked, up, 1 / 60);
      return through;
    };
    expect(steps(20, true)).toBe(false); // locked: the approach starts over
    // The lock reset the approach, so a seat standing at the door must step away first.
    expect(steps(20)).toBe(false);
    walk.update(far, doorChoice(far, true), true, false, up, 1 / 60);
    expect(steps(7)).toBe(true);
  });

  it("never walks through mid-jump, and a reset needs a fresh approach", () => {
    const prop = building("prop-country-house", "farmstead:0:0:east:house");
    const up = { dx: 0, dy: -1 };
    const walk = new DoorWalk();
    const far = seatView(100, 200, { props: [prop] });
    walk.update(far, doorChoice(far, true), true, false, up, 1 / 60);
    const jumping = seatView(100, 104, { props: [prop] });
    jumping.playerEntity.wz = 4; // the predicted body is in the air
    const choice = doorChoice(jumping, true);
    let through = false;
    for (let i = 0; i < 20; i++) through ||= walk.update(jumping, choice, true, false, up, 1 / 60);
    expect(through).toBe(false);
    const fresh = new DoorWalk();
    fresh.update(far, doorChoice(far, true), true, false, up, 1 / 60);
    fresh.reset(); // e.g. the seat's body went away and came back at the door
    const at = seatView(100, 104, { props: [prop] });
    through = false;
    for (let i = 0; i < 20; i++)
      through ||= fresh.update(at, doorChoice(at, true), true, false, up, 1 / 60);
    expect(through).toBe(false);
  });
});
