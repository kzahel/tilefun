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
import {
  FURNITURE_BODIES,
  type FurnitureBodies,
  type FurnitureBody,
  parseFurnitureBodies,
} from "./FurniturePhysics.js";

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
  {
    id: "bedside",
    name: "Single bed, bedside table and lamp",
    furniture: [
      { id: "bed", asset: "single-bed", x: 64, y: 90 },
      { id: "side-table", asset: "side-table", x: 100, y: 76 },
      { id: "lamp", asset: "table-lamp", x: 8, y: 12, on: "side-table" },
    ],
  },
  {
    id: "dresser",
    name: "Low dresser and mirror",
    furniture: [
      { id: "dresser", asset: "dresser", x: 80, y: 88 },
      { id: "mirror", asset: "table-mirror", x: 16, y: 14, on: "dresser" },
    ],
  },
  {
    id: "tree",
    name: "Potted tree",
    furniture: [{ id: "tree", asset: "potted-tree", x: 80, y: 88 }],
  },
  {
    id: "floor-lamp",
    name: "Tall floor lamp",
    furniture: [{ id: "lamp", asset: "floor-lamp", x: 80, y: 88 }],
  },
  {
    id: "hearth",
    name: "Fireplace and log rack",
    furniture: [
      { id: "fireplace", asset: "fireplace", x: 68, y: 84 },
      { id: "logs", asset: "log-rack", x: 112, y: 84 },
    ],
  },
  {
    id: "rug-stool",
    name: "Stool on a rug",
    furniture: [
      { id: "stool", asset: "stool", x: 80, y: 88 },
      { id: "rug", asset: "rug", x: 80, y: 100 },
    ],
  },
  {
    id: "wall-display",
    name: "Dresser beneath wall art",
    furniture: [
      { id: "dresser", asset: "dresser", x: 80, y: 80 },
      { id: "picture", asset: "wall-picture", x: 80, y: 28 },
    ],
  },
  {
    id: "seating-corner",
    name: "Stool, rug, plant and floor lamp",
    furniture: [
      { id: "stool", asset: "stool", x: 80, y: 96 },
      { id: "tree", asset: "potted-tree", x: 52, y: 68 },
      { id: "lamp", asset: "floor-lamp", x: 110, y: 72 },
      { id: "rug", asset: "rug", x: 80, y: 104 },
    ],
  },
] satisfies { id: string; name: string; furniture: FurniturePlacement[] }[];

/** Convert curated floor rectangles to the same bottom-centred colliders used by game props. */
export function furnitureCollider(
  d: FurnitureDefinition,
  body = FURNITURE_BODIES[d.id],
): PropCollider | null {
  if (!d.blocking) return null;
  if (!body) throw new Error(`No reviewed physics candidate for ${d.id}`);
  const r = d.footprint;
  return {
    zHeight: body.height,
    walkableTop: body.walkableTop,
    offsetX: r.x + r.width / 2,
    offsetY: r.y + r.height,
    width: r.width,
    height: r.height,
  };
}

