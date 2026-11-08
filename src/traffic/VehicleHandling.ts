import type { GroundMaterial } from "../physics/GroundMaterial.js";

/** Tire compound (231): felt in handling, never shown in UI. */
export type TireKind = "slick" | "road" | "offroad";
/** Driven axles: front, rear (middle and rear on six-wheel trucks) or all. */
export type Drivetrain = "front" | "rear" | "all";
export interface VehicleHandling {
  tires: TireKind;
  drive: Drivetrain;
}

/** Tire × surface grip multiplier on both drive/brake and cornering grip.
 * Pavement is the ceiling: nothing grips more than the 216 rollover tuning. */
export const SURFACE_GRIP: Readonly<Record<TireKind, Readonly<Record<GroundMaterial, number>>>> = {
  slick: { paved: 1, grass: 0.6, dirt: 0.5, sand: 0.6, water: 0.55 },
  road: { paved: 1, grass: 0.8, dirt: 0.7, sand: 0.75, water: 0.65 },
  offroad: { paved: 0.85, grass: 0.9, dirt: 0.95, sand: 0.9, water: 0.75 },
};
/** Fraction of base top speed sustainable against rolling drag (1 = no drag). */
export const SURFACE_SPEED: Readonly<Record<TireKind, Readonly<Record<GroundMaterial, number>>>> = {
  slick: { paved: 1, grass: 1, dirt: 1, sand: 0.55, water: 0.6 },
  road: { paved: 1, grass: 1, dirt: 1, sand: 0.7, water: 0.65 },
  offroad: { paved: 1, grass: 1, dirt: 1, sand: 0.9, water: 0.8 },
};

const SLICK_REAR = ["open-wheel-racer", "race-coupe", "go-kart"];
const OFFROAD_ALL = [
  "offroad-jeep",
  "monster-truck",
  "rally-hatchback",
  "pickup",
  "farm-tractor",
  "snowplow",
];
const OFFROAD_REAR = ["beach-buggy"];
const ROAD_REAR = [
  "rosso-coupe",
  "classic-roadster",
  "hot-rod",
  "stretch-limousine",
  "beetle",
  "golf-cart",
  "police-car",
  "school-bus",
  "ambulance",
  "motorhome",
  "tow-truck",
  "flatbed-truck",
  "semi-truck",
  "dump-truck",
  "cement-mixer",
  "mobile-crane",
  "street-sweeper",
  "car-transporter",
];
const handling = new Map<string, VehicleHandling>([
  ...SLICK_REAR.map((m) => [m, { tires: "slick", drive: "rear" }] as const),
  ...OFFROAD_ALL.map((m) => [m, { tires: "offroad", drive: "all" }] as const),
  ...OFFROAD_REAR.map((m) => [m, { tires: "offroad", drive: "rear" }] as const),
  ...ROAD_REAR.map((m) => [m, { tires: "road", drive: "rear" }] as const),
]);
const ROAD_FRONT: VehicleHandling = { tires: "road", drive: "front" };
const ROAD_REAR_HANDLING: VehicleHandling = { tires: "road", drive: "rear" };

/** Tires and drivetrain for a vehicle type; unlisted cars are front-drive road cars. */
export function vehicleHandling(type: string): VehicleHandling {
  const model = type.replace(/^vehicle-v1:/, "");
  const listed = handling.get(model);
  if (listed) return listed;
  // Buses, fire/garbage trucks and the sportier car-21–26 silhouettes.
  if (/^(bus-|garbage-truck-|fire-truck-)/.test(model) || /^car-2[1-6]$/.test(model))
    return ROAD_REAR_HANDLING;
  return ROAD_FRONT;
}
