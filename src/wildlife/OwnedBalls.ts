import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { type ActorRecord, durableId } from "../persistence/ActorRecords.js";
import type { SaveManager } from "../persistence/SaveManager.js";

export const BALL_LIMIT = 10;
const SCOPE = "owned-balls";
interface Toy {
  id: string;
  order: number;
  held: boolean;
}
/** Small realm-wide index counts toys even when their actor scopes are unloaded. */
export class OwnedBalls {
  private owners = new Map<string, { next: number; toys: Toy[] }>();
  constructor(
    private manager: EntityManager,
    private saves?: SaveManager,
  ) {
    manager.removalListeners.add((ball, destroyed) => {
      if (!destroyed || !ball.workItem?.owner || ball.type !== "ball") return;
      const owner = ball.workItem.owner,
        state = this.owners.get(owner);
      if (!state) return;
      state.toys = state.toys.filter((t) => t.id !== ball.persistentId);
      this.changed(owner);
    });
  }
  async load() {
    for (const [key, value] of (await this.saves?.loadRecords("meta", SCOPE)) ?? []) {
      const owner = key.slice("owned-balls:".length);
      const state = value as { next: number; toys: Toy[] };
      if (
        !key.startsWith("owned-balls:") ||
        !owner ||
        !Number.isSafeInteger(state.next) ||
        state.next < 1 ||
        !Array.isArray(state.toys) ||
        state.toys.length > BALL_LIMIT ||
        state.toys.some((t) => !t.id || !Number.isSafeInteger(t.order))
      )
        throw Error("Invalid saved toy inventory");
      this.owners.set(owner, state);
    }
  }
  private changed(owner: string) {
    this.saves?.markRecordDirty("meta", `owned-balls:${owner}`, () => ({
      collection: "meta",
      key: `owned-balls:${owner}`,
      scope: SCOPE,
      value: structuredClone(this.owners.get(owner)),
    }));
  }
  accepts(record: ActorRecord) {
    const item = record.state.workItem;
    return (
      record.type !== "ball" ||
      !item?.owner ||
      item.ballOrder === undefined ||
      !!this.owners
        .get(item.owner)
        ?.toys.some((t) => t.id === record.persistentId && t.order === item.ballOrder)
    );
  }
  sync(active: readonly Entity[]) {
    for (const ball of active) {
      const owner = ball.workItem?.owner;
      if (ball.type !== "ball" || !owner) continue;
      delete ball.deathTimer;
      if (ball.workItem?.ballOrder === undefined) this.admit(owner, ball);
      const toy = this.owners.get(owner)?.toys.find((t) => t.id === ball.persistentId);
      if (toy && toy.held !== (ball.parentId !== undefined)) {
        toy.held = ball.parentId !== undefined;
        this.changed(owner);
      }
    }
  }
  /** Reusing a returned ball does not change its original age or owner. */
  admit(owner: string, ball: Entity): boolean {
    const state = this.owners.get(owner) ?? { next: 1, toys: [] };
    this.owners.set(owner, state);
    const id = durableId(ball);
    if (state.toys.some((t) => t.id === id)) return true;
    if (state.toys.length >= BALL_LIMIT) {
      const oldest = state.toys
        .filter((t) => {
          const loaded = this.manager.entities.find((e) => e.persistentId === t.id);
          return loaded ? loaded.parentId === undefined : !t.held;
        })
        .sort((a, b) => a.order - b.order)[0];
      if (!oldest) return false;
      const loaded = this.manager.entities.find((e) => e.persistentId === oldest.id);
      if (loaded) this.manager.remove(loaded.id);
      else
        this.saves?.markRecordDirty("entities", oldest.id, () => ({
          collection: "entities",
          key: oldest.id,
          deleted: true,
          value: undefined,
        }));
      state.toys = state.toys.filter((t) => t.id !== oldest.id);
    }
    if (ball.workItem) ball.workItem.ballOrder = state.next;
    state.toys.push({ id, order: state.next++, held: false });
    this.changed(owner);
    return true;
  }
}
