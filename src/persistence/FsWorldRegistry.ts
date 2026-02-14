import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RoadGenParams } from "../generation/RoadGenerator.js";
import type { IWorldRegistry, WorldMeta, WorldType } from "./IWorldRegistry.js";

/**
 * Filesystem implementation of IWorldRegistry for Node.js.
 * Stores world metadata as a JSON array in {dataDir}/registry.json.
 */
export class FsWorldRegistry implements IWorldRegistry {
  private readonly registryPath: string;
  private worlds: WorldMeta[] = [];

  constructor(private readonly dataDir: string) {
    this.registryPath = join(dataDir, "registry.json");
  }

  async open(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });
    try {
      const data = await readFile(this.registryPath, "utf-8");
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
  ): Promise<WorldMeta> {
    const now = Date.now();
    const meta: WorldMeta = {
      id: randomUUID(),
      name,
      createdAt: now,
      lastPlayedAt: now,
      seed: seed ?? Math.floor(Math.random() * 2147483647),
      worldType,
    };
    if (roadParams) meta.roadParams = roadParams;
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
    this.worlds = this.worlds.filter((w) => w.id !== id);
    await this.persist();
    // Remove the world's data directory
    const worldDir = join(this.dataDir, "worlds", id);
    if (existsSync(worldDir)) {
      rmSync(worldDir, { recursive: true });
    }
  }

  /** Atomically write registry to disk (write .tmp, rename). */
  private async persist(): Promise<void> {
    const tmpPath = `${this.registryPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(this.worlds, null, 2));
    renameSync(tmpPath, this.registryPath);
  }
}
