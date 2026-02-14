import type { Mod } from "../server/WorldAPI.js";

const SCATTER_MAX = 3;
const SCATTER_SPEED = 80;
const SCATTER_OFFSET = 8;
const KNOCKBACK_SPEED = 200;
const INVINCIBILITY_DURATION = 1.5;

export const baddieContactMod: Mod = {
  name: "baddie-contact",
  register(api) {
    return api.overlap.onOverlap("hostile", (self, other) => {
      const player = api.player.fromEntity(other);
      if (!player || player.isInvincible) return;

      player.knockback(self.wx, self.wy, KNOCKBACK_SPEED);

      const lost = player.loseGems(SCATTER_MAX);
      for (let i = 0; i < lost; i++) {
        const angle = (Math.PI * 2 * i) / Math.max(lost, 1) + Math.random() * 0.5;
        const gem = api.entities.spawn(
          "gem",
          player.wx + Math.cos(angle) * SCATTER_OFFSET,
          player.wy + Math.sin(angle) * SCATTER_OFFSET,
        );
        if (gem) {
          gem.setVelocity(Math.cos(angle) * SCATTER_SPEED, Math.sin(angle) * SCATTER_SPEED);
        }
      }

      player.setInvincible(INVINCIBILITY_DURATION);
      api.events.emit("player-hit", { player, attacker: self, gemsLost: lost });
    });
  },
};
