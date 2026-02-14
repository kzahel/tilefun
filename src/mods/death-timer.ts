import type { Mod } from "../server/WorldAPI.js";

export const deathTimerMod: Mod = {
  name: "death-timer",
  register(api) {
    return api.tick.onPostSimulation((dt) => {
      const dead: number[] = [];
      for (const entity of api.entities.all()) {
        if (entity.deathTimer === undefined) continue;
        const remaining = entity.deathTimer - dt;
        entity.setDeathTimer(remaining);
        entity.setFlashing(Math.floor(remaining * 16) % 2 === 0);
        if (remaining <= 0) {
          dead.push(entity.id);
        }
      }
      for (const id of dead) {
        api.entities.remove(id);
      }
    });
  },
};
