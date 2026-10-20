import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { faunaProfile } from "./Fauna.js";
import { RABBIT_CLIPS } from "./Rabbit.js";
import { ROBIN_CLIPS } from "./Robin.js";

/** Restore task clips before the first snapshot after loading a save. */
export function restoreAnimalWorkPose(animal: Entity): void {
  const task = animal.animalWork;
  if (!task || !animal.sprite || (animal.fauna ?? animal.rabbit ?? animal.robin)?.alarmFrom) return;
  const name =
    task.state === "scan"
      ? task.elapsed < 0.6
        ? "rear"
        : "scan"
      : task.state === "lower"
        ? "lower"
        : task.state === "alarm"
          ? "alarm"
          : task.state === "rest" && task.kind === "rabbit"
            ? "action"
            : task.state === "pickup"
              ? "pickup"
              : task.state === "deposit"
                ? task.kind === "crow"
                  ? "build"
                  : "dig"
                : task.state === "retrieve"
                  ? "dig"
                  : task.state === "eat"
                    ? task.kind === "meerkat"
                      ? "action"
                      : "eat"
                    : task.kind === "dog" && task.state === "rest"
                      ? "release"
                      : undefined;
  const clips = animal.rabbit
    ? RABBIT_CLIPS
    : animal.robin
      ? ROBIN_CLIPS
      : faunaProfile(animal.type)?.clips;
  const index = clips?.findIndex((c) => c.name === name) ?? -1;
  if (index >= 0) {
    if (task.facing !== undefined) {
      animal.sprite.direction = task.facing;
      animal.sprite.frameRow = task.facing;
    }
    setSpriteClip(animal, index);
    setSpriteClipElapsed(
      animal,
      Math.round(
        (task.state === "scan" && task.elapsed >= 0.6 ? task.elapsed - 0.6 : task.elapsed) * 1000,
      ),
    );
  }
}
