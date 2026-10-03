import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import {
  applyPatternEdit,
  type PatternDocument,
  type PatternEdit,
  parsePatternDocument,
  roomSketch,
} from "../patterns/PatternDocument.js";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { buildingDoors } from "./BuildingDoors.js";
import type { FurnitureRect } from "./FurnitureCatalog.js";
import { compileFurniture } from "./FurnitureLayout.js";
import {
  furnitureAsset,
  INTERIOR_FLOOR,
  type InteriorIdentity,
  interiorPlan,
  interiorWalls,
} from "./GameplayInterior.js";

export interface GameplayRoomState {
  version: 1;
  revision: number;
  document: PatternDocument;
}
export interface RoomEditStatus {
  error: string;
  canUndo: boolean;
  canRedo: boolean;
  revision: number;
}
export function initialRoom(identity: InteriorIdentity): GameplayRoomState {
  const plan = interiorPlan(identity).plan;
  return {
    version: 1,
    revision: 0,
    document: {
      version: 1,
      family: "rooms-v1",
      width: 24,
      height: 16,
      cells: plan.rows.flatMap((row, y) =>
        row.flatMap((value, x) => (value === " " ? [] : [{ x, y, value }])),
      ),
    },
  };
}
export function parseGameplayRoom(input: unknown): GameplayRoomState {
  const value = input as GameplayRoomState;
  if (value?.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0)
    throw new Error("Unsupported saved room plan");
  const document = parsePatternDocument(value.document);
  if (document.family !== "rooms-v1") throw new Error("Expected a room plan");
  return { version: 1, revision: value.revision, document };
}

/** The production compiler owns floor strips, shifted rails and door jambs.
 * Derive traversable ground from its floor layer, rather than a second wall solver.
 * The complement is compacted into collision rectangles, including voids. */
export function compileGameplayRoom(identity: InteriorIdentity, state: GameplayRoomState) {
  const original = initialRoom(identity);
  const legacy =
    !identity.layout && JSON.stringify(state.document) === JSON.stringify(original.document);
  const plan = legacy
    ? interiorPlan(identity).plan
    : parseFloorPlan(roomSketch(state.document), { preserveBounds: true, allowUnreachable: true });
  const doors = buildingDoors(identity);
  const entrances = identity.layout
    ? doors.map((door) => ({
        x: Math.floor(door.inside.wx / 32),
        y: Math.floor(door.inside.wy / 32),
      }))
    : [{ x: 2, y: 4 }];
  for (const { x, y } of entrances)
    if (plan.rows[y]?.[x] !== "+" || !"LBKTH".includes(plan.rows[y - 1]?.[x] ?? "!"))
      throw new Error(`Keep the street doorway and its entrance floor at ${x},${y}`);
  if (plan.entrances.some((p) => !entrances.some((e) => e.x === p.x && e.y === p.y)))
    throw new Error(
      "Only connected street doorways may open onto the void. Interior doors must connect two rooms.",
    );
  const map = buildLayeredApartmentPlan(plan);
  const width = state.document.width * 32,
    height = state.document.height * 32;
  const mask = new Uint8Array(width * height);
  const fill = (rect: FurnitureRect, value: number) => {
    const left = Math.max(0, Math.floor(rect.x)),
      right = Math.min(width, Math.ceil(rect.x + rect.width));
    for (
      let y = Math.max(0, Math.floor(rect.y));
      y < Math.min(height, Math.ceil(rect.y + rect.height));
      y++
    )
      mask.fill(value, y * width + left, y * width + right);
  };
  if (legacy) {
    fill(INTERIOR_FLOOR, 1);
    fill({ x: 64, y: 128, width: 32, height: 32 }, 1);
  } else {
    map.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        for (const tile of cell.floor) {
          // The apartment compiler emits native 16px floor tiles. Collision
          // must also compile on the headless server without an image/index load.
          fill(
            {
              x: x * 16 + (tile.cropX ?? 0) + (tile.offsetX ?? 0),
              y: y * 16 + (tile.offsetY ?? 0),
              width: tile.drawWidth ?? tile.cropWidth ?? 16 - (tile.cropX ?? 0),
              height: tile.cropHeight ?? 16,
            },
            1,
          );
        }
        // Internal horizontal doors have a one-tile jamb; the original street
        // threshold deliberately retains the legacy 32px passage.
        if (
          cell.semantic === "wall" &&
          plan.rows[Math.floor(y / 2)]?.[Math.floor(x / 2)] === "+" &&
          !(!identity.layout && Math.floor(x / 2) === 2 && Math.floor(y / 2) === 4)
        )
          fill({ x: x * 16, y: y * 16, width: 16, height: 16 }, 0);
      });
    });
  }
  const onFloor = (r: FurnitureRect) => {
    if (r.x < 0 || r.y < 0 || r.x + r.width > width || r.y + r.height > height) return false;
    for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.height); y++)
      for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.width); x++)
        if (!mask[y * width + x]) return false;
    return true;
  };
  // Furniture stays clear of all passage cells, even where ground is walkable.
  const furnitureFloor = (r: FurnitureRect) =>
    onFloor(r) &&
    !state.document.cells.some(
      (c) =>
        c.value === "+" &&
        aabbsOverlap(
          { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height },
          { left: c.x * 32, top: c.y * 32, right: (c.x + 1) * 32, bottom: (c.y + 1) * 32 },
        ),
    );
  const walls: PropCollider[] = [];
  const rect = (x: number, y: number, w: number, h: number): PropCollider => ({
    offsetX: x + w / 2,
    offsetY: y + h,
    width: w,
    height: h,
    zHeight: 64,
  });
  if (legacy) walls.push(...interiorWalls());
  else {
    let active = new Map<string, PropCollider>();
    for (let y = 0; y < height; y++) {
      const next = new Map<string, PropCollider>();
      for (let x = 0; x < width; ) {
        if (mask[y * width + x]) {
          x++;
          continue;
        }
        const start = x;
        while (x < width && !mask[y * width + x]) x++;
        const key = `${start}:${x}`,
          prior = active.get(key);
        const wall = prior ?? rect(start, y, x - start, 0);
        wall.height++;
        wall.offsetY = y + 1;
        if (!prior) walls.push(wall);
        next.set(key, wall);
      }
      active = next;
    }
    walls.push(
      rect(-32, -32, width + 64, 32),
      rect(-32, height, width + 64, 32),
      rect(-32, 0, 32, height),
      rect(width, 0, 32, height),
    );
  }
  return {
    plan,
    map,
    walls,
    legacy,
    onFloor,
    furnitureFloor,
    width,
    height,
    doors: buildingDoors(identity),
  };
}

