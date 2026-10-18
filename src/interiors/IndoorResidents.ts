import { Direction } from "../entities/Entity.js";
import type { ActorPlacement } from "../generation/Generator.js";
import { buildingDoor } from "./BuildingDoors.js";
import { type InteriorIdentity, interiorRealmId } from "./GameplayInterior.js";
import { isLivedIn } from "./LivedInLayouts.js";
import type { ResidentBehavior, ResidentStop } from "./ResidentBehavior.js";

const stop = (
  id: string,
  wx: number,
  wy: number,
  action: ResidentStop["action"],
  seconds: number,
  facing = Direction.Up,
): ResidentStop => ({ id, wx, wy, action, seconds, facing });

export function indoorResidents(identity: InteriorIdentity): ActorPlacement[] {
  if (!isLivedIn(identity)) return [];
  const door = buildingDoor(identity);
  const homeRealm = interiorRealmId(identity.parentWorldId, identity.featureId);
  const resident = (
    name: string,
    type: string,
    stops: [ResidentStop, ...ResidentStop[]],
    visitor = false,
  ): ActorPlacement => {
    const inside = visitor
      ? [
          ...stops,
          stop("street-exit", door.inside.wx, door.inside.wy - 2, "exit", 0.5, Direction.Down),
        ]
      : stops;
    const behavior: ResidentBehavior = {
      homeRealm,
      parentRealm: identity.parentWorldId,
      doorId: door.id,
      place: "inside",
      inside,
      outside: [
        stop("street-pause", door.outside.wx, door.outside.wy + 32, "rest", 5, Direction.Down),
        stop("street-entry", door.outside.wx, door.outside.wy, "enter", 0.5, Direction.Up),
      ],
      index: 0,
      phase: "act",
      elapsed: 0,
      retry: 0,
      path: [],
      ...(type === "wildlife-cat-provisional-v1" ? { cat: true } : {}),
    };
    return {
      featureId: `resident:${identity.featureId}:${name}`,
      type,
      wx: stops[0].wx,
      wy: stops[0].wy,
      route: [],
      resident: behavior,
    };
  };
  if (identity.layout === "home-v3")
    return [
      resident("reader", "indoor-reader", [
        stop("reading-seat", 112, 200, "read", 12, Direction.Down),
        stop("kitchen-break", 240, 90, "rest", 5),
      ]),
      resident("cleaner", "indoor-cleaner", [
        stop("clean-living", 184, 205, "clean", 6),
        stop("clean-bedroom", 88, 104, "clean", 6),
      ]),
      resident("cat", "wildlife-cat-provisional-v1", [
        stop("cat-rug", 160, 234, "rest", 9),
        stop("cat-kitchen", 296, 104, "rest", 5),
      ]),
      resident(
        "visitor",
        "indoor-diner",
        [stop("dining-seat", 212, 198, "eat", 10, Direction.Right)],
        true,
      ),
    ];
  if (identity.layout === "restaurant-v3")
    return [
      resident("cook", "indoor-chef", [
        stop("cooker", 128, 87, "cook", 8),
        stop("prep", 240, 85, "cook", 6),
      ]),
      resident("diner-a", "indoor-diner", [stop("table-a", 76, 176, "eat", 16, Direction.Right)]),
      resident("diner-c", "indoor-reader", [stop("table-c", 76, 240, "read", 18, Direction.Down)]),
      resident("server", "indoor-chef", [
        stop("service", 288, 170, "rest", 3),
        stop("table-service", 244, 200, "rest", 3),
        stop("kitchen-service", 272, 87, "rest", 4),
      ]),
      resident(
        "visitor",
        "indoor-diner",
        [stop("table-b", 188, 176, "eat", 9, Direction.Right)],
        true,
      ),
    ];
  return [
    resident("clerk", "indoor-reader", [
      stop("checkout", 288, 229, "browse", 8),
      stop("restock", 128, 178, "browse", 6),
    ]),
    resident(
      "visitor",
      "indoor-diner",
      [stop("produce", 208, 180, "browse", 7), stop("bread", 128, 180, "browse", 5)],
      true,
    ),
  ];
}
