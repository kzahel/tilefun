import type { Camera } from "./Camera.js";
import type { Renderable } from "./Renderable.js";

interface Particle {
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  /** Vertical velocity (visual only — particles "puff up" then fall). */
  vz: number;
  /** Current visual Z offset in world pixels. */
  z: number;
  life: number;
  maxLife: number;
  /** Radius in world pixels. */
  size: number;
  color: string;
}

const DIRT_COLORS = ["#8B6914", "#A0782C", "#6B4F1D", "#C4A265"];
const WATER_COLORS = ["#4488CC", "#66AADD", "#3377BB", "#88CCEE", "#FFFFFF"];
const GRAVITY = 120; // px/s²

export class ParticleSystem {
  private particles: Particle[] = [];

  /** Spawn a burst of dirt particles at the given world position (feet). */
  spawnLandingDust(wx: number, wy: number, intensity = 1): void {
    const count = Math.round(6 + 4 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 15 + Math.random() * 25 * intensity;
      const life = 0.2 + Math.random() * 0.2;
      this.particles.push({
        wx: wx + (Math.random() - 0.5) * 4,
        wy: wy + (Math.random() - 0.5) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5,
        vz: 20 + Math.random() * 30,
        z: 0,
        life,
        maxLife: life,
        size: 1 + Math.random() * 1.2,
        color: DIRT_COLORS[Math.floor(Math.random() * DIRT_COLORS.length)] ?? "#8B6914",
      });
    }
  }

  /** Spawn a burst of water splash particles at the given world position. */
  spawnWaterSplash(wx: number, wy: number, intensity = 1): void {
    const count = Math.round(8 + 6 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 10 + Math.random() * 20 * intensity;
      const life = 0.3 + Math.random() * 0.3;
      this.particles.push({
        wx: wx + (Math.random() - 0.5) * 6,
        wy: wy + (Math.random() - 0.5) * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.4,
        vz: 40 + Math.random() * 50 * intensity,
        z: 0,
        life,
        maxLife: life,
        size: 1 + Math.random() * 1.5,
        color: WATER_COLORS[Math.floor(Math.random() * WATER_COLORS.length)] ?? "#4488CC",
      });
    }
  }

  update(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.wx += p.vx * dt;
      p.wy += p.vy * dt;
      p.vz -= GRAVITY * dt;
      p.z += p.vz * dt;
      if (p.z < 0) p.z = 0;
      this.particles[write++] = p;
    }
    this.particles.length = write;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const screen = camera.worldToScreen(p.wx, p.wy);
      const r = p.size * camera.scale;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.floor(screen.sx - r / 2),
        Math.floor(screen.sy - p.z * camera.scale - r / 2),
        Math.ceil(r),
        Math.ceil(r),
      );
    }
    ctx.restore();
  }

  /**
   * Return particles as Y-sortable renderables so they interleave with
   * entities and elevation in the depth sort (e.g. occluded behind cliffs).
   */
  collectRenderables(ctx: CanvasRenderingContext2D, camera: Camera): Renderable[] {
    const result: Renderable[] = [];
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const screen = camera.worldToScreen(p.wx, p.wy);
      const r = p.size * camera.scale;
      const sx = Math.floor(screen.sx - r / 2);
      const sy = Math.floor(screen.sy - p.z * camera.scale - r / 2);
      const cr = Math.ceil(r);
      const col = p.color;
      const a = alpha * 0.8;
      result.push({
        position: { wx: p.wx, wy: p.wy },
        sprite: null,
        customDraw: () => {
          ctx.globalAlpha = a;
          ctx.fillStyle = col;
          ctx.fillRect(sx, sy, cr, cr);
          ctx.globalAlpha = 1;
        },
      });
    }
    return result;
  }

  get count(): number {
    return this.particles.length;
  }
}
