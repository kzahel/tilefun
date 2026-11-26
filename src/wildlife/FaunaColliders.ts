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
};

export function faunaCollider({ species, body }: FaunaProfile): ColliderComponent {
  const fit = FAUNA_TORSO_FITS[species];
  if (fit) {
    const [size, support] = fit;
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
  const [width, height, physicalHeight] = body;
  return { offsetX: 0, offsetY: 0, width, height, physicalHeight, solid: true };
}
