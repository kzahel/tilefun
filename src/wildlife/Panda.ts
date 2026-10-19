import type { FaunaProfile } from "./Fauna.js";

/** Solitary bamboo foraging with shared native movement and origin-aware replacement. */
export const PANDA_PROFILE: FaunaProfile = {
  species: "panda",
  label: "Panda",
  image: "demos/wildlife-v2/panda/roster-v2/sheet.png",
  identity: "panda-roster-v2-pixels-01",
  sha256: "eaf32465fcf406013586b6aa906bc7b1a7b407f4aa1a7304764235c126395f47",
  size: 64,
  anchor: [32, 48],
  inspection: [-668, 281],
  clips: [
    {
      name: "idle",
      start: 0,
      count: 1,
      frameDuration: 100,
      loop: true,
    },
    {
      name: "walk",
      start: 1,
      count: 32,
      frameDuration: 40,
      loop: true,
    },
    {
      name: "action",
      start: 33,
      count: 8,
      frameDuration: 100,
      loop: false,
    },
    {
      name: "flee",
      start: 1,
      count: 32,
      frameDuration: 20,
      loop: true,
    },
  ],
  body: [28, 14, 27],
  speed: 12,
  radius: 128,
  step: 28,
  alarmDistance: 32,
  group: 1,
  cohesion: 0,
  interest: 0,
  habitat: "woodland",
};
