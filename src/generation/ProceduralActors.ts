import { CHUNK_SIZE_PX } from "../config/constants.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { WorldGenerator } from "./Generator.js";

/** Generated actors are bounded residency; tombstones share stable feature identity with props. */
export class ProceduralActors {
  persistent = false;
  canGenerate: (id: string) => boolean = () => true;
  constructor(
    private manager: EntityManager,
    private deleted: Set<string>,
    private dirty: () => void,
  ) {
    manager.onRemove = (entity) => {
      if (entity.proceduralId) {
        this.deleted.add(entity.proceduralId);
        this.dirty();
      }
    };
  }
  reconcile(generator: WorldGenerator, keys: Iterable<string>): void {
    if (!generator.actors) return;
    const loaded = new Set(keys);
    for (const entity of [...this.manager.entities])
      if (!this.persistent && entity.proceduralId && entity.routeAI) {
        if (this.manager.entities.some((e) => e.parentId === entity.id)) continue;
        const route = entity.routeAI.points;
        const minCx = Math.floor(Math.min(...route.map((p) => p.wx)) / CHUNK_SIZE_PX),
          maxCx = Math.floor(Math.max(...route.map((p) => p.wx)) / CHUNK_SIZE_PX);
        const minCy = Math.floor(Math.min(...route.map((p) => p.wy)) / CHUNK_SIZE_PX),
          maxCy = Math.floor(Math.max(...route.map((p) => p.wy)) / CHUNK_SIZE_PX);
        let resident = false;
        for (let cy = minCy; cy <= maxCy; cy++)
          for (let cx = minCx; cx <= maxCx; cx++) if (loaded.has(`${cx},${cy}`)) resident = true;
        if (!resident) this.manager.remove(entity.id, false);
      }
    const active = new Set(this.manager.entities.map((e) => e.proceduralId));
    for (const key of loaded) {
      const [cx = 0, cy = 0] = key.split(",").map(Number);
      for (const p of generator.actors(cx, cy)) {
        if (
          this.persistent &&
          (Math.floor(p.wx / CHUNK_SIZE_PX) !== cx || Math.floor(p.wy / CHUNK_SIZE_PX) !== cy)
        )
          continue;
        if (
          active.has(p.featureId) ||
          this.deleted.has(p.featureId) ||
          !this.canGenerate(p.featureId)
        )
          continue;
        const factory = ENTITY_FACTORIES[p.type];
        if (!factory) throw new Error(`Unsupported generated actor: ${p.type}`);
        const entity = factory(p.wx, p.wy);
        entity.proceduralId = p.featureId;
        if (p.mallard) {
          entity.mallard = structuredClone(p.mallard);
          entity.persistentId = p.featureId;
        }
        if (p.route.length)
          entity.routeAI = {
            points: p.route,
            index: 1 % p.route.length,
            pause: 1,
            blocked: 0,
            last: { ...entity.position },
          };
        if (entity.wanderAI) entity.wanderAI.befriendable = false;
        entity.tags?.delete("befriendable");
        this.manager.spawn(entity);
        active.add(p.featureId);
      }
    }
  }
}
