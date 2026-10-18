import { required } from "../art/ArtCatalog.js";
import type { Prop } from "../entities/Prop.js";
import type { SurfacePiece } from "../road/CitySurfaceRecipes.js";
import { parkingStudy } from "./ParkingLayout.js";

/** Reconstructible generated props: durable records store type and anchor. */
export const shoppingScenery: readonly Prop[] = buildScenery();
function buildScenery(): Prop[] {
  const props: Prop[] = [];
  const ground = new Map<string, SurfacePiece[]>();
  for (const p of parkingStudy("shopping").pieces) {
    const [sx, sy, w, h] = p.rect;
    const object =
      [
        "Commercial roof",
        "Shopfront",
        "Island tree",
        "Shopping carts",
        "Parking pay station",
      ].includes(p.label) || p.label.endsWith("parked reference");
    if (!object) {
      const key = `${Math.floor(p.x / 256)},${Math.floor(p.y / 256)}`;
      const pieces = ground.get(key) ?? [];
      pieces.push(p);
      ground.set(key, pieces);
      continue;
    }
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
  for (const [key, pieces] of ground) {
    const [cx, cy] = key.split(",").map(Number);
    const wx = required(cx) * 256 + 128,
      wy = required(cy) * 256 + 256;
    props.push({
      id: props.length,
      type: `prop-shopping-v1-${props.length}`,
      isProp: true,
      position: { wx, wy },
      sortOffsetY: -2048,
      sprite: {
        sheetKey: "me-complete",
        frameCol: 0,
        frameRow: 0,
        spriteWidth: 256,
        spriteHeight: 256,
        parts: pieces.map((p) => ({
          frameCol: p.rect[0] / 16,
          frameRow: p.rect[1] / 16,
          spriteWidth: p.rect[2],
          spriteHeight: p.rect[3],
          dx: p.x + p.rect[2] / 2 - wx,
          dy: p.y + p.rect[3] - wy,
        })),
      },
      collider: null,
      walls: null,
    });
  }
  return props;
}
export function shoppingSceneryProp(type: string, wx: number, wy: number): Prop | undefined {
  const template = shoppingScenery.find((p) => p.type === type);
  if (!template) return;
  return { ...template, position: { wx, wy } };
}
