import type { Mod } from "../server/WorldAPI.js";

const BEFRIEND_RANGE = 24;

export const befriendableMod: Mod = {
  name: "befriendable",
  register(api) {
    return api.events.on("player-interact", (data) => {
      const { wx, wy } = data as { wx: number; wy: number };
      const nearby = api.entities.findInRadius(wx, wy, BEFRIEND_RANGE);
      for (const entity of nearby) {
        if (!entity.hasTag("befriendable")) continue;
        entity.setFollowing(!entity.isFollowing);
        break;
      }
    });
  },
};
