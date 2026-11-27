import type { CivicPiece } from "../../entities/CivicScenery.js";
import { CONSTRUCTION_CRATE, CONSTRUCTION_PALLET } from "../../entities/ConstructionCargo.js";
import { Direction } from "../../entities/Entity.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import type { FeaturePlacement } from "../StructureGenerator.js";
import type { Bounds, Point } from "./RegionalPlanner.js";
import type { DepotVehicle } from "./VehicleDepotPlanner.js";

export const siteLabels = {
  salvage: "Salvage yard",
  cemetery: "Memorial garden",
  hospital: "City hospital",
  clinic: "Town clinic",
  post: "Post office",
  "postal-depot": "Parcel depot",
  fire: "Fire station",
  school: "Clocktower school",
  nursery: "Plant nursery",
} as const;
export type CivicKind = keyof typeof siteLabels;
export interface CivicSite {
  kind: CivicKind;
  id: string;
  name: string;
  center: Point;
  arrival: Point;
  bounds: Bounds;
  props: FeaturePlacement[];
  vehicles: DepotVehicle[];
  actors: ActorPlacement[];
}
// All sites face their block's southern sidewalk. Decorations and lanes use local tiles.
export function furnishSite(
  kind: CivicKind,
  id: string,
  town: string,
  bounds: Bounds,
  variant: number,
): CivicSite {
  const x = (bounds.minX + bounds.maxX) / 2,
    y = (bounds.minY + bounds.maxY) / 2;
  const site: CivicSite = {
    kind,
    id,
    name: `${town} · ${siteLabels[kind]}`,
    center: { x, y },
    arrival: { x, y: bounds.maxY + 1 },
    bounds,
    props: [],
    actors: [],
    vehicles: [],
  };
  const prop = (key: string, type: string, dx: number, dy: number) =>
    site.props.push({
      featureId: `${id}:${key}`,
      propType: type,
      wx: (x + dx) * 16,
      wy: (y + dy) * 16,
    });
  const art = (key: string, kind: CivicPiece, dx: number, dy: number) =>
    prop(key, `prop-civic-${kind}`, dx, dy);
  const actor = (key: string, type: string, dx: number, dy: number) =>
    site.actors.push({
      featureId: `${id}:${key}`,
      type,
      wx: (x + dx) * 16,
      wy: (y + dy) * 16,
      route: [],
    });
  const vehicle = (model: string, dx: number, dy: number, facing = Direction.Right) =>
    site.vehicles.push({
      identity: `placed-vehicle-v1:${id}:${model}`,
      model,
      wx: (x + dx) * 16,
      wy: (y + dy) * 16,
      facing,
    });
  switch (kind) {
    case "salvage":
      art("stack", "stack", 7, -5);
      art("wreck", "wreck", 8, 1);
      art("scrap", "scrap", -8, 6);
      art("rear-stack", variant < 0.5 ? "wreck" : "stack", 2, -8);
      vehicle("forklift", -1, 4);
      actor("salvage-pallet", CONSTRUCTION_PALLET, 3, 4);
      actor("spare-pallet", CONSTRUCTION_PALLET, 3, 7);
      break;
    case "cemetery":
      art("gate", "gate", 4, 8);
      site.arrival.x += 4;
      for (const [i, dy] of [-6, -2, 2].entries())
        for (const [j, dx] of [1, 7, 10].entries())
          art(`marker-${i}-${j}`, (i + j) % 2 ? "stone" : "marble", dx, dy);
      art("flowers", "blossoms", 1, 0);
      art("lamp", "candle", 7, 7);
      art("tree", "autumn", 11, -8);
      prop("seat", "prop-bench", -1, 5);
      actor("crow", "wildlife-crow-provisional-v1", 9, 5);
      break;
    case "hospital":
    case "clinic":
      vehicle("ambulance", kind === "clinic" ? 6 : -6, 6);
      art("bed", "stretcher", 5, 5);
      prop("seat", "prop-bench", 8, 8);
      break;
    case "post":
    case "postal-depot":
      if (kind === "post") art("mailbox", "mailbox", -7, 7);
      art("loading", kind === "postal-depot" ? "dispatch" : "parcels", 3, 1);
      vehicle("delivery-van", 7, 4);
      actor("parcel", CONSTRUCTION_CRATE, 3, 6);
      if (kind === "postal-depot") actor("outgoing", CONSTRUCTION_CRATE, 4, 7);
      break;
    case "fire":
      vehicle("fire-truck-ladder-1", 0, 5, Direction.Down);
      prop("hydrant", "prop-fire-hydrant", 8, 8);
      if (variant > 0.5) prop("bench", "prop-bench", -8, 5);
      break;
    case "school":
      vehicle("school-bus", -6, 8);
      actor("football", "ball", 6, 5);
      art("goal", "goal", 9, 1);
      prop("seat", "prop-bench", -9, 2);
      break;
    case "nursery":
      art("glasshouse", "greenhouse", 5, 0);
      for (const [i, dx] of [-7, -4, 3, 6, 9].entries())
        art(`display-${i}`, i % 2 ? "pots" : "topiary", dx, 6);
      prop("flowers", "prop-park-flowers", -7, 2);
      art("glasshouse-plants", "pots", 5, -2);
      break;
  }
  return site;
}
export function civicPaving(s: CivicSite, tx: number, ty: number): RoadType {
  const dx = tx + 0.5 - s.center.x,
    dy = ty + 0.5 - s.center.y;
  if (s.kind === "cemetery")
    return Math.abs(dx - 4) < 1.2 || (Math.abs(dy - 4) < 1 && dx > -8 && dx < 11)
      ? RoadType.CityPavement
      : RoadType.None;
  if (s.kind === "school") return dy >= 6 && dx < 0 ? RoadType.CityPavement : RoadType.None;
  if (s.kind === "nursery")
    return Math.abs(dx) < 1.2 || (Math.abs(dy - 4) < 1.2 && Math.abs(dx) < 11)
      ? RoadType.CityPavement
      : RoadType.None;
  return dy >= -3 && (Math.abs(dx) < 11 || dy < 2) ? RoadType.CityPavement : RoadType.None;
}
