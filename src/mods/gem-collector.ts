import type { Mod } from "../server/WorldAPI.js";

export const gemCollectorMod: Mod = {
  name: "gem-collector",
  register(api) {
    return api.overlap.onOverlap("collectible", (self, other) => {
      const player = api.player.fromEntity(other);
      if (!player || player.isInvincible) return;

      const value = (self.getAttribute("gemValue") as number) ?? 1;
      player.giveGems(value);
      api.events.emit("item-collected", { entity: self, player, value });
      self.remove();
    });
  },
};
