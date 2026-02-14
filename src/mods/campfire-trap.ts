import type { Mod } from "../server/WorldAPI.js";

export const campfireTrapMod: Mod = {
  name: "campfire-trap",
  register(api) {
    return api.overlap.onOverlap("campfire", (_self, other) => {
      if (!other.hasTag("hostile")) return;
      other.setDeathTimer(0.4);
      const gem = api.entities.spawn("gem", other.wx, other.wy);
      if (gem) gem.addTag("collectible");
    });
  },
};
