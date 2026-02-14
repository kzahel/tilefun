import type { RoadGenParams } from "../generation/RoadGenerator.js";

export type WorldType = "generated" | "flat" | "island";

export interface WorldMeta {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  /** Noise seed for generated worlds. Missing = 42 (back-compat). */
  seed?: number;
  /** World generation type. Missing = "generated" (back-compat). */
  worldType?: WorldType;
  /** Road generation parameters. Missing = no generated roads (back-compat). */
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
  ): Promise<WorldMeta>;
  updateLastPlayed(id: string): Promise<void>;
  renameWorld(id: string, name: string): Promise<void>;
  deleteWorld(id: string): Promise<void>;
}
