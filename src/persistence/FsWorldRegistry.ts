import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  descriptorFromMetadata,
  type GenerationRequest,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import type { RoadGenParams } from "../generation/RoadGenerator.js";
import { containedPath, worldDirectory } from "./fsPaths.js";
import type { IWorldRegistry, WorldMeta, WorldType } from "./IWorldRegistry.js";
import { SAVE_FORMAT } from "./SaveFormat.js";

/**
 * Filesystem implementation of IWorldRegistry for Node.js.
 * Stores world metadata as a JSON array in {dataDir}/registry.json.
 */
export class FsWorldRegistry implements IWorldRegistry {
  private readonly registryPath: string;
  private worlds: WorldMeta[] = [];
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.registryPath = containedPath(dataDir, "registry.json");
  }

  async open(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });
    try {
      const data = await readFile(containedPath(this.dataDir, "registry.json"), "utf-8");
      this.worlds = JSON.parse(data) as WorldMeta[];
    } catch {
      this.worlds = [];
    }
  }

  close(): void {
    // No-op
  }

  async listWorlds(): Promise<WorldMeta[]> {
    return [...this.worlds].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  async getWorld(id: string): Promise<WorldMeta | undefined> {
    return this.worlds.find((w) => w.id === id);
  }

  async createWorld(
    name: string,
    worldType: WorldType = "generated",
    seed?: number,
    roadParams?: RoadGenParams,
    generation?: GenerationRequest,
  ): Promise<WorldMeta> {
    const resolved = generation
      ? resolveCreation(generation)
      : descriptorFromMetadata({
          worldType,
          seed: seed ?? Math.floor(Math.random() * 2147483647),
          ...(roadParams ? { roadParams } : {}),
        });
    const now = Date.now();
    const meta: WorldMeta = {
      saveFormat: SAVE_FORMAT,
      id: randomUUID(),
      name,
      createdAt: now,
      lastPlayedAt: now,
      generation: resolved,
    };
    this.worlds.push(meta);
    await this.persist();
    return meta;
  }

  async updateLastPlayed(id: string): Promise<void> {
    const meta = this.worlds.find((w) => w.id === id);
    if (meta) {
      meta.lastPlayedAt = Date.now();
      await this.persist();
    }
  }

  async renameWorld(id: string, name: string): Promise<void> {
    const meta = this.worlds.find((w) => w.id === id);
    if (meta) {
      meta.name = name;
      await this.persist();
    }
  }

  async deleteWorld(id: string): Promise<void> {
    const worldDir = worldDirectory(this.dataDir, id);
    if (!this.worlds.some((world) => world.id === id)) throw new Error("World not found.");
    const worldsDir = containedPath(this.dataDir, "worlds");
    const interiors = existsSync(worldsDir)
      ? readdirSync(worldsDir)
          .filter((name) => name.startsWith(`interior~${id}~`))
          .map((name) => worldDirectory(this.dataDir, name))
      : [];
    this.worlds = this.worlds.filter((w) => w.id !== id);
    await this.persist();
    for (const directory of interiors) rmSync(directory, { recursive: true, force: true });
    // Remove the world's data directory
    if (existsSync(worldDir)) {
      rmSync(worldDir, { recursive: true });
    }
  }

  /** Atomically write registry to disk (write .tmp, rename). */
  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.worlds, null, 2);
    const write = this.writes
      .catch(() => {})
      .then(async () => {
        const tmpPath = containedPath(this.dataDir, "registry.json.tmp");
        await writeFile(tmpPath, snapshot);
        renameSync(tmpPath, this.registryPath);
      });
    this.writes = write;
    await write;
  }
}