export class FurnitureMotion {
  readonly plan = parseFloorPlan(MOTION_SKETCH);
  readonly map = buildLayeredApartmentPlan(this.plan);
  readonly player = createPlayer(80, 120);
  furniture: FurniturePlacement[];
  objects: PlacedFurniture[];
  bodies: FurnitureBodies;
  gravityScale = 1;
  /** Physical inner edges of this sealed, rectangular test room, in pixels. No 32px wall-cell blocking. */
  readonly floor = { left: 8, top: 32, right: 152, bottom: 128 };
  readonly placementArea = { x: 8, y: 32, width: 144, height: 96 };
  readonly context: MovementContext;
  private jumpState = { jumpConsumed: false, lastJumpHeld: false };
  constructor(furniture: readonly FurniturePlacement[], bodies?: FurnitureBodies) {
    this.furniture = structuredClone([...furniture]);
    this.objects = compileFurniture(this.plan, this.furniture, this.placementArea);
    this.bodies = parseFurnitureBodies(
      bodies ??
        Object.fromEntries(
          this.objects
            .filter((o) => o.definition.blocking)
            .map((o) => [o.placement.id, FURNITURE_BODIES[o.definition.id]]),
        ),
    );
    for (const o of this.objects)
      if (o.definition.blocking && !this.bodies[o.placement.id])
        throw new Error("Missing furniture height");
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
            { collider: furnitureCollider(o.definition, this.bodies[o.placement.id]), walls: null },
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
  canStand(x: number, y: number, z = 0): boolean {
    const c = this.player.collider;
    if (!c) return false;
    return !this.context.isPropBlocked(
      getEntityAABB({ wx: x, wy: y }, c),
      z,
      c.physicalHeight ?? 12,
    );
  }
  playerBounds(): AABB {
    const collider = this.player.collider;
    if (!collider) throw new Error("Missing player collider");
    return getEntityAABB(this.player.position, collider);
  }
  collisionBoxes(): { id: string; bounds: AABB; height: number; walkableTop: boolean }[] {
    return this.objects.flatMap((o) => {
      const c = furnitureCollider(o.definition, this.bodies[o.placement.id]);
      return c
        ? [
            {
              id: o.placement.id,
              bounds: getEntityAABB({ wx: o.x, wy: o.y }, c),
              height: c.zHeight ?? 0,
              walkableTop: c.walkableTop ?? false,
            },
          ]
        : [];
    });
  }
  /** Reuse the exact player input/physics step used by client prediction and the server. */
  step(dx: number, dy: number, dt = 1 / 120, jump = false): void {
    const length = Math.hypot(dx, dy),
      scale = Math.max(1, length);
    const input: Movement = { dx: dx / scale, dy: dy / scale, sprinting: false, jump };
    this.jumpState = stepPlayerFromInput(
      this.player,
      input,
      Math.min(dt, 1 / 120),
      this.context,
      () => 0,
      () => ({
        props: this.objects.map((o) => ({
          position: { wx: o.x, wy: o.y },
          collider: furnitureCollider(o.definition, this.bodies[o.placement.id]),
          walls: null,
        })),
        entities: [],
      }),
      this.jumpState,
      { ...getMovementPhysicsParams(), gravityScale: this.gravityScale },
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
    if (!this.canStand(this.player.position.wx, this.player.position.wy, this.player.wz ?? 0)) {
      this.furniture = previous;
      this.objects = oldObjects;
      throw new Error("That would overlap the player");
    }
  }
  setBody(id: string, body: FurnitureBody): void {
    if (!this.bodies[id]) throw new Error("Missing furniture body");
    const next = parseFurnitureBodies({ ...this.bodies, [id]: body });
    const previous = this.bodies;
    this.bodies = next;
    if (!this.canStand(this.player.position.wx, this.player.position.wy, this.player.wz ?? 0)) {
      this.bodies = previous;
      throw new Error("That height would overlap the player; move or reset the player first");
    }
  }
  resetPlayer(): void {
    if (!this.canStand(80, 120))
      throw new Error("Move furniture away from the starting position first");
    this.player.position = { wx: 80, wy: 120 };
    this.player.velocity = { vx: 0, vy: 0 };
    this.player.wz = 0;
    this.player.groundZ = 0;
    delete this.player.jumpZ;
    delete this.player.jumpVZ;
    this.jumpState = { jumpConsumed: false, lastJumpHeld: false };
  }
  /** Small deterministic 2px path grid; only the game collision adapter decides passability. */
  pathTo(x: number, y: number): [number, number][] | null {
    const snap = (v: number) => Math.round(v / 2) * 2;
    const start: [number, number] = [snap(this.player.position.wx), snap(this.player.position.wy)];
    let target: [number, number] = [snap(x), snap(y)];
    // Waypoint following may turn within one physics step of a grid node. Keep a
    // 1px margin so a legal exact-edge path cannot clip an odd-width prop corner.
    const clear = (x: number, y: number) =>
      [-1, 1].every((dx) => [-1, 1].every((dy) => this.canStand(x + dx, y + dy)));
    if (!clear(...start)) return null;
    if (!clear(...target)) {
      // A nearby item can touch an orbit target (e.g. the stool in front of a
      // table). Choose the nearest clear 2px node, without moving the player.
      const candidates: [number, number][] = [];
      for (let dx = -4; dx <= 4; dx += 2)
        for (let dy = -4; dy <= 4; dy += 2) candidates.push([target[0] + dx, target[1] + dy]);
      const nearby = candidates
        .sort(
          (a, b) =>
            Math.hypot(a[0] - target[0], a[1] - target[1]) -
            Math.hypot(b[0] - target[0], b[1] - target[1]),
        )
        .find((p) => clear(...p));
      if (!nearby) return null;
      target = nearby;
    }
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
        if (!parents.has(key(next)) && clear(...next)) {
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
