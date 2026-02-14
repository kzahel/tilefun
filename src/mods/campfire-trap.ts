import type { Mod } from "../server/WorldAPI.js";

export const campfireTrapMod: Mod = {
  name: "campfire-trap",
  register(api) {
    return api.overlap.onOverlap("campfire", (_self, other) => {
      if (!other.hasTag("hostile")) return;
      if (other.deathTimer !== undefined) return;
      other.setDeathTimer(0.4);
      other.removeTag("hostile");
      other.setAIState("idle");
      other.setVelocity(0, 0);
      api.entities.spawn("gem", other.wx, other.wy);
    });
  },
};
