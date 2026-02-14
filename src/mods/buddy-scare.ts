import type { Mod } from "../server/WorldAPI.js";

const FLEE_SPEED = 60;
const FLEE_DURATION = 1.5;

export const buddyScareMod: Mod = {
  name: "buddy-scare",
  register(api) {
    return api.overlap.onOverlap("hostile", (self, other) => {
      if (!other.isFollowing) return;

      const dx = other.wx - self.wx;
      const dy = other.wy - self.wy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeX = dx / dist;
      const fleeY = dy / dist;

      other.setFollowing(false);
      other.setAIState("walking");
      other.setAIDirection(fleeX, fleeY);
      other.setAITimer(FLEE_DURATION);
      other.setVelocity(fleeX * FLEE_SPEED, fleeY * FLEE_SPEED);
    });
  },
};
