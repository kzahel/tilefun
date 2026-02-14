import type { Mod } from "../server/WorldAPI.js";

const VELOCITY_DECAY_RATE = 4;
const VELOCITY_STOP_THRESHOLD = 1;

/**
 * Decays velocity on scattered gems and clears it once below threshold.
 */
export const gemVelocityDecayMod: Mod = {
  name: "gem-velocity-decay",
  register(api) {
    return api.tick.onPostSimulation((dt) => {
      for (const gem of api.entities.findByType("gem")) {
        if (!gem.hasVelocity) continue;

        const decay = Math.max(0, 1 - dt * VELOCITY_DECAY_RATE);
        const newVx = gem.vx * decay;
        const newVy = gem.vy * decay;

        // Move gem by decayed velocity
        gem.setPosition(gem.wx + newVx * dt, gem.wy + newVy * dt);

        if (
          Math.abs(newVx) < VELOCITY_STOP_THRESHOLD &&
          Math.abs(newVy) < VELOCITY_STOP_THRESHOLD
        ) {
          gem.clearVelocity();
        } else {
          gem.setVelocity(newVx, newVy);
        }
      }
    });
  },
};
