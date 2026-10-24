import type { FaunaProfile } from "./Fauna.js";
import definitions from "./finished-art.json" with { type: "json" };

export interface FinishedBank {
  identity: string;
  revision: string;
  image: string;
  sha256: string;
  policy: "retained-parts" | "material-surfaces";
}

const banks = definitions as Readonly<Record<string, FinishedBank>>;

/** Whole-bank selection: actions and travel always use the same paint contract. */
export function finishedBank(species: string): FinishedBank | undefined {
  return Object.hasOwn(banks, species) ? banks[species] : undefined;
}

export function finishedFaunaArt(profile: FaunaProfile): FaunaProfile {
  const bank = finishedBank(profile.species);
  return bank
    ? { ...profile, image: bank.image, identity: bank.identity, sha256: bank.sha256 }
    : profile;
}

export function finishedPredatorArt<
  T extends {
    species: string;
    revision: string;
    art?: { identity: string; sha256: string };
  },
>(profile: T): T {
  const bank = finishedBank(profile.species);
  if (!bank) return profile;
  if (!profile.art) throw new Error(`Missing native clip contract for ${profile.species}`);
  return {
    ...profile,
    revision: bank.revision,
    art: { ...profile.art, identity: bank.identity, sha256: bank.sha256 },
  };
}
