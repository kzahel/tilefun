import { TerrainId, VariantId } from "../autotile/TerrainId.js";
import { PROMOTED_CHARACTERS } from "../characters/PromotedCharacters.js";
import { RoadType } from "../road/RoadType.js";
import { DEER_TYPE } from "../wildlife/Deer.js";
import { FAUNA_PROFILES, faunaType } from "../wildlife/Fauna.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";

export type EditorTab =
  | "natural"
  | "road"
  | "structure"
  | "entities"
  | "props"
  | "elevation"
  | "patterns";

export interface PaletteEntry {
  terrainId: TerrainId;
  label: string;
  color: string;
}

export interface SheetPaletteEntry {
  sheetKey: string;
  label: string;
  storedValue: number;
}

export const NATURAL_SHEET_PALETTE: SheetPaletteEntry[] = [
  { sheetKey: "me16", label: "Deep/Shlw", storedValue: TerrainId.DeepWater },
  { sheetKey: "me03", label: "Shlw/Grass", storedValue: VariantId.ShallowWaterOnGrass },
  { sheetKey: "me08", label: "Sand/Shlw", storedValue: TerrainId.Sand },
  { sheetKey: "me09", label: "Sand/SandL", storedValue: TerrainId.Sand },
  { sheetKey: "me07", label: "SandL/Grass", storedValue: TerrainId.SandLight },
  { sheetKey: "me01", label: "DirtL/Grass", storedValue: TerrainId.DirtLight },
  { sheetKey: "me02", label: "DirtW/Grass", storedValue: TerrainId.DirtWarm },
  { sheetKey: "me12", label: "Grass/DirtW", storedValue: VariantId.GrassOnDirtWarm },
  { sheetKey: "me15", label: "Grass/Shlw", storedValue: TerrainId.Grass },
  // Alpha variants (prefer overlay behavior)
  { sheetKey: "me13", label: "Grass\u03b1", storedValue: VariantId.GrassAlpha },
  { sheetKey: "me10", label: "Sand\u03b1", storedValue: VariantId.SandAlpha },
];

export interface RoadPaletteEntry {
  roadType: RoadType;
  label: string;
  color: string;
}

export const ROAD_PALETTE: RoadPaletteEntry[] = [
  { roadType: RoadType.CityAsphalt, label: "City asphalt", color: "#3b4042" },
  { roadType: RoadType.CityPavement, label: "City paving", color: "#aeb5b2" },
  { roadType: RoadType.Asphalt, label: "Asphalt", color: "#4a4a50" },
  { roadType: RoadType.Sidewalk, label: "Sidewalk", color: "#b0aaaa" },
  { roadType: RoadType.LineWhite, label: "White", color: "#e0e0e0" },
  { roadType: RoadType.LineYellow, label: "Yellow", color: "#d4a030" },
];

export const STRUCTURE_PALETTE: PaletteEntry[] = [
  { terrainId: TerrainId.Playground, label: "Play", color: "#c87050" },
  { terrainId: TerrainId.Curb, label: "Curb", color: "#808080" },
];

export interface EntityPaletteEntry {
  type: string;
  label: string;
  color: string;
}

export const ENTITY_PALETTE: EntityPaletteEntry[] = [
  ...PROMOTED_CHARACTERS.map((c) => ({ type: c.sheetKey, label: c.name, color: "#d4a880" })),
  { type: MALLARD_TYPE, label: "Mallard duck", color: "#638f66" },
  { type: FROG_TYPE, label: "Common frog", color: "#937b4c" },
  ...FAUNA_PROFILES.map((p) => ({ type: faunaType(p.species), label: p.label, color: "#b59365" })),
  { type: DEER_TYPE, label: "Deer", color: "#b59365" },
  { type: ROBIN_TYPE, label: "Robin", color: "#bc5836" },
  { type: RABBIT_TYPE, label: "Rabbit", color: "#ad967a" },
  { type: "chicken", label: "Chicken", color: "#f0c040" },
  { type: "cow", label: "Cow", color: "#d4a880" },
  { type: "pigeon", label: "Pigeon", color: "#8888cc" },
  { type: "pigeon2", label: "Pigeon 2", color: "#9999aa" },
  { type: "crow", label: "Crow", color: "#333344" },
  { type: "seagull", label: "Seagull", color: "#ccccdd" },
  { type: "fish1", label: "Fish 1", color: "#4fa4b8" },
  { type: "fish2", label: "Fish 2", color: "#3d8ea0" },
  { type: "fish3", label: "Fish 3", color: "#5bb4c8" },
  { type: "campfire", label: "Campfire", color: "#e8601c" },
  { type: "egg-nest", label: "Egg/Nest", color: "#c8a84e" },
  { type: "worm1", label: "Worm 1", color: "#cc6688" },
  { type: "worm2", label: "Worm 2", color: "#88aa44" },
  { type: "worm3", label: "Worm 3", color: "#aa8844" },
  { type: "worm4", label: "Worm 4", color: "#6688aa" },
  { type: "ghost-friendly", label: "Ghost", color: "#b0a0d0" },
  { type: "ghost-angry", label: "Baddie", color: "#d04040" },
  ...Array.from({ length: 20 }, (_, i) => ({
    type: `person${i + 1}`,
    label: `Person ${i + 1}`,
    color: "#b89070",
  })),
];

export const ALL_TABS: EditorTab[] = [
  "natural",
  "road",
  "structure",
  "entities",
  "props",
  "elevation",
  "patterns",
];
export const TERRAIN_TABS: EditorTab[] = ["natural", "road", "structure"];

export const ELEVATION_GRID_SIZES = [1, 2, 3, 4] as const;
export const ELEVATION_COLORS = ["#888", "#9a6", "#c84", "#e44"];
