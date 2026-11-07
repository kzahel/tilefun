import type { NaturalCase } from "../scenarios/NaturalLandscapeRecipe.js";
import { DEER_TYPE } from "../wildlife/Deer.js";
import { FAUNA_PROFILES } from "../wildlife/Fauna.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { PREDATOR_PROFILES } from "../wildlife/Predator.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";

/** Workshop-only presentation of a natural landscape case. Kept out of the recipe module,
 * whose source text is part of every natural candidate fingerprint. */
interface NaturalCasePresentation {
  /** Initial zoom; fauna cases fall back to their profile's inspection zoom. */
  zoom?: number;
  /** Fixed camera centre for staged behavior scenes, in world pixels. */
  camera?: { wx: number; wy: number };
  /** Behavior explanation shown above the staged scene. */
  description?: string;
  /** Controls and context paragraph replacing the default seed/location line. */
  guide?: string;
  /** Wildlife the player can hop onto (fauna cases use their own species). */
  mounts?: readonly { type: string; label: string }[];
}

const BEHAVIOR_VIEW = { wx: 160, wy: 144 };
const POND_MOUNTS = [
  { type: MALLARD_TYPE, label: "duck" },
  { type: FROG_TYPE, label: "frog" },
];

type BehaviorCaseId = Extract<NaturalCase["id"], `behavior-${string}`>;
type CatCaseId = Extract<NaturalCase["id"], `behavior-cat${string}`>;

/** Every staged behavior scene needs a fixed camera and description; cats open at 1.4. */
type CompletePresentation = Partial<Record<NaturalCase["id"], NaturalCasePresentation>> &
  Record<BehaviorCaseId, { camera: { wx: number; wy: number }; description: string }> &
  Record<CatCaseId, { zoom: 1.4 }>;

