import type {
  GenerationDescriptor,
  GenerationRequest,
} from "../generation/GenerationDescriptor.js";
import type { RoadGenParams } from "../generation/RoadGenerator.js";

export type WorldType = "generated" | "flat" | "island" | "regional";

export interface WorldMeta {
  readonly generation?: GenerationDescriptor;
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  /** Legacy seed field. New worlds use generation; missing legacy seed resolves to 42. */
  seed?: number;
  /** Legacy type field. New worlds use generation; missing legacy type resolves to Classic. */
  worldType?: WorldType;
  /** Legacy road overrides. Realm historically merges missing fields with default roads. */
  roadParams?: RoadGenParams;
}

/**
 * Registry of all worlds. Manages world metadata (create, list, delete, rename).
 * Implementations: WorldRegistry (browser/IDB), FsWorldRegistry (Node.js/filesystem).
 */
export interface IWorldRegistry {
  open(): Promise<void>;
  close(): void;
  listWorlds(): Promise<WorldMeta[]>;
  getWorld(id: string): Promise<WorldMeta | undefined>;
  createWorld(
    name: string,
    worldType?: WorldType,
    seed?: number,
    roadParams?: RoadGenParams,
    generation?: GenerationRequest,
  ): Promise<WorldMeta>;
  updateLastPlayed(id: string): Promise<void>;
  renameWorld(id: string, name: string): Promise<void>;
  deleteWorld(id: string): Promise<void>;
}
