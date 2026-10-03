import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";
import { WORLD_COLLECTIONS } from "./RecordPersistenceStore.js";

interface Container {
  store: PersistenceStore;
  owners: number;
  opening: Promise<void>;
  closing: Promise<void> | undefined;
}

/** One physical writer/coordinator per world; realms only add record namespaces. */
export class WorldStorePool {
  private containers = new Map<string, Container>();
  constructor(private readonly create: (worldId: string) => PersistenceStore) {}

  realm(id: string, worldId = id): RealmStore {
    return new RealmStore(this, worldId, worldId === id ? "" : id);
  }
  get openWorlds(): number {
    return this.containers.size;
  }

  async acquire(id: string): Promise<Container> {
    let container = this.containers.get(id);
    if (container?.closing) {
      await container.closing;
      return this.acquire(id);
    }
    if (!container) {
      const store = this.create(id);
      container = { store, owners: 0, opening: store.open(), closing: undefined };
      this.containers.set(id, container);
    }
    container.owners++;
    try {
      await container.opening;
      return container;
    } catch (error) {
      if (!--container.owners) this.containers.delete(id);
      throw error;
    }
  }
  async release(id: string, container: Container): Promise<void> {
    if (--container.owners) return;
    const closing = Promise.resolve().then(() => container.store.close());
    container.closing = closing;
    try {
      await closing;
      if (this.containers.get(id) === container) this.containers.delete(id);
    } catch (error) {
      container.owners++;
      throw error;
    } finally {
      container.closing = undefined;
    }
  }
}

/** A lease, not a second database or coordinator. Same code on every host. */
export class RealmStore implements PersistenceStore {
  private container: Container | undefined;
  private opening: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  constructor(
    private readonly pool: WorldStorePool,
    readonly worldId: string,
    readonly realmId: string,
  ) {}

  private collection(name: string): string {
    return this.realmId ? JSON.stringify([this.realmId, name]) : name;
  }
  get health() {
    return this.physical.health;
  }
  get physical(): PersistenceStore {
    if (!this.container) throw new Error("Realm store is not open.");
    return this.container.store;
  }
  encode(entries: readonly SaveEntry[]): SaveEntry[] {
    return entries.map((entry) => ({ ...entry, collection: this.collection(entry.collection) }));
  }
  async open(): Promise<void> {
    if (this.closing) await this.closing;
    if (this.container) return;
    this.opening ??= this.pool.acquire(this.worldId).then((container) => {
      this.container = container;
    });
    try {
      await this.opening;
    } finally {
      this.opening = undefined;
    }
  }
  close(): Promise<void> {
    this.closing ??= this.release().finally(() => {
      this.closing = undefined;
    });
    return this.closing;
  }
  private async release(): Promise<void> {
    if (this.opening) await this.opening;
    const container = this.container;
    if (!container) return;
    await this.pool.release(this.worldId, container);
    if (this.container === container) this.container = undefined;
  }
  async readScope(
    collection: string,
    scope: string,
    maximum?: number,
  ): Promise<Map<string, unknown>> {
    return this.physical.readScope(this.collection(collection), scope, maximum);
  }
  async get(collection: string, key: string): Promise<unknown> {
    return this.physical.get(this.collection(collection), key);
  }
  async scan(
    collection: string,
    scope: string | undefined,
    after?: string,
    limit?: number,
  ): Promise<Map<string, unknown>> {
    return this.physical.scan(this.collection(collection), scope, after, limit);
  }
  async getAll(collection: string): Promise<Map<string, unknown>> {
    return this.physical.getAll(this.collection(collection));
  }
  async save(entries: SaveEntry[]): Promise<void> {
    await this.physical.save(this.encode(entries));
  }
  async clear(): Promise<void> {
    for (const collection of WORLD_COLLECTIONS)
      for (;;) {
        const page = await this.scan(collection, undefined);
        if (!page.size) break;
        await this.save(
          [...page.keys()].map((key) => ({ collection, key, value: undefined, deleted: true })),
        );
      }
  }
}
