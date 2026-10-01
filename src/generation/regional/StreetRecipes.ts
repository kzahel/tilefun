import { MaterialType } from "../../audio/SurfaceType.js";
import type { PropCollider } from "../../entities/Prop.js";

/** Candidate palette: original source pixels and gameplay geometry live together.
 * Audited against the me-complete fingerprint in CITY_PREFAB_SOURCE.
 * These are available for editing/review; frozen generators do not select them.
 */
export interface StreetPropRecipe {
  type: string;
  label: string;
  sourceName: string;
  rect: readonly [number, number, number, number];
  facing: "south" | "west" | "east";
  zone: "furnishing" | "parking";
  collider: PropCollider;
  material: MaterialType;
}
const metal = MaterialType.Metal;
export const STREET_PROP_RECIPES: readonly StreetPropRecipe[] = [
  {
    type: "prop-city-street-v1-meter",
    label: "Parking pay station",
    sourceName: "Parking_Meter_1",
    rect: [816, 224, 16, 32],
    facing: "south",
    zone: "furnishing",
    collider: { offsetX: 0, offsetY: -4, width: 10, height: 8 },
    material: metal,
  },
  {
    type: "prop-city-street-v1-bollard",
    label: "Metal bollard",
    sourceName: "Pole_1",
    rect: [16, 288, 16, 32],
    facing: "south",
    zone: "furnishing",
    collider: { offsetX: 0, offsetY: -3, width: 6, height: 6 },
    material: metal,
  },
  {
    type: "prop-city-street-v1-bin-black",
    label: "Black street bin",
    sourceName: "Black_Closed_Trash_Can",
    rect: [1280, 4048, 32, 32],
    facing: "south",
    zone: "furnishing",
    collider: { offsetX: 0, offsetY: -4, width: 24, height: 12 },
    material: metal,
  },
  {
    type: "prop-city-street-v1-bin-blue",
    label: "Blue street bin",
    sourceName: "Blue_Closed_Trash_Can",
    rect: [1280, 4096, 32, 32],
    facing: "south",
    zone: "furnishing",
    collider: { offsetX: 0, offsetY: -4, width: 24, height: 12 },
    material: metal,
  },
  {
    type: "prop-city-street-v1-planter",
    label: "Flower planter",
    sourceName: "Flower_Bush_1",
    rect: [448, 16, 32, 16],
    facing: "south",
    zone: "furnishing",
    collider: { offsetX: 0, offsetY: -4, width: 28, height: 8, zHeight: 12 },
    material: MaterialType.Wood,
  },
  {
    type: "prop-city-street-v1-car-west",
    label: "Parked sedan · west",
    sourceName: "Car_Left_12",
    rect: [512, 5552, 80, 48],
    facing: "west",
    zone: "parking",
    collider: { offsetX: 0, offsetY: -10, width: 72, height: 24, zHeight: 32 },
    material: metal,
  },
  {
    type: "prop-city-street-v1-car-east",
    label: "Parked sedan · east",
    sourceName: "Car_Right_12",
    rect: [512, 5504, 80, 48],
    facing: "east",
    zone: "parking",
    collider: { offsetX: 0, offsetY: -10, width: 72, height: 24, zHeight: 32 },
    material: metal,
  },
];
export interface StreetRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export interface StreetScene {
  id: string;
  name: string;
  prompt: string;
  buildingType: string;
  /** All coordinates are native world pixels, unlike district tile bounds. */
  bounds: StreetRect;
  walkway: StreetRect;
  approach: StreetRect;
  parking: StreetRect[];
  props: { type: string; wx: number; wy: number }[];
}
const p = (suffix: string, wx: number, wy = 80) => ({
  type: `prop-city-street-v1-${suffix}`,
  wx,
  wy,
});
const shared = {
  buildingType: "prop-city-v1-bakery-2",
  bounds: { minX: -176, minY: -96, maxX: 176, maxY: 176 },
  walkway: { minX: -160, minY: 24, maxX: 160, maxY: 64 },
  approach: { minX: 28, minY: 16, maxX: 52, maxY: 96 },
  parking: [
    { minX: -160, minY: 104, maxX: -64, maxY: 152 },
    { minX: 64, minY: 104, maxX: 160, maxY: 152 },
  ],
};
export const STREET_REVIEW_SCENES: readonly StreetScene[] = [
  {
    ...shared,
    id: "street-v1-meters",
    name: "Parking meters",
    prompt: "Check the pay-station art, curb placement and spacing beside the parking bays.",
    props: [p("meter", -112), p("meter", 112)],
  },
  {
    ...shared,
    id: "street-v1-lighting",
    name: "Lamps & bollards",
    prompt: "Check lamp scale and the small bollards at the curb. Keep the door approach open.",
    props: [
      { type: "prop-street-lamp", wx: -136, wy: 80 },
      { type: "prop-street-lamp", wx: 136, wy: 80 },
      p("bollard", -72),
      p("bollard", 80),
    ],
  },
  {
    ...shared,
    id: "street-v1-bins",
    name: "Street bins",
    prompt: "Check the two bin colors, facing and ground placement. Do these suit this sidewalk?",
    props: [p("bin-black", -112), p("bin-blue", 112)],
  },
  {
    ...shared,
    id: "street-v1-seating",
    name: "Seating & planting",
    prompt: "Check the bench and planter art together, with an open walking strip behind them.",
    props: [
      { type: "prop-bench", wx: -112, wy: 80 },
      p("planter", -72),
      { type: "prop-bench", wx: 96, wy: 80 },
      p("planter", 144),
    ],
  },
  {
    ...shared,
    id: "street-v1-parking",
    name: "Curbside parking",
    prompt:
      "Check both native sedan orientations, their size, and how they sit in the bays. Cars are stationary.",
    props: [p("car-west", -112, 144), p("car-east", 112, 144), p("meter", -112), p("meter", 112)],
  },
  {
    ...shared,
    id: "street-v1-combined",
    name: "Furnished commercial sidewalk",
    prompt:
      "Check the overall composition: furniture at the curb, a clear sidewalk and shop approach, and parked cars.",
    props: [
      { type: "prop-street-lamp", wx: -152, wy: 80 },
      p("meter", -112),
      { type: "prop-bench", wx: -64, wy: 80 },
      p("bin-blue", -24),
      p("planter", 80),
      p("meter", 112),
      { type: "prop-street-lamp", wx: 152, wy: 80 },
      p("car-west", -112, 144),
      p("car-east", 112, 144),
    ],
  },
];
