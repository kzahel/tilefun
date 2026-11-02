import type { PositionComponent as Point } from "../entities/Entity.js";

export interface ParkingVisit {
  id: string;
  bayId: string;
  /** Conflicting cars AND crossing pedestrians share this aisle reservation. */
  aisle: string;
  model: string;
  arrival: Point[];
  departure: Point[];
  /** Begins safely beside the car and ends at the shop doorway. */
  walk: Point[];
  shopSeconds: number;
  delay: number;
}
export interface ParkingLot {
  id: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  visits: ParkingVisit[];
}
