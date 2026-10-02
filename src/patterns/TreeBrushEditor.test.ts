import { describe, expect, it } from "vitest";
import { createProp, isPropType } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { deserializeProp, serializeProp } from "../shared/serialization.js";
import { treeRunLength } from "./FencedTrees.js";
import { TreeBrushEditor } from "./TreeBrushEditor.js";

describe("authoritative tree strokes", () => {
  it("validates before mutation, splits rows, and supports undo/redo", () => {
    const props = new PropManager();
    let dirty = 0;
    const editor = new TreeBrushEditor(props, () => dirty++);
    expect(
      editor.edit("a", { start: { x: -6, y: -2 }, end: { x: 6, y: 8 }, erase: false }).error,
    ).toBe("");
    expect(props.props.map((p) => treeRunLength(p.type))).toEqual([13]);
    expect(
      editor.edit("a", { start: { x: -4, y: -2 }, end: { x: -4, y: -2 }, erase: true }).error,
    ).toContain("2-cell");
    expect(dirty).toBe(1);
    expect(
      editor.edit("a", { start: { x: 0, y: -2 }, end: { x: 0, y: -2 }, erase: true }).error,
    ).toBe("");
    expect(props.props.map((p) => treeRunLength(p.type))).toEqual([6, 6]);
    expect(editor.travel("a", "undo").error).toBe("");
    expect(props.props).toHaveLength(1);
    expect(editor.travel("a", "redo").error).toBe("");
    expect(props.props).toHaveLength(2);
    const p = props.props[0];
    if (!p) throw new Error("Missing prop");
    const restored = createProp(p.type, p.position.wx, p.position.wy);
    expect(isPropType(p.type)).toBe(true);
    expect(restored.sprite).toEqual(p.sprite);
    expect(restored.collider).toEqual(p.collider);
    expect(deserializeProp(serializeProp(p)).sprite).toEqual(p.sprite);
  });
  it("does not overwrite another player's row and preserves other rows", () => {
    const props = new PropManager(),
      editor = new TreeBrushEditor(props, () => {});
    editor.edit("a", { start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, erase: false });
    editor.edit("b", { start: { x: 0, y: 1 }, end: { x: 5, y: 1 }, erase: false });
    expect(editor.travel("a", "undo").error).toBe("");
    expect(props.props).toHaveLength(1);
    editor.travel("a", "redo");
    editor.edit("b", { start: { x: 6, y: 0 }, end: { x: 8, y: 0 }, erase: false });
    expect(editor.travel("a", "undo").error).toContain("row changed");
    expect(props.props).toHaveLength(2);
  });
  it("rejects overlap and malicious/unbounded commands", () => {
    const props = new PropManager(),
      editor = new TreeBrushEditor(props, () => {});
    const rock = createProp("prop-big-rock", 32, 16);
    props.add(rock);
    expect(
      editor.edit("a", { start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, erase: false }).error,
    ).toContain("overlaps");
    expect(props.props).toEqual([rock]);
    expect(
      editor.edit("a", { start: { x: 0, y: 0 }, end: { x: 128, y: 0 }, erase: false }).error,
    ).toContain("128");
    expect(
      editor.edit("a", { start: { x: Infinity, y: 0 }, end: { x: 5, y: 0 }, erase: false }).error,
    ).toContain("coordinate");
  });
});
