import type { ColliderComponent } from "../entities/Entity.js";
import type { FaunaProfile, FaunaSpecies } from "./Fauna.js";

// Torso support across authored idle and walk in both camera scales. The square
// stays inside the narrow part of the torso as the animal changes facing.
export const FAUNA_TORSO_FITS: Readonly<
  Partial<Record<FaunaSpecies, readonly [size: number, support: number]>>
> = {
  sheep: [10, 10],
  cow: [12, 14],
  goat: [7, 11],
  piglet: [10, 9],
  elephant: [24, 24],
  giraffe: [14, 29],
  donkey: [9, 15],
  camel: [11, 19],
  horse: [9, 18], // Keep the established saddle and jump height.
  cat: [4, 7],
  mule: [9, 16],
  llama: [9.5, 18.5],
  alpaca: [10, 15],
  zebra: [8.5, 15],
  impala: [7, 17],
  gazelle: [7, 15.5],
  springbok: [6.5, 15.5],
  "saiga-antelope": [8.5, 15],
  okapi: [9.5, 16],
  warthog: [11, 10.5],
  "american-bison": [11.5, 14],
  "musk-ox": [12.5, 12.5],
  "water-buffalo": [12, 15],
  wildebeest: [9, 14.5],
  rhinoceros: [16.5, 16],
  elk: [10, 20],
  moose: [12.5, 21.5],
  capybara: [11.5, 12],
  "red-panda": [7.5, 7.5],
  wombat: [10.5, 8.5],
  "cat-black": [4.5, 7],
  "cat-ginger": [4.5, 7],
  dog: [6, 7.5],
  "dog-golden": [6, 8],
  "dog-shepherd": [7, 8.5],
  "gemsbok-oryx": [8.5, 17],
  gerenuk: [7, 18],
  "malayan-tapir": [15, 17],
  aardvark: [7.5, 11],
  armadillo: [9.5, 7.5],
  "giant-anteater": [8.5, 11],
  echidna: [8.5, 6.5],
  pangolin: [10.5, 9.5],
  hedgehog: [8, 6],
  porcupine: [7, 7],
  meerkat: [7.5, 9],
  beaver: [11, 8.5],
  panda: [14, 14],
  fox: [7.5, 9],
};

export function centeredTorsoCollider(size: number, support: number): ColliderComponent {
  // Entity collider offsets refer to the bottom edge on Y.
  return {
    offsetX: 0,
    offsetY: size / 2,
    width: size,
    height: size,
    physicalHeight: support,
    solid: true,
  };
}

export function faunaCollider({ species, body }: FaunaProfile): ColliderComponent {
  const fit = FAUNA_TORSO_FITS[species];
  if (fit) return centeredTorsoCollider(...fit);
  const [width, height, physicalHeight] = body;
  return { offsetX: 0, offsetY: 0, width, height, physicalHeight, solid: true };
}
