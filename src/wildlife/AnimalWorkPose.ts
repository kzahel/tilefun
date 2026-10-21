import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { DEER_CLIPS } from "./Deer.js";
import { faunaProfile } from "./Fauna.js";
import { RABBIT_CLIPS } from "./Rabbit.js";
import { ROBIN_CLIPS } from "./Robin.js";

/** Restore task clips before the first snapshot after loading a save. */
export function restoreAnimalWorkPose(animal: Entity): void {
  const task = animal.animalWork;
  if (
    !task ||
    !animal.sprite ||
    ((animal.fauna ?? animal.rabbit ?? animal.robin)?.alarmFrom &&
      task.state !== "descend" &&
      !["hedgehog", "porcupine"].includes(task.kind))
  )
    return;
  const woodland = task.kind === "capuchin" || task.kind === "raccoon" || task.kind === "cat";
  const pasture = task.kind === "goat" || task.kind === "pig" || task.kind === "elephant";
  const garden = ["chicken", "bee", "hummingbird"].includes(task.kind);
  const range = ["horse", "giraffe", "beaver"].includes(task.kind);
  const herd = ["cow", "sheep", "donkey"].includes(task.kind);
  const forest = ["deer", "peacock", "raven"].includes(task.kind);
  const threat = ["hedgehog", "porcupine", "fox"].includes(task.kind);
  const name =
    task.kind === "fox" && task.state === "stalk" && animal.fauna?.motion
      ? undefined
      : threat
        ? [
            "curl-in",
            "curled",
            "uncurl",
            "quills",
            "rattle",
            "relax",
            "listen",
            "stalk",
            "pounce",
            "eat",
          ].includes(task.state)
          ? task.state
          : undefined
        : forest
          ? [
              "lower",
              "browse",
              "raise",
              "stamp",
              "open",
              "display",
              "close",
              "pickup",
              "bury",
            ].includes(task.state)
            ? task.state
            : undefined
          : herd
            ? ["lower", "graze", "raise", "lie", "ruminate", "stand", "bleat", "roll"].includes(
                task.state,
              )
              ? task.state
              : undefined
            : range
              ? [
                  "lower",
                  "graze",
                  "drink",
                  "raise",
                  "reach",
                  "browse",
                  "pickup",
                  "build",
                  "settle",
                ].includes(task.state)
                ? task.state
                : undefined
              : garden
                ? ["scratch", "peck", "eat", "sip", "guard"].includes(task.state)
                  ? task.state
                  : undefined
                : pasture
                  ? [
                      "rear",
                      "browse",
                      "lower",
                      "hop",
                      "sniff",
                      "root",
                      "pickup",
                      "reach",
                      "curl",
                      "eat",
                      "shake",
                    ].includes(task.state)
                    ? task.state
                    : undefined
                  : woodland
                    ? task.state === "climb" || task.state === "descend"
                      ? "climb"
                      : task.state === "stalk"
                        ? "stalk"
                        : task.state === "pounce"
                          ? "pounce"
                          : task.state === "bat"
                            ? "bat"
                            : task.state === "perch"
                              ? "sit"
                              : task.state === "eat"
                                ? "eat"
                                : task.state === "pickup"
                                  ? "pickup"
                                  : undefined
                    : task.state === "scan"
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
  const clips = animal.deer
    ? DEER_CLIPS
    : animal.rabbit
      ? RABBIT_CLIPS
      : animal.robin
        ? ROBIN_CLIPS
        : faunaProfile(animal.type)?.clips;
  const index = clips?.findIndex((c) => c.name === name) ?? -1;
  if (index >= 0) {
    if (task.facing !== undefined) {
      animal.sprite.direction = task.facing;
      animal.sprite.frameRow = task.facing;
      if (animal.fauna) animal.fauna.facing = task.facing;
      if (animal.deer) animal.deer.facing = task.facing;
    }
    setSpriteClip(animal, index);
    setSpriteClipElapsed(
      animal,
      Math.round(
        (task.state === "pounce" || task.state === "hop"
          ? (animal.fauna?.motion?.elapsed ?? task.elapsed)
          : task.state === "scan" && task.elapsed >= 0.6
            ? task.elapsed - 0.6
            : task.elapsed) * 1000,
      ),
    );
  }
}
