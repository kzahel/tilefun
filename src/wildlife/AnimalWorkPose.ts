import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import type { AnimalWork } from "./AnimalWork.js";
import { DEER_CLIPS } from "./Deer.js";
import { faunaProfile } from "./Fauna.js";
import { RABBIT_CLIPS } from "./Rabbit.js";
import { ROBIN_CLIPS } from "./Robin.js";

type Kind = AnimalWork["kind"];
type State = AnimalWork["state"];
/** A saved task state restores this clip name; a function decides from the task. */
type Pose = string | ((task: AnimalWork) => string | undefined);
const same = (...states: State[]): [State, Pose][] => states.map((s) => [s, s]);

/**
 * Each working habitat's task kinds and the clip each saved state restores.
 * States without an entry restore no clip (the AI picks one on its next update).
 */
const HABITAT_POSES: readonly { kinds: readonly Kind[]; poses: [State, Pose][] }[] = [
  {
    kinds: ["hedgehog", "porcupine", "fox"],
    poses: same(
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
    ),
  },
  {
    kinds: ["deer", "peacock", "raven"],
    poses: same("lower", "browse", "raise", "stamp", "open", "display", "close", "pickup", "bury"),
  },
  {
    kinds: ["cow", "sheep", "donkey"],
    poses: same("lower", "graze", "raise", "lie", "ruminate", "stand", "bleat", "roll"),
  },
  {
    kinds: ["horse", "giraffe", "beaver"],
    poses: same("lower", "graze", "drink", "raise", "reach", "browse", "pickup", "build", "settle"),
  },
  {
    kinds: ["chicken", "bee", "hummingbird"],
    poses: same("scratch", "peck", "eat", "sip", "guard"),
  },
  {
    kinds: ["goat", "pig", "elephant"],
    poses: same(
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
    ),
  },
  {
    kinds: ["capuchin", "raccoon", "cat"],
    poses: [
      ...same("stalk", "pounce", "bat", "eat", "pickup"),
      ["climb", "climb"],
      ["descend", "climb"],
      ["perch", "sit"],
    ],
  },
];
/** Meadow, ground and carrying workers (dog, crow, squirrel, rabbit, robin, meerkat). */
const OTHER_POSES: [State, Pose][] = [
  ["scan", (t) => (t.elapsed < 0.6 ? "rear" : "scan")],
  ["lower", "lower"],
  ["alarm", "alarm"],
  ["rest", (t) => (t.kind === "rabbit" ? "action" : t.kind === "dog" ? "release" : undefined)],
  ["pickup", "pickup"],
  ["deposit", (t) => (t.kind === "crow" ? "build" : "dig")],
  ["retrieve", "dig"],
  ["eat", (t) => (t.kind === "meerkat" ? "action" : "eat")],
];
const POSES_BY_KIND = new Map<Kind, ReadonlyMap<State, Pose>>(
  HABITAT_POSES.flatMap(({ kinds, poses }) => {
    const table = new Map(poses);
    return kinds.map((kind) => [kind, table] as const);
  }),
);
const OTHER_TABLE: ReadonlyMap<State, Pose> = new Map(OTHER_POSES);

function poseName(animal: Entity, task: AnimalWork): string | undefined {
  // A moving fox stalk keeps its live gait instead of a restored pose.
  if (task.kind === "fox" && task.state === "stalk" && animal.fauna?.motion) return undefined;
  const pose = (POSES_BY_KIND.get(task.kind) ?? OTHER_TABLE).get(task.state);
  return typeof pose === "function" ? pose(task) : pose;
}

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
  const name = poseName(animal, task);
  const index = clipBank(animal)?.findIndex((c) => c.name === name) ?? -1;
  if (index < 0) return;
  if (task.facing !== undefined) {
    animal.sprite.direction = task.facing;
    animal.sprite.frameRow = task.facing;
    if (animal.fauna) animal.fauna.facing = task.facing;
    if (animal.deer) animal.deer.facing = task.facing;
  }
  setSpriteClip(animal, index);
  setSpriteClipElapsed(animal, Math.round(clipSeconds(animal, task) * 1000));
}

const clipBank = (animal: Entity) =>
  animal.deer
    ? DEER_CLIPS
    : animal.rabbit
      ? RABBIT_CLIPS
      : animal.robin
        ? ROBIN_CLIPS
        : faunaProfile(animal.type)?.clips;

/** Physical moves resume their live motion; a late scan skips its 0.6 s rear. */
const clipSeconds = (animal: Entity, task: AnimalWork) =>
  task.state === "pounce" || task.state === "hop"
    ? (animal.fauna?.motion?.elapsed ?? task.elapsed)
    : task.state === "scan" && task.elapsed >= 0.6
      ? task.elapsed - 0.6
      : task.elapsed;
