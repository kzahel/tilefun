import type { ArtRect, ArtSheet } from "../art/ArtCatalog.js";

export const FAMILY_SHEET_IDS = [
  "cabinets",
  "trees",
  "scrapyard",
  "outdoor-seating",
  "sofas",
  "room-builder",
  "playground-tubes",
  "animated-doors",
  "plants-planters",
  "bedroom",
  "fences-gates",
  "kitchens",
  "music-recreation",
  "street-hardware",
] as const;

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
  kind: "whole" | "component" | "unknown" | "frame";
  variantLabel?: string;
  facts: FamilyFact[];
  question?: string;
  variants: FamilyVariant[];
}
export interface FamilyExample {
  id: string;
  label: string;
  description: string;
  groupLabel?: string;
  variants: FamilyVariant[];
  /** Source demonstration timing; does not define gameplay behavior. */
  animation?: { frameDurationsMs: number[]; loop: boolean };
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
  examples: FamilyExample[];
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
