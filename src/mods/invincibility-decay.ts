import type { Mod } from "../server/WorldAPI.js";

/**
 * Ticks invincibility timer, applies knockback to player velocity,
 * decays knockback, and toggles the flash effect.
 */
export const invincibilityDecayMod: Mod = {
  name: "invincibility-decay",
  register(api) {
    return api.tick.onPostSimulation((dt) => {
      const player = api.player.get();
      if (!player) return;

      if (player.isInvincible) {
        const newTimer = player.invincibilityTimer - dt;
        player.setInvincible(Math.max(0, newTimer));

        // Apply knockback impulse to player velocity
        const kbVx = player.knockbackVx;
        const kbVy = player.knockbackVy;
        player.setVelocity(player.vx + kbVx * dt * 3, player.vy + kbVy * dt * 3);

        // Decay knockback
        const decay = Math.max(0, 1 - dt * 5);
        player.setKnockback(kbVx * decay, kbVy * decay);

        // Flash effect (8 Hz toggle)
        player.setFlashing(newTimer > 0 && Math.floor(newTimer * 8) % 2 === 0);
      } else {
        player.setFlashing(false);
      }
    });
  },
};
