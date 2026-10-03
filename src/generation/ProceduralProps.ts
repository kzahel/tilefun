import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Prop } from "../entities/Prop.js";
import { createProp } from "../entities/PropFactories.js";
import type { PropManager } from "../entities/PropManager.js";
import type { InspectionState, SerializedEntity } from "../persistence/SaveManager.js";
import type { WorldGenerator } from "./Generator.js";

/** Durable edits are separate from disposable generated residency. */
export class ProceduralProps {
  managed = false;
  readonly deleted = new Set<string>();
  readonly edits = new Map<string, SerializedEntity>();
  private processed = new Set<string>();
  constructor(
    private readonly manager: PropManager,
    private readonly dirty: () => void,
  ) {
    manager.onEdit = (prop, deleted) => {
      if (prop.proceduralId) {
        if (deleted) {
          this.deleted.add(prop.proceduralId);
          this.edits.delete(prop.proceduralId);
        } else
          this.edits.set(prop.proceduralId, {
            type: prop.type,
            wx: prop.position.wx,
            wy: prop.position.wy,
            proceduralId: prop.proceduralId,
          });
      }
      this.dirty();
    };
  }
  restore(meta: InspectionState): void {
    for (const id of meta.deletedProceduralIds ?? []) this.deleted.add(id);
    for (const edit of meta.proceduralEdits ?? [])
      if (edit.proceduralId) this.edits.set(edit.proceduralId, edit);
  }
  reconcile(generator: WorldGenerator, keys: Iterable<string>): void {
    const loaded = new Set(keys);
    const visible = (prop: Prop) => {
      const minCx = Math.floor((prop.position.wx - prop.sprite.spriteWidth / 2) / CHUNK_SIZE_PX);
      const maxCx = Math.floor((prop.position.wx + prop.sprite.spriteWidth / 2) / CHUNK_SIZE_PX);
      const minCy = Math.floor((prop.position.wy - prop.sprite.spriteHeight) / CHUNK_SIZE_PX);
      const maxCy = Math.floor((prop.position.wy + 16) / CHUNK_SIZE_PX);
      for (let cy = minCy; cy <= maxCy; cy++)
        for (let cx = minCx; cx <= maxCx; cx++) if (loaded.has(`${cx},${cy}`)) return true;
      return false;
    };
    for (const prop of [...this.manager.props])
      if (!this.managed && prop.proceduralId && !visible(prop)) this.manager.remove(prop.id, false);
    const active = new Set(this.manager.props.map((prop) => prop.proceduralId));
    for (const key of this.processed)
      if (!this.managed && !loaded.has(key)) this.processed.delete(key);
    for (const key of loaded) {
      if (this.processed.has(key)) continue;
      const [cx = 0, cy = 0] = key.split(",").map(Number);
      for (const placement of generator.placements(cx, cy, new Set()).placements) {
        if (
          this.managed &&
          (Math.floor(placement.wx / CHUNK_SIZE_PX) !== cx ||
            Math.floor(placement.wy / CHUNK_SIZE_PX) !== cy)
        )
          continue;
        const id = placement.featureId;
        if (!id || this.deleted.has(id) || this.edits.has(id) || active.has(id)) continue;
        const prop = createProp(placement.propType, placement.wx, placement.wy);
        prop.proceduralId = id;
        this.manager.add(prop);
        active.add(id);
      }
      this.processed.add(key);
    }
    if (this.managed) return;
    for (const [id, edit] of this.edits) {
      if (active.has(id) || this.deleted.has(id)) continue;
      const prop = createProp(edit.type, edit.wx, edit.wy);
      prop.proceduralId = id;
      if (visible(prop)) {
        this.manager.add(prop);
        active.add(id);
      }
    }
  }
  forget(key: string): void {
    this.processed.delete(key);
  }
  save(): Pick<InspectionState, "deletedProceduralIds" | "proceduralEdits"> {
    return {
      deletedProceduralIds: [...this.deleted].sort(),
      proceduralEdits: [...this.edits.values()].sort((a, b) =>
        (a.proceduralId ?? "").localeCompare(b.proceduralId ?? ""),
      ),
    };
  }
}
