import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { applyPatternEdit, type PatternEdit } from "../patterns/PatternDocument.js";
import { deserializeProp, serializeProp } from "../shared/serialization.js";
import {
  INTERIOR_WALL_TYPE,
  type InteriorIdentity,
  interiorGenerator,
} from "./GameplayInterior.js";
import {
  compileGameplayRoom,
  GameplayRoomEditor,
  initialRoom,
  parseGameplayRoom,
  validateRoomOccupancy,
} from "./GameplayRoom.js";

const identity: InteriorIdentity = {
  version: "interior-v1",
  parentWorldId: "world-1",
  featureId: "settlement:0:0:block:1:1:lot:0",
  buildingType: "prop-regional-apartment-2",
  floor: 0,
  returnX: 1,
  returnY: 2,
};
const extension: PatternEdit = {
  path: [
    { x: 4, y: 2 },
    { x: 8, y: 3 },
  ],
  shape: "rectangle",
  value: "L",
  erase: false,
};
function fixture(buildingType = identity.buildingType) {
  const id = { ...identity, buildingType },
    state = initialRoom(id),
    props = new PropManager();
  for (const p of interiorGenerator(id, 2026).placements(0, 0, new Set()).placements)
    props.add(createProp(p.propType, p.wx, p.wy));
  const player = createPlayer(80, 120);
  const editor = new GameplayRoomEditor(state, (next) =>
    validateRoomOccupancy(compileGameplayRoom(id, next), props.props, [player]),
  );
  return { id, state, props, player, editor };
}
describe("authoritative editable gameplay rooms", () => {
  for (const type of ["prop-regional-apartment-2", "prop-regional-bakery", "prop-country-house"])
    it(`preserves ${type} fixtures and permits a connected extension`, () => {
      const { id, state, props, player, editor } = fixture(type);
      expect(compileGameplayRoom(id, state).legacy).toBe(true);
      expect(() =>
        validateRoomOccupancy(compileGameplayRoom(id, state), props.props, [player]),
      ).not.toThrow();
      expect(editor.edit("one", 0, extension).error).toBe("");
      const room = compileGameplayRoom(id, editor.state);
      expect(room.legacy).toBe(false);
      expect(room.onFloor({ x: 220, y: 70, width: 10, height: 6 })).toBe(true);
      expect(room.onFloor({ x: 350, y: 70, width: 10, height: 6 })).toBe(false);
      const wall = createProp(INTERIOR_WALL_TYPE, 0, 0);
      wall.walls = room.walls;
      if (!player.collider) throw new Error("Missing player collider");
      const restored = deserializeProp(JSON.parse(JSON.stringify(serializeProp(wall))));
      expect(restored.walls).toEqual(room.walls);
      expect(
        aabbOverlapsPropWalls(
          getEntityAABB({ wx: 350, wy: 70 }, player.collider),
          restored.position,
          restored,
        ),
      ).toBe(true);
      expect(
        aabbOverlapsPropWalls(
          getEntityAABB({ wx: 220, wy: 70 }, player.collider),
          restored.position,
          restored,
        ),
      ).toBe(false);
      expect(editor.travel("one", 1, "undo").error).toBe("");
      expect(compileGameplayRoom(id, editor.state).legacy).toBe(true);
      expect(editor.travel("one", 2, "redo").error).toBe("");
      expect(editor.state.revision).toBe(3);
    });
  it("rejects the protected entrance, invalid doors, furniture loss and player overlap atomically", () => {
    const { editor, state } = fixture();
    for (const edit of [
      { ...extension, shape: "free" as const, path: [{ x: 2, y: 4 }], erase: true },
      { ...extension, shape: "free" as const, path: [{ x: 2, y: 3 }], value: "#" },
      { ...extension, shape: "free" as const, path: [{ x: 1, y: 2 }], erase: true },
      { ...extension, shape: "free" as const, path: [{ x: 10, y: 10 }], value: "+" },
    ]) {
      expect(editor.edit("one", 0, edit).error).not.toBe("");
      expect(editor.state).toEqual(state);
      expect(editor.status("one").canUndo).toBe(false);
    }
  });
  it("rejects a partition that strands a player without colliding with them", () => {
    const { editor, props, player } = fixture();
    for (const p of [...props.props]) props.remove(p.id);
    player.position = { wx: 80, wy: 60 };
    const status = editor.edit("one", 0, {
      path: [
        { x: 0, y: 2 },
        { x: 4, y: 2 },
      ],
      shape: "free",
      value: "#",
      erase: false,
    });
    expect(status.error).toMatch(/route/);
    expect(editor.state.revision).toBe(0);
  });
  it("permits a door through a partition and blocks its jamb", () => {
    const { editor, props } = fixture();
    for (const p of [...props.props]) props.remove(p.id);
    expect(
      editor.edit("one", 0, {
        path: [
          { x: 0, y: 2 },
          { x: 4, y: 2 },
        ],
        shape: "free",
        value: "#",
        erase: false,
      }).error,
    ).toBe("");
    expect(
      editor.edit("one", 1, { path: [{ x: 2, y: 2 }], shape: "free", value: "+", erase: false })
        .error,
    ).toBe("");
    const room = compileGameplayRoom(identity, editor.state);
    expect(room.onFloor({ x: 66, y: 68, width: 10, height: 6 })).toBe(true);
    expect(room.onFloor({ x: 82, y: 68, width: 10, height: 6 })).toBe(false);
  });
  it("handles stale strokes and conflicting undo without replacing another editor's work", () => {
    const { editor } = fixture();
    expect(editor.edit("one", 0, extension).error).toBe("");
    expect(editor.edit("two", 0, extension).error).toMatch(/changed/);
    expect(
      editor.edit("two", 1, { ...extension, path: [{ x: 5, y: 2 }], shape: "free", value: "K" })
        .error,
    ).toBe("");
    const before = editor.state;
    expect(editor.travel("one", 2, "undo").error).toMatch(/overwrite/);
    expect(editor.state).toBe(before);
    expect(editor.travel("two", 2, "undo").error).toBe("");
    expect(editor.travel("one", 3, "undo").error).toBe("");
  });
  it("revalidates undo against furniture placed in the new extension", () => {
    const { editor, props } = fixture();
    expect(editor.edit("one", 0, extension).error).toBe("");
    props.add(createProp("prop-interior-furniture:stool", 220, 80));
    expect(editor.travel("one", 1, "undo").error).toMatch(/floor/);
    expect(editor.state.revision).toBe(1);
    expect(editor.status("one").canUndo).toBe(true);
  });
  it("rejects unbounded or malformed strokes and unknown saved schemas", () => {
    const { editor, state } = fixture();
    for (const edit of [
      { ...extension, path: [{ x: NaN, y: 2 }] },
      { ...extension, path: [{ x: 100, y: 2 }] },
      { ...extension, value: "bad" },
      { ...extension, erase: "yes" },
      { ...extension, path: [] },
    ]) {
      expect(editor.edit("one", 0, edit as PatternEdit).error).not.toBe("");
      expect(editor.state).toEqual(state);
    }
    expect(parseGameplayRoom(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(() => parseGameplayRoom({ ...state, version: 2 })).toThrow();
    expect(() => parseGameplayRoom({ ...state, revision: -1 })).toThrow();
    expect(() =>
      applyPatternEdit(state.document, {
        ...extension,
        roomRectangle: true,
        path: [{ x: 8, y: 8 }],
      }),
    ).toThrow(/3×3/);
  });
});
