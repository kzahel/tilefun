import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import type { WorldGenerator } from "../generation/Generator.js";
import { buildingRecipe } from "../generation/regional/BuildingRecipes.js";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { compileFurniture } from "./FurnishedInterior.js";
import { type FurniturePlacement, furnitureDefinition } from "./FurnitureCatalog.js";
import { furnitureCollider } from "./FurnitureMotion.js";
import sources from "./gameplay-furniture-sources.json" with { type: "json" };

export interface InteriorIdentity {
  readonly version: "interior-v1";
  readonly parentWorldId: string;
  readonly featureId: string;
  readonly buildingType: string;
  readonly floor: 0;
  readonly returnX: number;
  readonly returnY: number;
}
export const INTERIOR_ENTRY = { wx: 80, wy: 120 };
export const INTERIOR_EXIT = { wx: 80, wy: 144 };
export const INTERIOR_DOORWAY = { x: 64, y: 128, width: 32, height: 32 };
export const INTERIOR_FLOOR = { x: 8, y: 32, width: 144, height: 96 };
export const FURNITURE_PROP_PREFIX = "prop-interior-furniture:";
export const INTERIOR_WALL_TYPE = "prop-interior-wall";
export function exteriorEntrance(
  prop: Pick<Prop, "type" | "position">,
): { wx: number; wy: number } | null {
  const recipe = buildingRecipe(prop.type);
  if (!recipe && prop.type !== "prop-country-house") return null;
  return {
    wx: prop.position.wx + (recipe?.entrance.dx ?? 0),
    wy: prop.position.wy + (recipe?.entrance.dy ?? 8),
  };
}
export function interiorRealmId(parentWorldId: string, featureId: string): string {
  if (
    !/^[a-zA-Z0-9-]{1,100}$/.test(parentWorldId) ||
    !/^settlement:-?\d+:-?\d+:block:\d+:\d+:lot:\d+$/.test(featureId)
  )
    throw new Error("Invalid building identity.");
  return `interior~${parentWorldId}~${encodeURIComponent(featureId)}~0`;
}
export function parseInteriorId(id: string): { parentWorldId: string; featureId: string } | null {
  if (!id.startsWith("interior~")) return null;
  const pieces = id.split("~");
  if (pieces.length !== 4 || pieces[3] !== "0") throw new Error("Unsupported interior instance.");
  const parentWorldId = pieces[1] ?? "",
    featureId = decodeURIComponent(pieces[2] ?? "");
  if (interiorRealmId(parentWorldId, featureId) !== id)
    throw new Error("Invalid interior instance.");
  return { parentWorldId, featureId };
}
export function interiorPlan(identity: InteriorIdentity) {
  if (
    identity.version !== "interior-v1" ||
    identity.floor !== 0 ||
    !exteriorEntrance({ type: identity.buildingType, position: { wx: 0, wy: 0 } })
  )
    throw new Error("Unsupported interior recipe.");
  const shop = buildingRecipe(identity.buildingType)?.kind === "shop";
  const cell = shop ? "K" : "L";
  const plan = parseFloorPlan(
    `#####\n#${cell.repeat(3)}#\n#${cell.repeat(3)}#\n#${cell.repeat(3)}#\n##+##`,
  );
  const furniture: FurniturePlacement[] = shop
    ? [
        { id: "counter", asset: "worktable", x: 80, y: 72 },
        { id: "stool", asset: "stool", x: 112, y: 98 },
        { id: "plant", asset: "potted-tree", x: 32, y: 65 },
      ]
    : identity.buildingType === "prop-country-house"
      ? [
          { id: "hearth", asset: "fireplace", x: 40, y: 68 },
          { id: "logs", asset: "log-rack", x: 108, y: 68 },
          { id: "chair", asset: "stool", x: 48, y: 98 },
        ]
      : [
          { id: "bed", asset: "single-bed", x: 40, y: 90 },
          { id: "side-table", asset: "side-table", x: 104, y: 70 },
          { id: "dresser", asset: "dresser", x: 112, y: 100 },
        ];
  const objects = compileFurniture(plan, furniture, INTERIOR_FLOOR);
  return { plan, map: buildLayeredApartmentPlan(plan), furniture, objects };
}
export function furnitureAsset(type: string): string | null {
  if (!type.startsWith(FURNITURE_PROP_PREFIX)) return null;
  const asset = type.slice(FURNITURE_PROP_PREFIX.length);
  return asset in sources ? asset : null;
}
export function interiorWalls(): PropCollider[] {
  return [
    { offsetX: 0, offsetY: 144, width: 16, height: 128, zHeight: 64 },
    { offsetX: 160, offsetY: 144, width: 16, height: 128, zHeight: 64 },
    { offsetX: 80, offsetY: 32, width: 144, height: 16, zHeight: 64 },
    { offsetX: 36, offsetY: 144, width: 56, height: 16, zHeight: 64 },
    { offsetX: 124, offsetY: 144, width: 56, height: 16, zHeight: 64 },
    { offsetX: 56, offsetY: 160, width: 16, height: 32, zHeight: 64 },
    { offsetX: 104, offsetY: 160, width: 16, height: 32, zHeight: 64 },
    { offsetX: 80, offsetY: 176, width: 32, height: 16, zHeight: 64 },
  ];
}
export function interiorProp(type: string, wx: number, wy: number): Prop | null {
  if (type === INTERIOR_WALL_TYPE)
    return {
      id: 0,
      type,
      position: { wx, wy },
      isProp: true,
      collider: null,
      walls: interiorWalls(),
      sprite: {
        sheetKey: "modern-interiors",
        frameCol: 0,
        frameRow: 0,
        spriteWidth: 0,
        spriteHeight: 0,
      },
    };
  const asset = furnitureAsset(type);
  if (!asset) return null;
  const def = furnitureDefinition(asset),
    rect = sources[asset as keyof typeof sources];
  const [x = 0, y = 0, w = 0, h = 0] = rect;
  return {
    id: 0,
    type,
    position: { wx, wy },
    isProp: true,
    collider: furnitureCollider(def),
    walls: null,
    sprite: {
      sheetKey: "modern-interiors",
      frameCol: x / 16,
      frameRow: y / 16,
      spriteWidth: w,
      spriteHeight: h,
    },
  };
}
export function interiorGenerator(identity: InteriorIdentity, seed: number): WorldGenerator {
  const { objects } = interiorPlan(identity);
  const fixtures = objects.map((o) => ({
    featureId: `fixture:${o.placement.id}`,
    propType: `${FURNITURE_PROP_PREFIX}${o.definition.id}`,
    wx: o.x,
    wy: o.y,
    width: o.definition.size[0],
    height: o.definition.size[1],
  }));
  return {
    descriptor: createDescriptor("flat", seed),
    terrain: new FlatStrategy(),
    placements: (cx, cy) => ({
      newIntersectionKeys: [],
      placements: fixtures
        .filter(
          (p) =>
            p.wx + p.width / 2 >= cx * CHUNK_SIZE * TILE_SIZE &&
            p.wx - p.width / 2 < (cx + 1) * CHUNK_SIZE * TILE_SIZE &&
            p.wy >= cy * CHUNK_SIZE * TILE_SIZE &&
            p.wy - p.height < (cy + 1) * CHUNK_SIZE * TILE_SIZE,
        )
        .map(({ featureId, propType, wx, wy }) => ({ featureId, propType, wx, wy })),
    }),
  };
}
