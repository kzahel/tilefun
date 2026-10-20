import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { faunaProfile } from "./Fauna.js";

/** Restore task clips before the first snapshot after loading a save. */
export function restoreAnimalWorkPose(animal: Entity): void {
  const task = animal.animalWork;
  if (!task || !animal.sprite || animal.fauna?.alarmFrom) return;
  const name =
    task.state === "pickup"
      ? "pickup"
      : task.state === "deposit"
        ? task.kind === "crow"
          ? "build"
          : "dig"
        : task.state === "retrieve"
          ? "dig"
          : task.state === "eat"
            ? "eat"
            : task.kind === "dog" && task.state === "rest"
              ? "release"
              : undefined;
  const index = faunaProfile(animal.type)?.clips.findIndex((c) => c.name === name) ?? -1;
  if (index >= 0) {
    setSpriteClip(animal, index);
    setSpriteClipElapsed(animal, Math.round(task.elapsed * 1000));
  }
}
