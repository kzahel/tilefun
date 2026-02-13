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
  "prop-flower-yellow": { sheetKey: "objects", col: 5, row: 3, width: 16, height: 16, collider: null },
  "prop-sunflower": { sheetKey: "objects", col: 5, row: 2, width: 16, height: 16, collider: null },
  "prop-rock": {
    sheetKey: "objects", col: 7, row: 0, width: 16, height: 16,
    collider: { offsetX: -6, offsetY: -4, width: 12, height: 8 },
  },
  "prop-big-rock": {
    sheetKey: "objects", col: 6, row: 0, width: 16, height: 16,
    collider: { offsetX: -7, offsetY: -5, width: 14, height: 10 },
  },
  "prop-tall-grass": { sheetKey: "objects", col: 0, row: 2, width: 16, height: 16, collider: null },
  "prop-mushroom": { sheetKey: "objects", col: 3, row: 2, width: 16, height: 16, collider: null },
  "prop-pumpkin": { sheetKey: "objects", col: 6, row: 1, width: 16, height: 16, collider: null },
  "prop-berries": { sheetKey: "objects", col: 2, row: 2, width: 16, height: 16, collider: null },
  "prop-sprout": { sheetKey: "objects", col: 8, row: 0, width: 16, height: 16, collider: null },
  "prop-leaf": { sheetKey: "objects", col: 4, row: 2, width: 16, height: 16, collider: null },
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
  };
}

export function isPropType(type: string): boolean {
  return type in PROP_DEFS;
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
];
