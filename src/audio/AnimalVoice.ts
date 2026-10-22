import type { Entity } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { predatorProfile } from "../wildlife/Predator.js";
import recordings from "./animal-recordings.json";

export type AnimalVoice = keyof typeof recordings;
export { recordings as ANIMAL_RECORDINGS };
export const ANIMAL_VOICES: Record<
  AnimalVoice,
  { label: string; animals: readonly string[]; cues: readonly string[]; cooldown: number }
> = {
  dog: {
    label: "Bark",
    animals: ["dog", "dog-golden", "dog-shepherd"],
    cues: ["release"],
    cooldown: 8,
  },
  cat: { label: "Meow", animals: ["cat", "cat-ginger", "cat-black"], cues: ["sit"], cooldown: 12 },
  cow: { label: "Moo", animals: ["cow"], cues: [], cooldown: 25 },
  sheep: { label: "Bleat", animals: ["sheep"], cues: ["bleat"], cooldown: 8 },
  chicken: { label: "Cluck", animals: ["chicken"], cues: ["peck"], cooldown: 10 },
  horse: { label: "Whinny", animals: ["horse"], cues: [], cooldown: 30 },
};
const voicesBySpecies = new Map(
  (Object.entries(ANIMAL_VOICES) as [AnimalVoice, (typeof ANIMAL_VOICES)[AnimalVoice]][]).flatMap(
    ([voice, profile]) => profile.animals.map((id) => [id, voice] as const),
  ),
);
export function animalVoiceForSpecies(species: string): AnimalVoice | undefined {
  return voicesBySpecies.get(species);
}
export function animalVoiceForType(type: string): AnimalVoice | undefined {
  // Explicitly admit only the known authored types and the two legacy farm actors.
  if (type === "cow" || type === "chicken") return type;
  if (!type.startsWith("wildlife-") || !type.endsWith("-provisional-v1")) return;
  return animalVoiceForSpecies(type.slice(9, -15));
}
export function animalAudioPose(entity: Entity): string {
  return ENTITY_DEFS[entity.type]?.sprite?.clips?.[entity.sprite?.clip ?? 0]?.name ?? "idle";
}

export function animalSoundCoverage(
  type: string,
): "recorded" | "synthesized" | "game-only" | "missing" {
  if (animalVoiceForType(type)) return "recorded";
  const profile = predatorProfile(type);
  if (profile?.callKind ?? profile?.fierce?.kind) return "synthesized";
  if (["wildlife-robin-v1", "wildlife-frog-v1", "wildlife-mallard-v1"].includes(type))
    return "game-only";
  return "missing";
}
