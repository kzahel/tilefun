import type { Prop, PropCollider } from "./Prop.js";

interface PropDef {
  sheetKey: string;
  col: number;
  row: number;
  width: number;
  height: number;
  collider: PropCollider | null;
}

/** Prop definitions keyed by type string. Coordinates match TileRegistry.ts. */
const PROP_DEFS: Record<string, PropDef> = {
  "prop-flower-red": { sheetKey: "objects", col: 1, row: 2, width: 16, height: 16, collider: null },
  "prop-flower-yellow": {
    sheetKey: "objects",
    col: 5,
    row: 3,
    width: 16,
    height: 16,
    collider: null,
  },
  "prop-sunflower": { sheetKey: "objects", col: 5, row: 2, width: 16, height: 16, collider: null },
  "prop-rock": {
    sheetKey: "objects",
    col: 7,
    row: 0,
    width: 16,
    height: 16,
    collider: { offsetX: 0, offsetY: 0, width: 12, height: 8 },
  },
  "prop-big-rock": {
    sheetKey: "objects",
    col: 6,
    row: 0,
    width: 16,
    height: 16,
    collider: { offsetX: 0, offsetY: 0, width: 14, height: 10 },
  },
  "prop-tall-grass": { sheetKey: "objects", col: 0, row: 2, width: 16, height: 16, collider: null },
  "prop-mushroom": { sheetKey: "objects", col: 3, row: 2, width: 16, height: 16, collider: null },
  "prop-pumpkin": { sheetKey: "objects", col: 6, row: 1, width: 16, height: 16, collider: null },
  "prop-berries": { sheetKey: "objects", col: 2, row: 2, width: 16, height: 16, collider: null },
  "prop-sprout": { sheetKey: "objects", col: 8, row: 0, width: 16, height: 16, collider: null },
  "prop-leaf": { sheetKey: "objects", col: 4, row: 2, width: 16, height: 16, collider: null },
  // Large props (each has its own sheet)
  "prop-tent-blue": {
    sheetKey: "prop-tent-blue",
    col: 0,
    row: 0,
    width: 64,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 56, height: 32 },
  },
  "prop-tent-green": {
    sheetKey: "prop-tent-green",
    col: 0,
    row: 0,
    width: 64,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 56, height: 32 },
  },
  "prop-sand-castle": {
    sheetKey: "prop-sand-castle",
    col: 0,
    row: 0,
    width: 32,
    height: 32,
    collider: null,
  },
  "prop-beach-umbrella": {
    sheetKey: "prop-beach-umbrella",
    col: 0,
    row: 0,
    width: 48,
    height: 64,
    collider: null,
  },
  "prop-palm-tree": {
    sheetKey: "prop-palm-tree",
    col: 0,
    row: 0,
    width: 64,
    height: 80,
    collider: { offsetX: 0, offsetY: 0, width: 12, height: 12 },
  },
  "prop-oak-tree": {
    sheetKey: "prop-oak-tree",
    col: 0,
    row: 0,
    width: 64,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 16, height: 12 },
  },
  "prop-fountain": {
    sheetKey: "prop-fountain",
    col: 0,
    row: 0,
    width: 32,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 24, height: 20 },
  },
  "prop-picnic-table": {
    sheetKey: "prop-picnic-table",
    col: 0,
    row: 0,
    width: 48,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 40, height: 24 },
  },
  "prop-shed": {
    sheetKey: "prop-shed",
    col: 0,
    row: 0,
    width: 48,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 40, height: 32 },
  },
  // Playground equipment
  "prop-climb-arch": {
    sheetKey: "prop-climb-arch",
    col: 0,
    row: 0,
    width: 48,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 40, height: 24 },
  },
  "prop-swing": {
    sheetKey: "prop-swing",
    col: 0,
    row: 0,
    width: 32,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 24, height: 16 },
  },
  "prop-seesaw": {
    sheetKey: "prop-seesaw",
    col: 0,
    row: 0,
    width: 48,
    height: 32,
    collider: { offsetX: 0, offsetY: 0, width: 40, height: 16 },
  },
  "prop-bouncy-castle": {
    sheetKey: "prop-bouncy-castle",
    col: 0,
    row: 0,
    width: 64,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 56, height: 32 },
  },
  "prop-slide": {
    sheetKey: "prop-slide",
    col: 0,
    row: 0,
    width: 64,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 56, height: 24 },
  },
  "prop-play-fort": {
    sheetKey: "prop-play-fort",
    col: 0,
    row: 0,
    width: 80,
    height: 80,
    collider: { offsetX: 0, offsetY: 0, width: 72, height: 40 },
  },
  "prop-tube-cross": {
    sheetKey: "prop-tube-cross",
    col: 0,
    row: 0,
    width: 48,
    height: 48,
    collider: { offsetX: 0, offsetY: 0, width: 40, height: 24 },
  },
  "prop-tube-climber": {
    sheetKey: "prop-tube-climber",
    col: 0,
    row: 0,
    width: 96,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 88, height: 32 },
  },
  "prop-basketball-hoop": {
    sheetKey: "prop-basketball-hoop",
    col: 0,
    row: 0,
    width: 48,
    height: 64,
    collider: { offsetX: 0, offsetY: 0, width: 12, height: 12 },
  },
  "prop-dino-topiary": {
    sheetKey: "prop-dino-topiary",
    col: 0,
    row: 0,
    width: 64,
    height: 32,
    collider: { offsetX: 0, offsetY: 0, width: 56, height: 16 },
  },
};

