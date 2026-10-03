import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import type { FloorPlan } from "./ApartmentFloorPlan.js";
import type { FurniturePlacement, FurnitureRect } from "./FurnitureCatalog.js";
import {
  compileFurniture,
  furnishedSceneOrder,
  type PlacedFurniture,
  prepareFurnishedInterior,
} from "./FurnitureLayout.js";
import type { LayeredInteriorMap } from "./LayeredInteriorMap.js";

let nextInteriorContent = 1;
/** Immutable compiled room geometry. Preparing it does not advance gameplay. */
export interface InteriorContent {
  readonly id: number;
  readonly map: LayeredInteriorMap;
  readonly editable: boolean;
}
export interface InteriorSceneDraw {
  kind: "scene";
  item: SceneItem | null;
  shadow: boolean;
  offsetY: number;
}
export type InteriorDraw =
  | { kind: "layer"; layer: "floor" | "walls" }
  | { kind: "wall-band"; row: number; y: number }
  | {
      kind: "furniture";
      src: readonly [number, number, number, number];
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | InteriorSceneDraw;
interface Actor {
  id: string;
  depth: number;
  commands: InteriorDraw[];
}
interface DynamicActor extends Actor {
  body: InteriorSceneDraw;
  shadow: InteriorSceneDraw;
}

/** Pure ordering/layout cache. Dynamic outputs are borrowed until release. */
export class InteriorPresentation {
  readonly content: InteriorContent;
  readonly draws: InteriorDraw[] = [];
  private readonly walls: Actor[] = [];
  private readonly actorPool: DynamicActor[] = [];
  private readonly actors: Actor[] = [];
  private readonly floorDraw: InteriorDraw = { kind: "layer", layer: "floor" };
  private readonly wallsDraw: InteriorDraw = { kind: "layer", layer: "walls" };
  private placementKey: string | null = null;
  private objects: PlacedFurniture[] = [];
  private readonly furnitureDraws = new Map<PlacedFurniture, InteriorDraw>();

  constructor(
    map: LayeredInteriorMap,
    private readonly plan: FloorPlan,
    private readonly floorBounds?: FurnitureRect | ((rect: FurnitureRect) => boolean),
    editable = false,
  ) {
    this.content = Object.freeze({ id: nextInteriorContent++, map, editable });
    if (editable)
      for (let y = 0; y < map.height; y += 2) {
        if (
          !map.cells
            .slice(y, y + 2)
            .some((r) => r.some((c) => c.wall.length || c.foreground.length || c.objects.length))
        )
          continue;
        this.walls.push({
          id: `room-wall:${y}`,
          depth: y * 16 + 32,
          commands: [{ kind: "wall-band", row: y, y: y * 16 - 16 + (map.contentOffsetY ?? 0) }],
        });
      }
  }

  collect(
    placements: readonly FurniturePlacement[],
    items: readonly SceneItem[],
    identities?: readonly { id: string; depth: number }[],
  ): readonly InteriorDraw[] {
    this.release();
    const { map, editable } = this.content;
    const offsetY = map.contentOffsetY ?? 0;
    const key = JSON.stringify(placements);
    if (key !== this.placementKey) {
      this.objects = editable
        ? compileFurniture(this.plan, placements, this.floorBounds)
        : prepareFurnishedInterior(
            map,
            this.plan,
            placements,
            typeof this.floorBounds === "function" ? undefined : this.floorBounds,
          );
      this.furnitureDraws.clear();
      for (const o of this.objects) {
        const entry = getModernInteriorsEntry(o.definition.key);
        if (
          !entry ||
          entry.rect[2] !== o.definition.size[0] ||
          entry.rect[3] !== o.definition.size[1]
        )
          throw Error(`Invalid furniture sprite: ${o.definition.id}`);
        this.furnitureDraws.set(o, {
          kind: "furniture",
          src: entry.rect,
          x: o.origin[0],
          y: o.origin[1] + offsetY,
          width: o.definition.size[0],
          height: o.definition.size[1],
        });
      }
      this.placementKey = key;
    }
    this.actors.push(...this.walls);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      let actor = this.actorPool[i];
      if (!actor) {
        const body: InteriorSceneDraw = { kind: "scene", item: null, shadow: false, offsetY };
        const shadow: InteriorSceneDraw = { kind: "scene", item: null, shadow: true, offsetY };
        actor = { id: `actor:${i}`, depth: 0, commands: [], body, shadow };
        if (i < 4096) this.actorPool.push(actor);
      }
      actor.id = identities?.[i]?.id ?? `actor:${i}`;
      actor.depth = identities?.[i]?.depth ?? item.sortKey;
      actor.body.item = item;
      actor.shadow.item = item;
      actor.commands.length = 0;
      if (item.kind === "sprite" && item.hasShadow && !item.flashHidden)
        actor.commands.push(actor.shadow);
      actor.commands.push(actor.body);
      this.actors.push(actor);
    }
    this.draws.push(this.floorDraw);
    for (const o of this.objects)
      if (o.definition.layer === "floor") {
        const d = this.furnitureDraws.get(o);
        if (d) this.draws.push(d);
      }
    this.draws.push(this.wallsDraw);
    for (const entry of furnishedSceneOrder(this.objects, this.actors)) {
      if ("commands" in entry) this.draws.push(...entry.commands);
      else if (entry.definition.layer !== "floor") {
        const d = this.furnitureDraws.get(entry);
        if (d) this.draws.push(d);
      }
    }
    return this.draws;
  }

  release(): void {
    this.draws.length = 0;
    for (const actor of this.actors)
      if ("body" in actor) {
        const dynamic = actor as DynamicActor;
        dynamic.body.item = null;
        dynamic.shadow.item = null;
        dynamic.commands.length = 0;
      }
    this.actors.length = 0;
  }
  clear(): void {
    this.release();
    this.actorPool.length = 0;
    this.objects = [];
    this.furnitureDraws.clear();
    this.placementKey = null;
  }
}
