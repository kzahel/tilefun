import type { ParkingLot } from "./ParkingSystem.js";

/** Generated geometry in world pixels; one quiet visitor per center. */
export interface ShoppingCenter {
  id: string;
  wx: number;
  wy: number;
  roadY: number;
}
export function shoppingLot(center: ShoppingCenter, model: string): ParkingLot {
  const { wx: x, wy: y, roadY } = center;
  const point = (wx: number, wy: number) => ({ wx: x + wx, wy: y + wy });
  const laneY = roadY - 32 - y; // north-side westbound boulevard lane
  return {
    id: center.id,
    bounds: { left: x, top: y, right: x + 1280, bottom: roadY + 64 },
    visits: [
      {
        id: "road-visitor",
        bayId: "pull-through-2",
        aisle: "center",
        model,
        delay: 0,
        shopSeconds: 12,
        arrival: [point(1176, laneY), point(1176, 264), point(312, 264), point(312, 360)],
        departure: [
          point(312, 360),
          point(312, 536),
          point(104, 536),
          point(104, laneY),
          point(80, laneY),
        ],
        walk: [point(336, 360), point(336, 192), point(288, 192), point(288, 184)],
      },
    ],
  };
}
/** Empty neighboring bays leave the complete driving/walking envelope clear. */
export const SHOPPING_PARKED_BAYS = [
  [432, 360],
  [528, 360],
  [720, 360],
  [816, 360],
  [960, 360],
  [432, 440],
  [720, 440],
  [960, 440],
  [240, 632],
  [384, 632],
  [528, 632],
  [720, 632],
  [864, 632],
  [1008, 632],
  [240, 712],
  [528, 712],
  [720, 712],
  [1008, 712],
] as const;
