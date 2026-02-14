import type { Mod } from "../server/WorldAPI.js";

/**
 * Sample mod: doubles the value of every gem collected.
 * Demonstrates listening to game events via the mod API.
 */
export const doubleGemsMod: Mod = {
  name: "double-gems",
  register(api) {
    return api.events.on("item-collected", (data) => {
      const { player, value } = data as {
        player: { giveGems(n: number): void };
        value: number;
      };
      player.giveGems(value);
    });
  },
};
