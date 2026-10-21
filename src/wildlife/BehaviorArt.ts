import type { Entity } from "../entities/Entity.js";
import carryingArt from "./behavior-art.json" with { type: "json" };
import type { FaunaProfile } from "./Fauna.js";
import gardenArt from "./garden-art.json" with { type: "json" };
import meadowArt from "./meadow-art.json" with { type: "json" };
import pastureArt from "./pasture-art.json" with { type: "json" };
import rangeArt from "./range-art.json" with { type: "json" };
import woodlandArt from "./woodland-art.json" with { type: "json" };

interface BehaviorBank {
  image: string;
  identity: string;
  sha256: string;
  clips: Record<string, { start: number; count: number; frameDuration: number; loop?: boolean }>;
  sockets: (number[] | null)[][];
}
const art: Record<string, BehaviorBank> = {
  ...carryingArt,
  ...meadowArt,
  ...woodlandArt,
  ...pastureArt,
  ...gardenArt,
  ...rangeArt,
};

export function behaviorArt(profile: FaunaProfile): FaunaProfile {
  const bank = art[profile.species as keyof typeof art];
  if (!bank) return profile;
  const extras = Object.entries(bank.clips).filter(
    ([name]) => !["idle", "walk", "bound", "fly", "action"].includes(name),
  );
  return {
    ...profile,
    image: bank.image,
    identity: bank.identity,
    sha256: bank.sha256,
    clips: [
      ...profile.clips,
      ...extras.map(([name, clip]) => ({
        ...clip,
        name,
        loop:
          [
            "scan",
            "climb",
            "eat",
            "sit",
            "stalk",
            "browse",
            "scratch",
            "sip",
            "guard",
            "graze",
            "drink",
            "settle",
          ].includes(name) ||
          (profile.species === "beaver" && name === "build"),
      })),
    ],
  };
}

/** Authored contact point of an action; shared AI uses it to stand within real reach. */
export function actionSocket(
  animal: Entity,
  name: string,
  frame: number,
  direction = animal.sprite?.direction ?? 0,
): readonly number[] | undefined {
  const species = animal.type.replace(/^wildlife-/, "").replace(/-provisional-v1$/, "");
  const bank = art[species],
    clip = bank?.clips[name];
  if (!bank || !clip) return;
  const index = frame < 0 ? clip.count - 1 : Math.min(clip.count - 1, frame);
  return bank.sockets[direction]?.[clip.start + index] ?? undefined;
}

export function carrySocket(animal: Entity): readonly number[] | undefined {
  const species = animal.type?.replace(/^wildlife-/, "").replace(/-provisional-v1$/, "");
  const bank = art[species as keyof typeof art];
  return bank && animal.sprite
    ? (bank.sockets[animal.sprite.direction]?.[animal.sprite.frameCol] ?? undefined)
    : undefined;
}
