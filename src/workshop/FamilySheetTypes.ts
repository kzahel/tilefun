import type { ArtRect, ArtSheet } from "../art/ArtCatalog.js";

export const FAMILY_SHEET_IDS = ["cabinets", "trees", "scrapyard", "outdoor-seating"] as const;

export interface FamilyFact {
  label: string;
  value: string;
}
export interface FamilySprite {
  size: [number, number];
  background?: string;
  /** Replacement is the default; overlapping forest rows explicitly use source-over. */
  layers: {
    sheetId: string;
    rect: ArtRect;
    at: [number, number];
    blend?: "over";
  }[];
}
export interface FamilyVariant {
  id: string;
  label: string;
  recordIds: string[];
  sprite: FamilySprite;
}
export interface FamilyMember {
  id: string;
  number: number;
  label: string;
  kind: "whole" | "component";
  facts: FamilyFact[];
  question?: string;
  variants: FamilyVariant[];
}
export interface FamilySheet {
  id: (typeof FAMILY_SHEET_IDS)[number];
  name: string;
  description: string;
  status: "proposed";
  revision: string;
  sourcePins: { id: string; fingerprint: string; width: number; height: number }[];
  variantLabel: string;
  variants: { id: string; label: string }[];
  facts: FamilyFact[];
  groups: { id: string; title: string; description?: string; members: FamilyMember[] }[];
  examples: { id: string; label: string; description: string; variants: FamilyVariant[] }[];
}
export interface FamilySheetCatalog {
  version: 1;
  revision: string;
  sources: ArtSheet[];
  families: FamilySheet[];
}

/** Fixed-color members (e.g. mixed forest strips) keep their own first variant. */
export function familyVariant(member: { variants: FamilyVariant[] }, id: string): FamilyVariant {
  const result = member.variants.find((variant) => variant.id === id) ?? member.variants[0];
  if (!result) throw new Error("This piece has no artwork.");
  return result;
}