/** Reconcile against live furniture and every resident, before any mutation. */
export function validateRoomOccupancy(
  room: ReturnType<typeof compileGameplayRoom>,
  props: readonly Prop[],
  players: readonly Entity[],
) {
  compileFurniture(
    room.plan,
    props.flatMap((p) => {
      const asset = furnitureAsset(p.type);
      return asset ? [{ id: `furniture-${p.id}`, asset, x: p.position.wx, y: p.position.wy }] : [];
    }),
    room.furnitureFloor,
  );
  const obstacles = props.flatMap((p) =>
    furnitureAsset(p.type) && p.collider && !p.collider.walkableTop
      ? [getEntityAABB(p.position, p.collider)]
      : [],
  );
  const clear = (wx: number, wy: number, collider: NonNullable<Entity["collider"]>) => {
    const a = getEntityAABB({ wx, wy }, collider);
    return (
      room.onFloor({ x: a.left, y: a.top, width: a.right - a.left, height: a.bottom - a.top }) &&
      !obstacles.some((o) => aabbsOverlap(a, o))
    );
  };
  const anchors = room.doors.map((door) => ({
    position: door.arrival,
    collider: { offsetX: 0, offsetY: 0, width: 10, height: 6 },
  }));
  for (const player of [...players, ...anchors]) {
    const collider = player.collider;
    if (!collider) continue;
    if (!clear(player.position.wx, player.position.wy, collider))
      throw new Error("Room edit overlaps a player. Move clear of the changed area first.");
    // A four-pixel navigation grid checks the actual footprint, not just room labels.
    const step = 4,
      cols = room.width / step,
      rows = room.height / step;
    const seen = new Uint8Array(cols * rows),
      queue: number[] = [];
    const startX = Math.round(player.position.wx / step),
      startY = Math.round(player.position.wy / step);
    const start = startY * cols + startX;
    if (startX < 0 || startX >= cols || startY < 0 || startY >= rows)
      throw new Error("Player is outside the editable room");
    if (!clear(startX * step, startY * step, collider))
      throw new Error("Move the player away from the wall before editing");
    queue.push(start);
    seen[start] = 1;
    let reached = false;
    const reachedDoors = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i] as number,
        x = id % cols,
        y = Math.floor(id / cols);
      for (const door of room.doors)
        if (Math.hypot(x * step - door.inside.wx, y * step - door.inside.wy) <= step)
          reachedDoors.add(door.id);
      if (room.doors.every((door) => reachedDoors.has(door.id))) {
        reached = true;
        break;
      }
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nx = x + (dx ?? 0),
          ny = y + (dy ?? 0),
          next = ny * cols + nx;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || seen[next]) continue;
        if (clear(nx * step, ny * step, collider)) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (!reached) throw new Error("Room edit would block a player's route to the street doorway");
  }
  // Preserve a usable arrival even with no residents (e.g. loading a saved realm).
  for (const door of room.doors) {
    for (const point of [door.arrival, door.inside]) {
      const footprint = {
        left: point.wx - 5,
        top: point.wy - 6,
        right: point.wx + 5,
        bottom: point.wy,
      };
      if (
        !room.onFloor({ x: footprint.left, y: footprint.top, width: 10, height: 6 }) ||
        obstacles.some((obstacle) => aabbsOverlap(footprint, obstacle))
      )
        throw new Error("Keep the entrance landing clear");
    }
  }
}

