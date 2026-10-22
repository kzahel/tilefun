import type { Entity } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { predatorProfile } from "../wildlife/Predator.js";
import recordings from "./animal-recordings.json" with { type: "json" };
import { smallAnimalCallForSpecies, smallAnimalCallForType } from "./SmallAnimalCall.js";

export type AnimalVoice = keyof typeof recordings;
export { recordings as ANIMAL_RECORDINGS };
export const ANIMAL_VOICES: Record<
  AnimalVoice,
  {
    label: string;
    animals: readonly string[];
    cues: readonly string[];
    cooldown: number;
    ambient?: boolean;
    alarmCue?: string;
    quietWhileCarrying?: boolean;
    flightBuzz?: boolean;
    insect?: boolean;
  }
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
  goat: { label: "Bleat", animals: ["goat"], cues: [], cooldown: 20 },
  donkey: { label: "Bray", animals: ["donkey"], cues: [], cooldown: 30 },
  piglet: {
    label: "Startled squeal",
    animals: ["piglet"],
    cues: [],
    cooldown: 15,
    ambient: false,
    alarmCue: "flee",
  },
  crow: {
    label: "Caw",
    animals: ["crow"],
    cues: [],
    cooldown: 22,
    quietWhileCarrying: true,
  },
  raven: {
    label: "Croak",
    animals: ["raven"],
    cues: [],
    cooldown: 28,
    quietWhileCarrying: true,
  },
  pigeon: { label: "Coo", animals: ["pigeon"], cues: [], cooldown: 25 },
  dove: { label: "Coo", animals: ["dove"], cues: [], cooldown: 30 },
  bee: {
    label: "Flight buzz",
    animals: ["bee"],
    cues: [],
    cooldown: 4,
    flightBuzz: true,
    insect: true,
  },
  cricket: { label: "Chirp", animals: ["cricket"], cues: [], cooldown: 25, insect: true },
  tiger: {
    label: "Roar",
    animals: ["tiger"],
    cues: ["display"],
    cooldown: 20,
    ambient: false,
    alarmCue: "display",
  },
  lion: {
    label: "Roar",
    animals: ["lion"],
    cues: ["display"],
    cooldown: 25,
    ambient: false,
    alarmCue: "display",
  },
  leopard: {
    label: "Cough call",
    animals: ["leopard", "panther"],
    cues: ["display"],
    cooldown: 20,
    ambient: false,
    alarmCue: "display",
  },
  "brown-bear": {
    label: "Warning growl",
    animals: ["brown-bear"],
    cues: ["display"],
    cooldown: 25,
    ambient: false,
    alarmCue: "display",
  },
  jaguar: {
    label: "Saw call",
    animals: ["jaguar"],
    cues: ["display"],
    cooldown: 20,
    ambient: false,
    alarmCue: "display",
  },
  wolf: {
    label: "Howl",
    animals: ["wolf"],
    cues: ["display"],
    cooldown: 45,
    ambient: false,
    alarmCue: "display",
  },
  coyote: {
    label: "Howl",
    animals: ["coyote"],
    cues: ["display"],
    cooldown: 35,
    ambient: false,
    alarmCue: "display",
  },
  "spotted-hyena": {
    label: "Whoop",
    animals: ["spotted-hyena"],
    cues: ["display"],
    cooldown: 30,
    ambient: false,
    alarmCue: "display",
  },
  fox: { label: "Bark", animals: ["fox"], cues: [], cooldown: 35 },
  cheetah: {
    label: "Contact meow",
    animals: ["cheetah"],
    cues: ["display"],
    cooldown: 25,
    alarmCue: "display",
  },
  lynx: {
    label: "Warning huff",
    animals: ["lynx"],
    cues: ["display"],
    cooldown: 25,
    ambient: false,
    alarmCue: "display",
  },
  elephant: {
    label: "Trumpet",
    animals: ["elephant", "elephant-upright"],
    cues: ["action"],
    cooldown: 50,
  },
  elk: { label: "Bugle", animals: ["elk"], cues: ["action"], cooldown: 75 },
  deer: {
    label: "Alarm snort",
    animals: ["deer"],
    cues: [],
    cooldown: 15,
    ambient: false,
    alarmCue: "stamp",
  },
  moose: { label: "Low grunt", animals: ["moose"], cues: [], cooldown: 50 },
  zebra: { label: "Bray", animals: ["zebra"], cues: ["action"], cooldown: 40 },
  hippopotamus: { label: "Grunt", animals: ["hippopotamus"], cues: [], cooldown: 45 },
  peacock: {
    label: "Display call",
    animals: ["peacock"],
    cues: ["display"],
    cooldown: 30,
    ambient: false,
  },
  parrot: {
    label: "Macaw call",
    animals: ["parrot"],
    cues: [],
    cooldown: 35,
    quietWhileCarrying: true,
  },
  "wild-turkey": { label: "Gobble", animals: ["wild-turkey"], cues: ["action"], cooldown: 45 },
  sparrow: {
    label: "Chirp",
    animals: ["sparrow"],
    cues: [],
    cooldown: 25,
    quietWhileCarrying: true,
  },
  flamingo: { label: "Honk", animals: ["flamingo"], cues: [], cooldown: 35 },
  penguin: { label: "African penguin call", animals: ["penguin"], cues: [], cooldown: 40 },
  gorilla: {
    label: "Display roar",
    animals: ["gorilla"],
    cues: ["action"],
    cooldown: 45,
    ambient: false,
  },
  chimpanzee: {
    label: "Pant-hoot phrase",
    animals: ["chimpanzee"],
    cues: ["action"],
    cooldown: 60,
    ambient: false,
  },
  orangutan: { label: "Male long-call grumble", animals: ["orangutan"], cues: [], cooldown: 70 },
  "capuchin-monkey": {
    label: "Capuchin calls",
    animals: ["capuchin-monkey"],
    cues: [],
    cooldown: 35,
    quietWhileCarrying: true,
  },
  "ring-tailed-lemur": {
    label: "Contact calls",
    animals: ["ring-tailed-lemur"],
    cues: [],
    cooldown: 35,
  },
  "japanese-macaque": { label: "Coo", animals: ["japanese-macaque"], cues: [], cooldown: 30 },
  "guinea-pig": { label: "Squeak", animals: ["guinea-pig"], cues: [], cooldown: 25 },
  meerkat: {
    label: "Recruitment warning",
    animals: ["meerkat"],
    cues: [],
    cooldown: 18,
    ambient: false,
    alarmCue: "alarm",
  },
  raccoon: {
    label: "Defensive growl",
    animals: ["raccoon"],
    cues: [],
    cooldown: 25,
    ambient: false,
    alarmCue: "flee",
    quietWhileCarrying: true,
  },
  "river-otter": { label: "Chirp", animals: ["river-otter"], cues: [], cooldown: 30 },
  alpaca: { label: "Soft call", animals: ["alpaca"], cues: [], cooldown: 35 },
  llama: {
    label: "Defensive air burst",
    animals: ["llama"],
    cues: [],
    cooldown: 20,
    ambient: false,
    alarmCue: "flee",
  },
};
const voicesBySpecies = new Map(
  (Object.entries(ANIMAL_VOICES) as [AnimalVoice, (typeof ANIMAL_VOICES)[AnimalVoice]][]).flatMap(
    ([voice, profile]) => profile.animals.map((id) => [id, voice] as const),
  ),
);
export function animalVoiceForSpecies(species: string): AnimalVoice | undefined {
  return voicesBySpecies.get(species);
}
export function animalAuditionLabel(species: string): string | undefined {
  const recorded = animalVoiceForSpecies(species);
  return recorded ? ANIMAL_VOICES[recorded].label : smallAnimalCallForSpecies(species)?.label;
}
export function animalVoiceForType(type: string): AnimalVoice | undefined {
  // Only registered authored identities may select voices; never infer from tags or appearance.
  if (type === "cow" || type === "chicken") return type;
  if (!ENTITY_DEFS[type]) return;
  if (type === "wildlife-deer-v1") return "deer";
  const hunter = predatorProfile(type);
  if (hunter) return animalVoiceForSpecies(hunter.species);
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
  if (smallAnimalCallForType(type)) return "synthesized";
  const profile = predatorProfile(type);
  if (profile?.callKind ?? profile?.fierce?.kind) return "synthesized";
  return "missing";
}
