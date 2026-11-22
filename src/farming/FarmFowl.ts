import type { FaunaProfile } from "../wildlife/Fauna.js";

export const DOMESTIC_HEN = "wildlife-chicken-provisional-v1";
export const ROOSTER = "wildlife-rooster-provisional-v1";
export const CHICK = "wildlife-chick-provisional-v1";

export function isFarmHen(type: string): boolean {
  return type === DOMESTIC_HEN || type === "chicken";
}

export function isFarmFowl(type: string): boolean {
  return isFarmHen(type) || type === ROOSTER || type === CHICK;
}

const clips = [
  { name: "idle", start: 0, count: 1, frameDuration: 160, loop: true },
  { name: "walk", start: 1, count: 4, frameDuration: 125, loop: true },
  { name: "action", start: 5, count: 2, frameDuration: 280, loop: false },
  { name: "flee", start: 1, count: 4, frameDuration: 65, loop: true },
];
const common = {
  size: 32,
  anchor: [16, 25],
  inspection: [0, 0],
  clips,
  step: 16,
  alarmDistance: 20,
  group: 3,
  cohesion: 0.14,
  interest: 0.15,
  habitat: "pasture",
} as const;

/** Farm-only forms. Their art and placement are independent of the wild roster. */
export const FARM_FOWL_PROFILES: readonly FaunaProfile[] = [
  {
    ...common,
    species: "rooster",
    label: "Rooster",
    image: "assets/farming/rooster-v1.png",
    identity: "farm-rooster-v1",
    sha256: "cb1ea7fdd394455f4d6aafa73a8aa73d8b01e2b9ec9fb90d88fce5d415483870",
    body: [11, 7, 19],
    speed: 12,
    radius: 48,
  },
  {
    ...common,
    species: "chick",
    label: "Chick",
    image: "assets/farming/chick-v1.png",
    identity: "farm-chick-v1",
    sha256: "658337fb9929a07ff57adaaebdd092f8c01e4b8657540ea46b821cfd98b94b0d",
    body: [6, 4, 7],
    speed: 9,
    radius: 30,
  },
];
