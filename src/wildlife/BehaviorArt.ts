import type { Entity } from "../entities/Entity.js";
import carryingArt from "./behavior-art.json" with { type: "json" };
import type { FaunaProfile } from "./Fauna.js";
import meadowArt from "./meadow-art.json" with { type: "json" };

const art = { ...carryingArt, ...meadowArt };

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
      ...extras.map(([name, clip]) => ({ ...clip, name, loop: name === "scan" })),
    ],
  };
}

export function carrySocket(animal: Entity): readonly number[] | undefined {
  const species = animal.type?.replace(/^wildlife-/, "").replace(/-provisional-v1$/, "");
  const bank = art[species as keyof typeof art];
  return bank && animal.sprite
    ? bank.sockets[animal.sprite.direction]?.[animal.sprite.frameCol]
    : undefined;
}