export class GameplayRoomEditor {
  private histories = new Map<
    string,
    {
      past: { before: PatternDocument; after: PatternDocument }[];
      future: { before: PatternDocument; after: PatternDocument }[];
    }
  >();
  constructor(
    public state: GameplayRoomState,
    private readonly commit: (state: GameplayRoomState) => void,
  ) {}
  forget(client: string) {
    this.histories.delete(client);
  }
  private history(client: string) {
    const h = this.histories.get(client) ?? { past: [], future: [] };
    this.histories.set(client, h);
    return h;
  }
  status(client: string, error = ""): RoomEditStatus {
    const h = this.history(client);
    return {
      error,
      canUndo: h.past.length > 0,
      canRedo: h.future.length > 0,
      revision: this.state.revision,
    };
  }
  edit(client: string, expectedRevision: number, edit: PatternEdit): RoomEditStatus {
    return this.attempt(client, () => {
      if (expectedRevision !== this.state.revision)
        throw new Error("Room changed during your stroke. Review it and try again.");
      if (
        !edit ||
        typeof edit.erase !== "boolean" ||
        (edit.shape !== "free" && edit.shape !== "rectangle") ||
        (edit.roomRectangle !== undefined && typeof edit.roomRectangle !== "boolean")
      )
        throw new Error("Invalid room brush");
      const before = this.state.document,
        after = applyPatternEdit(before, edit);
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      this.replace(after);
      const h = this.history(client);
      h.past.push({ before, after });
      if (h.past.length > 50) h.past.shift();
      h.future = [];
    });
  }
  travel(client: string, expectedRevision: number, direction: "undo" | "redo"): RoomEditStatus {
    return this.attempt(client, () => {
      if (expectedRevision !== this.state.revision)
        throw new Error("Room changed. Try the history action again.");
      if (direction !== "undo" && direction !== "redo")
        throw new Error("Invalid history operation");
      const h = this.history(client),
        from = direction === "undo" ? h.past : h.future,
        to = direction === "undo" ? h.future : h.past,
        change = from.at(-1);
      if (!change) return;
      if (
        JSON.stringify(this.state.document) !==
        JSON.stringify(direction === "undo" ? change.after : change.before)
      )
        throw new Error("Room changed since your stroke. Undo would overwrite another edit.");
      this.replace(direction === "undo" ? change.before : change.after);
      from.pop();
      to.push(change);
    });
  }
  private replace(document: PatternDocument) {
    const next: GameplayRoomState = { version: 1, revision: this.state.revision + 1, document };
    this.commit(next);
    this.state = next;
  }
  private attempt(client: string, action: () => void): RoomEditStatus {
    try {
      action();
      return this.status(client);
    } catch (e) {
      return this.status(client, e instanceof Error ? e.message : String(e));
    }
  }
}
