import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { PersistenceStore } from "./PersistenceStore.js";
import type { SavedPlayerData } from "./SaveManager.js";

/** Separate from per-realm visit history: this is where a player currently lives. */
export interface PlayerLocation {
  version: 1;
  realmId: string;
  parentWorldId: string;
  generation: GenerationDescriptor;
  player: SavedPlayerData;
}

export const PLAYER_LOCATIONS_STORE = "__player_locations__";

/** Ordered commits; a failed write does not poison later retries. */
export class PlayerLocationStore {
  private opened: Promise<void> | undefined;
  private failed = false;
  private pending = 0;
  get pressured(): boolean {
    return this.failed || this.pending >= 64;
  }
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly store: PersistenceStore) {}

  private open(): Promise<void> {
    this.opened ??= this.store.open();
    return this.opened;
  }

  async load(id: string): Promise<PlayerLocation | null> {
    await this.open();
    await this.writes;
    const value = (await this.store.get("players", id)) as PlayerLocation | undefined;
    if (!value) return null;
    if (
      value.version !== 1 ||
      typeof value.realmId !== "string" ||
      typeof value.parentWorldId !== "string" ||
      !value.generation ||
      !Number.isFinite(value.player?.x) ||
      !Number.isFinite(value.player?.y)
    )
      return null;
    return value;
  }

  save(id: string, location: PlayerLocation): Promise<void> {
    if (this.pending >= 256) return Promise.reject(new Error("Player location queue is full."));
    const snapshot = structuredClone(location);
    this.pending++;
    const write = this.writes
      .catch(() => {})
      .then(async () => {
        await this.open();
        await this.store.save([{ collection: "players", key: id, value: snapshot }]);
        this.failed = false;
      })
      .catch((error) => {
        this.failed = true;
        throw error;
      })
      .finally(() => {
        this.pending--;
      });
    this.writes = write;
    return write;
  }

  async close(): Promise<void> {
    await this.writes.catch(() => {});
    await this.store.close();
  }
}
