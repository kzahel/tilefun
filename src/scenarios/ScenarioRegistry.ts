import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** One private memory world per recipe session; no browser/user world registry. */
export function scenarioRegistry(recipe: ScenarioRecipe): IWorldRegistry {
  const meta: WorldMeta = {
    id: "scenario",
    name: recipe.id,
    generation: recipe.generation,
    createdAt: 0,
    lastPlayedAt: 0,
  };
  return {
    async open() {},
    close() {},
    async listWorlds() {
      return [structuredClone(meta)];
    },
    async getWorld(id) {
      return id === meta.id ? structuredClone(meta) : undefined;
    },
    async createWorld() {
      throw Error("Scenario registry is fixed");
    },
    async updateLastPlayed() {},
    async renameWorld() {},
    async deleteWorld() {},
  };
}
