import { TILE_SIZE } from "../config/constants.js";
import type { Prop } from "../entities/Prop.js";
import { buildingRecipe } from "../generation/regional/BuildingRecipes.js";
import { denseDoorThresholds } from "../generation/regional/DenseDoorThresholds.js";
import {
  exteriorEntrance,
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

/** Runtime connections read pinned facade facts without changing generated outdoor output. */
export function exteriorDoors(prop: Pick<Prop, "type" | "position">) {
  const primary = exteriorEntrance(prop);
  if (!primary) return [];
  const recipe = buildingRecipe(prop.type);
  const doors = [{ id: "street", outside: primary }];
  if (recipe && prop.type.startsWith("prop-city-")) {
    for (const door of denseDoorThresholds(recipe)) {
      if (door.primary) continue;
      doors.push({ id: door.id, outside: { wx: prop.position.wx + door.dx, wy: primary.wy } });
    }
  }
  return doors;
}

/** New city rooms use one versioned layout and one connection per visible street door. */
export function withBuildingLayout(
  identity: InteriorIdentity,
  position: Prop["position"],
): InteriorIdentity {
  if (!identity.buildingType.startsWith("prop-city-")) return identity;
  const doors = exteriorDoors({ type: identity.buildingType, position }).sort(
    (a, b) => a.outside.wx - b.outside.wx,
  );
  if (doors.length > 2) throw new Error("Unsupported building doorway count");
  return {
    ...identity,
    layout: buildingRecipe(identity.buildingType)?.kind === "shop" ? "shop-v2" : "apartment-v2",
    doors: doors.map((door, i) => ({
      ...door,
      inside: { wx: (i === 0 ? 2 : 8) * 32 + 8, wy: 8 * 32 + 16 },
      arrival: { wx: (i === 0 ? 2 : 8) * 32 + 8, wy: 8 * 32 - 8 },
    })),
  };
}
