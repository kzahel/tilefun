import { AnimationClip, Group, NumberKeyframeTrack, Vector3 } from "three";
import { expect, it } from "vitest";
import { Direction } from "../../entities/Entity.js";
import type { SpriteItem } from "../SceneItem.js";
import { SkinnedWildlifeBatch } from "./SkinnedWildlifeBatch.js";

it("requires a distinct action for every sprite animation before drawing a model", () => {
  const clips = ["idle", "walk", "flee"].map((name, start) => ({
    name,
    start,
    count: 2,
    frameDuration: 100,
    loop: true,
  }));
  const action = (name: string, end: number, duration = 1) =>
    new AnimationClip(name, duration, [
      new NumberKeyframeTrack("Body.position[x]", [0, duration], [0, end]),
    ]);
  const base = [action("idle", 0.1), action("walk", 1)];
  const load = (animations: AnimationClip[], names?: Record<string, string>) =>
    new SkinnedWildlifeBatch(
      new Group(),
      new Group(),
      animations,
      { path: "animal.glb", height: 1, animation: { clips, ...(names ? { names } : {}) } },
      1,
    );

  expect(() => load(base)).toThrow("Missing wildlife animation: flee");
  expect(() => load(base, { flee: "walk" })).toThrow("Reused wildlife animation: flee");
  expect(() => load([...base, action("flee", 1, 2)])).toThrow("Reused wildlife animation: flee");
  const batch = load([...base, action("flee", 2)]);
  batch.dispose();
});

it("applies the top-down ground-depth fit after turning the model", () => {
  const root = new Group();
  const source = new Group();
  const marker = new Group();
  marker.name = "Marker";
  marker.position.set(1, 2, -3);
  source.add(marker);

  const clips = [{ name: "Idle", start: 0, count: 1, frameDuration: 100, loop: true }];
  const action = new AnimationClip("Idle", 1, [
    new NumberKeyframeTrack("Marker.rotation[y]", [0, 1], [0, 0.1]),
  ]);
  const batch = new SkinnedWildlifeBatch(
    root,
    source,
    [action],
    {
      path: "character.glb",
      height: 1,
      topDown: { width: 1.5, height: 0.75, depth: 2, worldY: 0.25 },
      animation: { clips },
    },
    2,
  );
  const item = {
    wx: 10,
    wy: 20,
    zOffset: 5,
    facing: Direction.Right,
    frameCol: 0,
    frameRow: 0,
  } as SpriteItem;
  const position = (topDown: boolean) => {
    batch.begin();
    batch.push(item, topDown);
    batch.end();
    const drawn = root.getObjectByName(marker.name);
    if (!drawn) throw new Error("Missing model marker");
    return drawn.getWorldPosition(new Vector3()).toArray();
  };

  try {
    // The model's local depth now spans world X, while world Y takes the compression.
    expect(position(true)).toEqual([expect.closeTo(22), expect.closeTo(19.25), expect.closeTo(8)]);
    expect(position(false)).toEqual([expect.closeTo(16), expect.closeTo(18), expect.closeTo(9)]);
  } finally {
    batch.dispose();
  }
});
