import { AnimationClip, Group, NumberKeyframeTrack } from "three";
import { expect, it } from "vitest";
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
