import { TILE_SIZE } from "../config/constants.js";
import {
  INTERIOR_ENTRY,
  INTERIOR_EXIT,
  type InteriorIdentity,
  interiorRealmId,
} from "./GameplayInterior.js";

export interface BuildingDoor {
  id: string;
  /** Pixel coordinates in the parent outdoor realm. */
  outside: { wx: number; wy: number };
  /** Activation and safe arrival anchors in the shared interior realm. */
  inside: { wx: number; wy: number };
  arrival: { wx: number; wy: number };
}

export interface DoorConnection extends BuildingDoor {
  outsideRealmId: string;
  insideRealmId: string;
}

/** Doors name connections, never interior instances. Legacy rooms retain their street door. */
export function buildingDoors(identity: InteriorIdentity): DoorConnection[] {
  const doors = identity.doors ?? [
    {
      id: "street",
      outside: { wx: identity.returnX * TILE_SIZE, wy: identity.returnY * TILE_SIZE },
      inside: INTERIOR_EXIT,
      arrival: INTERIOR_ENTRY,
    },
  ];
  if (!Array.isArray(doors) || !doors.some((door) => door?.id === "street"))
    throw new Error("Keep the original street door connection.");
  const ids = new Set<string>();
  return doors.map((door) => {
    if (
      !/^[a-zA-Z0-9-]{1,64}$/.test(door.id) ||
      ids.has(door.id) ||
      ![door.outside, door.inside, door.arrival].every(
        (p) =>
          p &&
          Number.isFinite(p.wx) &&
          Number.isFinite(p.wy) &&
          Math.abs(p.wx) <= 2 ** 27 &&
          Math.abs(p.wy) <= 2 ** 27,
      )
    )
      throw new Error("Invalid building door connection.");
    ids.add(door.id);
    return {
      ...door,
      outsideRealmId: identity.parentWorldId,
      insideRealmId: interiorRealmId(identity.parentWorldId, identity.featureId),
    };
  });
}

export function buildingDoor(identity: InteriorIdentity, id = "street"): DoorConnection {
  const door = buildingDoors(identity).find((door) => door.id === id);
  if (!door) throw new Error("Unknown building door.");
  return door;
}
