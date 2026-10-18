import type { Prop } from "../../entities/Prop.js";
import { isParkingObject, parkingLayout } from "./ParkingLayout.js";

/** Reconstructible generated props: durable records store type and anchor. */
export const shoppingScenery: readonly Prop[] = buildScenery();
function buildScenery(): Prop[] {
  const props: Prop[] = [];
  for (const p of parkingLayout("shopping").pieces) {
    if (!isParkingObject(p.label)) continue;
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