export function createProp(type: string, wx: number, wy: number): Prop {
  const def = PROP_DEFS[type];
  if (!def) throw new Error(`Unknown prop type: ${type}`);
  return {
    id: 0,
    type,
    position: { wx, wy },
    sprite: {
      sheetKey: def.sheetKey,
      frameCol: def.col,
      frameRow: def.row,
      spriteWidth: def.width,
      spriteHeight: def.height,
    },
    collider: def.collider ? { ...def.collider } : null,
    isProp: true,
  };
}

export function isPropType(type: string): boolean {
  return type in PROP_DEFS;
}

/** Get the sheet key and frame coords for a prop type (used by editor preview). */
export function getPropSheetInfo(
  type: string,
): { sheetKey: string; col: number; row: number } | undefined {
  const def = PROP_DEFS[type];
  if (!def) return undefined;
  return { sheetKey: def.sheetKey, col: def.col, row: def.row };
}

/** Prop palette metadata for the editor UI. */
export interface PropPaletteEntry {
  type: string;
  label: string;
  color: string;
  category: "nature" | "playground";
}

export const PROP_PALETTE: PropPaletteEntry[] = [
  { type: "prop-flower-red", label: "Red Flower", color: "#e04040", category: "nature" },
  { type: "prop-flower-yellow", label: "Ylw Flower", color: "#e0d040", category: "nature" },
  { type: "prop-sunflower", label: "Sunflower", color: "#f0c020", category: "nature" },
  { type: "prop-tall-grass", label: "Tall Grass", color: "#60a040", category: "nature" },
  { type: "prop-mushroom", label: "Mushroom", color: "#c08060", category: "nature" },
  { type: "prop-rock", label: "Rock", color: "#888888", category: "nature" },
  { type: "prop-big-rock", label: "Big Rock", color: "#666666", category: "nature" },
  { type: "prop-pumpkin", label: "Pumpkin", color: "#e08020", category: "nature" },
  { type: "prop-berries", label: "Berries", color: "#8040c0", category: "nature" },
  { type: "prop-sprout", label: "Sprout", color: "#40c040", category: "nature" },
  { type: "prop-leaf", label: "Leaf", color: "#80c040", category: "nature" },
  // Large props
  { type: "prop-tent-blue", label: "Blue Tent", color: "#4080c0", category: "playground" },
  { type: "prop-tent-green", label: "Green Tent", color: "#40a060", category: "playground" },
  { type: "prop-sand-castle", label: "Sand Castle", color: "#d0a040", category: "playground" },
  { type: "prop-beach-umbrella", label: "Umbrella", color: "#60a0d0", category: "playground" },
  { type: "prop-palm-tree", label: "Palm Tree", color: "#40a040", category: "playground" },
  { type: "prop-oak-tree", label: "Oak Tree", color: "#308030", category: "playground" },
  { type: "prop-fountain", label: "Fountain", color: "#6080b0", category: "playground" },
  { type: "prop-picnic-table", label: "Picnic Table", color: "#906040", category: "playground" },
  { type: "prop-shed", label: "Shed", color: "#5080a0", category: "playground" },
  { type: "prop-climb-arch", label: "Climb Arch", color: "#d04040", category: "playground" },
  { type: "prop-swing", label: "Swing", color: "#4060c0", category: "playground" },
  { type: "prop-seesaw", label: "Seesaw", color: "#c06040", category: "playground" },
  { type: "prop-bouncy-castle", label: "Bouncy Castle", color: "#d04080", category: "playground" },
  { type: "prop-slide", label: "Slide", color: "#c08040", category: "playground" },
  { type: "prop-play-fort", label: "Play Fort", color: "#d06030", category: "playground" },
  { type: "prop-tube-cross", label: "Tube Cross", color: "#d04040", category: "playground" },
  { type: "prop-tube-climber", label: "Tube Climber", color: "#4080d0", category: "playground" },
  { type: "prop-basketball-hoop", label: "B-ball Hoop", color: "#808080", category: "playground" },
  { type: "prop-dino-topiary", label: "Dino Topiary", color: "#30a040", category: "playground" },
];
