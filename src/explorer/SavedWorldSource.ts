import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import { IdbPersistenceStore } from "../persistence/IdbPersistenceStore.js";
import { type InspectionSnapshot, readInspection } from "../persistence/WorldInspection.js";
import { dbNameForWorld, type WorldMeta, WorldRegistry } from "../persistence/WorldRegistry.js";

/** Saved-world reads use the authority selected in the explorer URL. */
export class SavedWorldSource {
  readonly serverAddress: string | null;
  private readonly origin: string;

  constructor(location: string) {
    const url = new URL(location);
    this.serverAddress = url.searchParams.get("server");
    this.origin = this.serverAddress
      ? `${url.protocol}//${this.serverAddress.replace(/\/ws$/, "")}`
      : url.origin;
  }

  async listWorlds(): Promise<WorldMeta[]> {
    if (this.serverAddress) {
      const response = await fetch(new URL("/api/world-list", this.origin));
      if (!response.ok) throw new Error("Server world list unavailable.");
      return response.json();
    }
    const registry = new WorldRegistry();
    try {
      await registry.open();
      return await registry.listWorlds();
    } finally {
      registry.close();
    }
  }

  async snapshot(
    worldId: string,
    generation: GenerationDescriptor,
    coordinates: { cx: number; cy: number }[],
    bounds: Bounds,
  ): Promise<InspectionSnapshot> {
    if (this.serverAddress) {
      const url = new URL("/api/world-preview", this.origin);
      url.searchParams.set("worldId", worldId);
      url.searchParams.set("chunks", JSON.stringify(coordinates));
      url.searchParams.set("bounds", JSON.stringify(bounds));
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Saved inspection unavailable.");
      return data;
    }
    const store = new IdbPersistenceStore(
      dbNameForWorld(worldId),
      ["chunks", "meta", "players"],
      true,
    );
    try {
      await store.open();
      return await readInspection(store, generation, coordinates, bounds);
    } finally {
      await store.close();
    }
  }
}
