import type { Prop } from "../../entities/Prop.js";
import type { ShoppingCenter } from "../../traffic/ShoppingCenter.js";
import type { BuildingRecipe } from "./BuildingRecipes.js";
import { denseDoorThresholds } from "./DenseDoorThresholds.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { parkingLayout } from "./ParkingLayout.js";

/** Reconstructible generated props: durable records store type and anchor. */
export const shoppingScenery: readonly Prop[] = buildScenery();
function buildScenery(): Prop[] {
  const props: Prop[] = [];
  for (const p of parkingLayout("shopping").pieces) {
    if (p.layer === "terrain") continue;
    const [sx, sy, w, h] = p.rect;
    props.push({
      id: props.length,
      type: `prop-shopping-v1-${props.length}`,
      isProp: true,
      position: { wx: p.x + w / 2, wy: p.y + h },
      sprite: {
        sheetKey: "me-complete",
        frameCol: sx / 16,
        frameRow: sy / 16,
        spriteWidth: w,
        spriteHeight: h,
      },
      collider:
        p.label === "Shopfront"
          ? { offsetX: 0, offsetY: 0, width: w, height: 16, zHeight: 64 }
          : null,
      walls: null,
    });
  }
  return props;
}
/** Door metadata for the existing facades; scenery keeps its original sprite/collision. */
export const SHOPPING_BUILDINGS: readonly BuildingRecipe[] = shoppingScenery
  .filter((p) => p.collider !== null)
  .map((p) => {
    const recipe: BuildingRecipe = {
      type: p.type,
      kind: "shop",
      facing: "south",
      width: p.sprite.spriteWidth,
      height: p.sprite.spriteHeight,
      groundDepth: 16,
      entrance: { dx: 0, dy: 16 },
      parts: [
        {
          frameCol: p.sprite.frameCol,
          frameRow: p.sprite.frameRow,
          spriteWidth: p.sprite.spriteWidth,
          spriteHeight: p.sprite.spriteHeight,
          dx: 0,
          dy: 0,
        },
      ],
    };
    const door = denseDoorThresholds(recipe).find((d) => d.primary);
    if (!door) throw new Error(`Missing storefront door: ${p.type}`);
    // Keep the landing clear of the facade collider and align with the native door.
    return { ...recipe, entrance: { dx: door.dx, dy: door.dy + 16 } };
  });
export function shoppingBuilding(type: string): BuildingRecipe | undefined {
  return SHOPPING_BUILDINGS.find((b) => b.type === type);
}

/** One ID/anchor contract for generated scenery and server-side building lookup. */
export function shoppingSceneryPlacements(center: ShoppingCenter): FeaturePlacement[] {
  return shoppingScenery.map((p) => ({
    featureId: `${center.id}:${p.type}`,
    propType: p.type,
    wx: center.wx + p.position.wx,
    wy: center.wy + p.position.wy,
  }));
}
export function shoppingSceneryProp(type: string, wx: number, wy: number): Prop | undefined {
  const template = shoppingScenery.find((p) => p.type === type);
  if (!template) {
    // Retired v1 pavement props (20–39) never publish crop arrays on saved-world reload.
    const index = Number(type.replace("prop-shopping-v1-", ""));
    if (type === `prop-shopping-v1-${index}` && index >= 20 && index < 40)
      return {
        id: 0,
        type,
        isProp: true,
        position: { wx, wy },
        sprite: {
          sheetKey: "me-complete",
          frameCol: 0,
          frameRow: 0,
          spriteWidth: 0,
          spriteHeight: 0,
        },
        collider: null,
        walls: null,
      };
    return;
  }
  return { ...template, position: { wx, wy } };
}
