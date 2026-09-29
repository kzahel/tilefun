import { type AABB, aabbOverlapsPropWalls, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { PropCollider } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import type { MovementContext } from "../physics/MovementContext.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { compileFurniture, type PlacedFurniture } from "./FurnishedInterior.js";
import type { FurnitureDefinition, FurniturePlacement } from "./FurnitureCatalog.js";

export const MOTION_SKETCH = "#####\n#LLL#\n#LLL#\n#LLL#\n#####";
export const MOTION_SCENES = [
  { id: "bunk", name: "Bunk bed", furniture: [{ id: "bunk", asset: "bunk-bed", x: 80, y: 88 }] },
  {
    id: "wardrobe",
    name: "Wardrobe",
    furniture: [{ id: "wardrobe", asset: "wardrobe", x: 80, y: 88 }],
  },
  {
    id: "worktable",
    name: "Table, plant and stool",
    furniture: [
      { id: "table", asset: "worktable", x: 80, y: 72 },
      { id: "plant", asset: "table-plant", x: 10, y: 20, on: "table" },
      { id: "stool", asset: "stool", x: 80, y: 92 },
    ],
  },
] satisfies { id: string; name: string; furniture: FurniturePlacement[] }[];

/** Convert curated floor rectangles to the same bottom-centred colliders used by game props. */
export function furnitureCollider(d: FurnitureDefinition): PropCollider | null {
  if (!d.blocking) return null;
  const r = d.footprint;
  return { offsetX: r.x + r.width / 2, offsetY: r.y + r.height, width: r.width, height: r.height };
}

export class FurnitureMotion {
  readonly plan = parseFloorPlan(MOTION_SKETCH);
  readonly map = buildLayeredApartmentPlan(this.plan);
  readonly player = createPlayer(80, 120);
  furniture: FurniturePlacement[];
  objects: PlacedFurniture[];
  /** Physical inner edges of this sealed, rectangular test room, in pixels. No 32px wall-cell blocking. */
  readonly floor = { left: 8, top: 32, right: 152, bottom: 128 };
  readonly placementArea = { x: 8, y: 32, width: 144, height: 96 };
  readonly context: MovementContext;
  private jumpState = { jumpConsumed: false, lastJumpHeld: false };
  constructor(furniture: readonly FurniturePlacement[]) {
    this.furniture = structuredClone([...furniture]);
    this.objects = compileFurniture(this.plan, this.furniture, this.placementArea);
    this.context = {
      getCollision: () => 0,
      getHeight: () => 0,
      isEntityBlocked: () => false,
      noclip: false,
      isPropBlocked: (aabb, wz, height) =>
        aabb.left < this.floor.left ||
        aabb.right > this.floor.right ||
        aabb.top < this.floor.top ||
        aabb.bottom > this.floor.bottom ||
        this.objects.some((o) =>
          aabbOverlapsPropWalls(
            aabb,
            { wx: o.x, wy: o.y },
            { collider: furnitureCollider(o.definition), walls: null },
            wz,
            height,
          ),
        ),
    };
    if (!this.objects.some((o) => !o.parent)) throw new Error("Scene needs furniture");
    if (!this.canStand(80, 120)) {
      let spawn: [number, number] | undefined;
      for (let y = 120; y >= 40 && !spawn; y -= 2)
        for (let x = 16; x < 144; x += 2)
          if (this.canStand(x, y)) {
            spawn = [x, y];
            break;
          }
      if (!spawn) throw new Error("No room for the player");
      this.player.position = { wx: spawn[0], wy: spawn[1] };
    }
  }
  canStand(x: number, y: number): boolean {
    const c = this.player.collider;
    if (!c) return false;
    return !this.context.isPropBlocked(
      getEntityAABB({ wx: x, wy: y }, c),
      0,
      c.physicalHeight ?? 12,
    );
  }
  playerBounds(): AABB {
    const collider = this.player.collider;
    if (!collider) throw new Error("Missing player collider");
    return getEntityAABB(this.player.position, collider);
  }
  collisionBoxes(): { id: string; bounds: AABB }[] {
    return this.objects.flatMap((o) => {
      const c = furnitureCollider(o.definition);
      return c ? [{ id: o.placement.id, bounds: getEntityAABB({ wx: o.x, wy: o.y }, c) }] : [];
    });
  }
  /** Reuse the exact player input/physics step used by client prediction and the server. */
  step(dx: number, dy: number, dt = 1 / 120): void {
    const length = Math.hypot(dx, dy),
      scale = Math.max(1, length);
    const input: Movement = { dx: dx / scale, dy: dy / scale, sprinting: false, jump: false };
    this.jumpState = stepPlayerFromInput(
      this.player,
      input,
      Math.min(dt, 1 / 120),
      this.context,
      () => 0,
      () => ({ props: [], entities: [] }),
      this.jumpState,
      getMovementPhysicsParams(),
    ).jumpState;
    const sprite = this.player.sprite;
    if (sprite) {
      if (sprite.moving) {
        sprite.animTimer += dt * 1000;
        if (sprite.animTimer >= sprite.frameDuration) {
          sprite.animTimer %= sprite.frameDuration;
          sprite.frameCol = (sprite.frameCol + 1) % sprite.frameCount;
        }
      } else {
        sprite.animTimer = 0;
        sprite.frameCol = 0;
      }
    }
  }
  moveObject(id: string, x: number, y: number): void {
    const previous = this.furniture,
      oldObjects = this.objects;
    const selected = previous.find((p) => p.id === id);
    if (!selected || selected.on) throw new Error("Move the supporting furniture instead");
    const next = previous.map((p) =>
      p.id === id ? { ...p, x: Math.round(x), y: Math.round(y) } : p,
    );
    const objects = compileFurniture(this.plan, next, this.placementArea);
    for (const o of objects)
      if (
        o.origin[0] < 0 ||
        o.origin[1] < 0 ||
        o.origin[0] + o.definition.size[0] > this.map.width * 16 ||
        o.origin[1] + o.definition.size[1] > this.map.pixelHeight
      )
        throw new Error("Sprite would leave the room view");
    this.furniture = next;
    this.objects = objects;
    if (!this.canStand(this.player.position.wx, this.player.position.wy)) {
      this.furniture = previous;
      this.objects = oldObjects;
      throw new Error("That would overlap the player");
    }
  }
  /** Small deterministic 2px path grid; only the game collision adapter decides passability. */
  pathTo(x: number, y: number): [number, number][] | null {
    const snap = (v: number) => Math.round(v / 2) * 2;
    const start: [number, number] = [snap(this.player.position.wx), snap(this.player.position.wy)],
      target: [number, number] = [snap(x), snap(y)];
    if (!this.canStand(...start) || !this.canStand(...target)) return null;
    const key = (p: [number, number]) => `${p[0]},${p[1]}`;
    const queue: [number, number][] = [start],
      parents = new Map<string, [number, number] | null>([[key(start), null]]);
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (!current) continue;
      if (key(current) === key(target)) {
        const path: [number, number][] = [];
        let p: [number, number] | null = current;
        while (p) {
          path.push(p);
          p = parents.get(key(p)) ?? null;
        }
        return path.reverse();
      }
      for (const [dx, dy] of [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
      ] as const) {
        const next: [number, number] = [current[0] + dx, current[1] + dy];
        if (!parents.has(key(next)) && this.canStand(...next)) {
          parents.set(key(next), current);
          queue.push(next);
        }
      }
    }
    return null;
  }
  circleTargets(id: string): [number, number][] {
    const o = this.objects.find((o) => o.placement.id === id);
    if (!o) throw new Error("Missing object");
    const r = o.footprint,
      l = r.x - 8,
      right = r.x + r.width + 8,
      top = r.y - 6,
      bottom = r.y + r.height + 12;
    return [
      [o.x, top],
      [right, top],
      [right, bottom],
      [o.x, bottom],
      [l, bottom],
      [l, top],
      [o.x, top],
    ];
  }
}