const PRESENTATION = {
  "behavior-hedgehog": {
    zoom: 1.6,
    camera: { wx: 160, wy: 168 },
    description:
      "The hedgehog tucks its head and forefeet when a hunter approaches. Its curled body discourages smaller hunters; it uncurls once danger leaves.",
  },
  "behavior-porcupine": {
    zoom: 1.6,
    camera: { wx: 160, wy: 168 },
    description:
      "The porcupine turns its quills toward an approaching hunter and rattles. A wolf backs away using its normal escape movement. The quills stay attached.",
  },
  "behavior-fox": {
    zoom: 1.8,
    camera: { wx: 160, wy: 168 },
    description:
      "The fox listens, stalks and physically pounces on actual small prey. A missed pounce leaves the prey alive. Only naturally spawned prey receive a delayed replacement far away.",
  },
  "behavior-deer": {
    zoom: 2,
    camera: { wx: 160, wy: 168 },
    description:
      "The deer browses a finite shrub portion. A nearby threat interrupts feeding with a forefoot stamp and native escape. Shrubs slowly regrow during active play.",
  },
  "behavior-peacock": {
    zoom: 1.6,
    camera: { wx: 160, wy: 168 },
    description:
      "The birds meet, open their tail fans, display to one another and close them. A moving, missing or frightened partner interrupts the encounter.",
  },
  "behavior-raven": {
    zoom: 2.2,
    camera: { wx: 160, wy: 168 },
    description:
      "The raven carries real shiny pebbles in its bill and stores up to three in its cache. Pebbles are conserved, with no food growth or automatic replacement.",
  },
  "behavior-cow": {
    zoom: 2,
    camera: { wx: 160, wy: 164 },
    description:
      "The cow grazes a real grass portion, lies down to chew its meal, then stands. Grass slowly regrows during active play.",
  },
  "behavior-sheep": {
    zoom: 2,
    camera: { wx: 160, wy: 164 },
    description:
      "Separated sheep walk back toward their flock and bleat when reunited. Following companions stay under your control.",
  },
  "behavior-donkey": {
    zoom: 2.2,
    camera: { wx: 160, wy: 164 },
    description:
      "The donkey lies down and rolls on a dust patch, then rises. Each completed bath leaves lasting scuffs on the patch.",
  },
  "behavior-horse": {
    zoom: 1.6,
    camera: { wx: 160, wy: 176 },
    description:
      "The horse lowers its head to graze real grass, then drinks from a spring pool. Depleted grass and water slowly replenish during active play.",
  },
  "behavior-giraffe": {
    zoom: 0.9,
    camera: { wx: 176, wy: 104 },
    description:
      "The giraffe reaches leaves on an actual tree canopy, browses one portion and raises its head again. Canopy leaves slowly regrow while the world runs.",
  },
  "behavior-beaver": {
    zoom: 1.8,
    camera: { wx: 144, wy: 186 },
    description:
      "The beaver takes real branches, carries them to the foundation and builds a small brush shelter in four stages. Fallen branch piles slowly replenish during active play.",
  },
  "behavior-chicken": {
    zoom: 2,
    camera: BEHAVIOR_VIEW,
    description:
      "The chicken scratches real soil, uncovers one seed and pecks it up to eat. Soil patches slowly replenish during active play.",
  },
  "behavior-bee": {
    zoom: 2.5,
    camera: BEHAVIOR_VIEW,
    description:
      "The bee sips finite nectar, carries pollen to a different bloom and helps one nearby depleted crop grow. Golden blooms were recently pollinated.",
  },
  "behavior-hummingbird": {
    zoom: 2,
    camera: BEHAVIOR_VIEW,
    description:
      "The hummingbird hovers to sip nectar, then briefly guards its flower against other hummingbirds. Empty flowers slowly refill during active play.",
  },
  "behavior-goat": {
    zoom: 1.3,
    camera: { wx: 144, wy: 144 },
    description:
      "The goat rears to browse a leafy shrub, lowers again and hops onto a real low rock to rest before jumping down. Shrubs slowly grow new leaves.",
  },
  "behavior-pig": {
    zoom: 1.6,
    camera: { wx: 152, wy: 152 },
    description:
      "The pig sniffs a root patch, digs with its snout, uncovers one real root and eats it. Depleted patches slowly replenish while the world runs.",
  },
  "behavior-elephant": {
    zoom: 0.9,
    camera: { wx: 176, wy: 112 },
    description:
      "The elephant reaches for actual tree fruit, curls it to its mouth and eats. It can also shake limited fruit loose for other foragers.",
  },
  "behavior-cat-ginger": {
    zoom: 1.4,
    camera: BEHAVIOR_VIEW,
    description:
      "The cat crouches, stalks, pounces and bats a physical ball, then chases it again. After playing it can climb to rest on the tree.",
  },
  "behavior-cat-black": {
    zoom: 1.4,
    camera: BEHAVIOR_VIEW,
    description:
      "The cat crouches, stalks, pounces and bats a physical ball, then chases it again. After playing it can climb to rest on the tree.",
  },
  "behavior-capuchin": {
    zoom: 1,
    camera: { wx: 160, wy: 100 },
    description:
      "The monkey climbs a real tree, picks one fruit, eats on the crown and climbs down. The crop slowly regrows while the world runs.",
  },
  "behavior-raccoon": {
    zoom: 1,
    camera: { wx: 160, wy: 128 },
    description:
      "The raccoon takes actual food from the squirrel’s cache and carries it under a tree to eat. The squirrel gathers nuts to refill its cache.",
  },
  "behavior-cat": {
    zoom: 1.4,
    camera: BEHAVIOR_VIEW,
    description:
      "The cat crouches, stalks, pounces and bats a physical ball, then chases it again. After playing it can climb to rest on the tree.",
  },
  "behavior-rabbit": {
    zoom: 2,
    camera: { wx: 160, wy: 176 },
    description:
      "The rabbit hops to an edible plant, nibbles it in three visible stages and checks for danger between bites. Food is finite; reset the scene to replenish it.",
  },
  // Include the elevated tree crown and the ground food in the same view.
  "behavior-robin": {
    zoom: 1,
    camera: { wx: 144, wy: 112 },
    description:
      "The robin flies down from an actual tree canopy, pecks and eats the ground food, then flies back to its perch.",
  },
  "behavior-meerkat": {
    zoom: 1.4,
    camera: { wx: 164, wy: 176 },
    description:
      "The group takes turns standing upright to scan. Place a tiger nearby to see the lookout give an alarm and the group escape.",
  },
  "behavior-dog": {
    camera: BEHAVIOR_VIEW,
    description:
      "Throw a ball and wait for it to settle. The dog picks it up, carries it back and drops it near you. Throw again to reuse the returned ball.",
  },
  "behavior-crow": {
    camera: BEHAVIOR_VIEW,
    description:
      "The crow gathers real loose twigs, carries them to a tree perch and builds its nest in four visible stages.",
  },
  "behavior-squirrel": {
    camera: BEHAVIOR_VIEW,
    description:
      "The squirrel gathers real nuts and fruit, buries food in a cache, rests, then digs it up and eats it.",
  },
  lake: {
    zoom: 0.4,
    guide:
      "Large wildlife lake · E beside the motorboat to board; Arrows/WASD steer, R reverses. Return beside a clear shore to get out. Fish schools and varied water animals use the same AI as the game.",
  },
  motocross: {
    zoom: 0.25,
    guide:
      "City outskirts motocross park · A rally car waits at the north straight's start and five race-tuned cars in the pit row. E beside one to drive; ↑ drives, ←/→ steer, hold Shift / RT / Boost for full speed. North straight (eastbound): sky lip and double. South straight (westbound): curved kicker and tabletop. Infield: rollers.",
  },
  racetrack: {
    zoom: 0.13,
    guide:
      "City outskirts speedway · Eight cars race around the oval. Walk to the spectator seating, picnic area or track; cars stop for people. Use Arrows/WASD to walk, Space to jump, and E beside a stopped car to drive.",
  },
  farmstead: { zoom: 0.25 },
  "village-pets": { zoom: 0.3 },
  "city-pets": { zoom: 0.3 },
  "city-center": { zoom: 0.3 },
  pond: {
    zoom: 0.4,
    mounts: POND_MOUNTS,
  },
  frogs: {
    mounts: POND_MOUNTS,
  },
  deer: { mounts: [{ type: DEER_TYPE, label: "deer" }] },
  robins: { mounts: [{ type: ROBIN_TYPE, label: "robin" }] },
  rabbits: { mounts: [{ type: RABBIT_TYPE, label: "rabbit" }] },
} satisfies CompletePresentation;
const byId: ReadonlyMap<string, NaturalCasePresentation> = new Map<string, NaturalCasePresentation>(
  Object.entries(PRESENTATION),
);

export function naturalCasePresentation(id: string): NaturalCasePresentation {
  return byId.get(id) ?? {};
}

export function naturalCaseZoom(id: string): number {
  return (
    byId.get(id)?.zoom ??
    FAUNA_PROFILES.find((p) => p.species === id)?.inspectionZoom ??
    (PREDATOR_PROFILES.find((p) => p.species === id)?.expansion?.habitat === "deep" ? 0.4 : 0.8)
  );
}
