import type { Mod } from "../server/WorldAPI.js";

// ── Combat constants ──
const SCATTER_MAX = 3;
const SCATTER_SPEED = 80;
const SCATTER_OFFSET = 8;
const KNOCKBACK_SPEED = 200;
const INVINCIBILITY_DURATION = 1.5;
const STOMP_BOUNCE_VZ = 150;
const STOMP_DEATH_TIMER = 0.4;

// ── Creature constants ──
const BEFRIEND_RANGE = 24;
const FLEE_SPEED = 60;
const FLEE_DURATION = 1.5;

// ── Gem constants ──
const VELOCITY_DECAY_RATE = 4;
const VELOCITY_STOP_THRESHOLD = 1;

// ── Death constants ──
const CAMPFIRE_DEATH_TIMER = 0.4;
const CAMPFIRE_KILL_RADIUS = 16;

export const baseGameMod: Mod = {
  name: "base-game",
  register(api) {
    const unsubs: (() => void)[] = [];

    // ── Combat: baddie contact ──
    unsubs.push(
      api.overlap.onOverlap("hostile", (self, other) => {
        const player = api.player.fromEntity(other);
        if (!player || player.isInvincible) return;

        // Mario-style stomp: player falling from above kills the entity
        if (
          other.jumpVZ !== undefined &&
          other.jumpVZ < 0 &&
          other.wz > self.wz &&
          self.deathTimer === undefined
        ) {
          self.setDeathTimer(STOMP_DEATH_TIMER);
          self.removeTag("hostile");
          self.setAIState("idle");
          self.setVelocity(0, 0);
          api.entities.spawn("gem", self.wx, self.wy);
          other.setJumpVZ(STOMP_BOUNCE_VZ);
          api.events.emit("enemy-stomped", { player, enemy: self });
          return;
        }

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
      }),
    );

    // ── Combat: buddy scare ──
    unsubs.push(
      api.overlap.onOverlap("hostile", (self, other) => {
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
      }),
    );

    // ── Combat: invincibility decay ──
    unsubs.push(
      api.tick.onPostSimulation((dt) => {
        const player = api.player.get();
        if (!player) return;

        if (player.isInvincible) {
          const newTimer = player.invincibilityTimer - dt;
          player.setInvincible(Math.max(0, newTimer));

          const kbVx = player.knockbackVx;
          const kbVy = player.knockbackVy;
          player.setVelocity(player.vx + kbVx * dt * 3, player.vy + kbVy * dt * 3);

          const decay = Math.max(0, 1 - dt * 5);
          player.setKnockback(kbVx * decay, kbVy * decay);

          player.setFlashing(newTimer > 0 && Math.floor(newTimer * 8) % 2 === 0);
        } else {
          player.setFlashing(false);
        }
      }),
    );

    // ── Creatures: befriendable ──
    unsubs.push(
      api.events.on("player-interact", (data) => {
        const { wx, wy } = data as { wx: number; wy: number };
        const nearby = api.entities.findInRadius(wx, wy, BEFRIEND_RANGE);
        for (const entity of nearby) {
          if (!entity.hasTag("befriendable")) continue;
          entity.setFollowing(!entity.isFollowing);
          break;
        }
      }),
    );

    // ── Creatures: campfire trap (proximity-based) ──
    // Ghosts can't overlap the campfire collider, so use distance instead.
    unsubs.push(
      api.tick.onPostSimulation(() => {
        for (const fire of api.entities.findByTag("campfire")) {
          const nearby = api.entities.findInRadius(fire.wx, fire.wy, CAMPFIRE_KILL_RADIUS);
          for (const other of nearby) {
            if (!other.hasTag("hostile")) continue;
            if (other.deathTimer !== undefined) continue;
            other.setDeathTimer(CAMPFIRE_DEATH_TIMER);
            other.removeTag("hostile");
            other.setAIState("idle");
            other.setVelocity(0, 0);
            api.entities.spawn("gem", other.wx, other.wy);
          }
        }
      }),
    );

    // ── Creatures: death timer ──
    unsubs.push(
      api.tick.onPostSimulation((dt) => {
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
      }),
    );

    // ── Gems: collector ──
    unsubs.push(
      api.overlap.onOverlap("collectible", (self, other) => {
        const player = api.player.fromEntity(other);
        if (!player || player.isInvincible) return;

        const value = (self.getAttribute("gemValue") as number) ?? 1;
        player.giveGems(value);
        api.events.emit("item-collected", { entity: self, player, value });
        self.remove();
      }),
    );

    // ── Gems: velocity decay ──
    unsubs.push(
      api.tick.onPostSimulation((dt) => {
        for (const gem of api.entities.findByType("gem")) {
          if (!gem.hasVelocity) continue;

          const decay = Math.max(0, 1 - dt * VELOCITY_DECAY_RATE);
          const newVx = gem.vx * decay;
          const newVy = gem.vy * decay;

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
      }),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  },
};
