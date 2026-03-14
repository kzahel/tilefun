import type { ParticleItem } from "./SceneItem.js";

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

const HOSTILE_COLORS = ["#FF3333", "#CC2222", "#FF5555", "#AA1111"];
const DIRT_COLORS = ["#8B6914", "#A0782C", "#6B4F1D", "#C4A265"];
const WATER_COLORS = ["#4488CC", "#66AADD", "#3377BB", "#88CCEE", "#FFFFFF"];
const CLOUD_COLORS = ["#FFFFFF", "#EEEEEE", "#DDDDDD", "#CCCCCC"];
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

  /** Spawn a puff of white cloud particles (stomp effect). */
  spawnStompCloud(wx: number, wy: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const speed = 12 + Math.random() * 20;
      const life = 0.3 + Math.random() * 0.15;
      this.particles.push({
        wx: wx + (Math.random() - 0.5) * 6,
        wy: wy + (Math.random() - 0.5) * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.4,
        vz: 35 + Math.random() * 40,
        z: 0,
        life,
        maxLife: life,
        size: 2 + Math.random() * 1.5,
        color: CLOUD_COLORS[Math.floor(Math.random() * CLOUD_COLORS.length)] ?? "#FFFFFF",
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

  /** Emit a single wispy particle from a hostile entity. Call each frame. */
  spawnHostileWisp(wx: number, wy: number): void {
    if (Math.random() > 0.3) return; // ~30% chance per frame → ~18/s at 60fps
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    const life = 0.4 + Math.random() * 0.3;
    this.particles.push({
      wx: wx + (Math.random() - 0.5) * 8,
      wy: wy + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.3,
      vz: 10 + Math.random() * 15,
      z: Math.random() * 4,
      life,
      maxLife: life,
      size: 0.8 + Math.random() * 0.8,
      color: HOSTILE_COLORS[Math.floor(Math.random() * HOSTILE_COLORS.length)] ?? "#FF3333",
    });
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

  /**
   * Return particles as renderer-agnostic ParticleItem[] for Y-sorted
   * scene rendering (interleaved with entities and elevation).
   */
  collectItems(): ParticleItem[] {
    const result: ParticleItem[] = [];
    for (const p of this.particles) {
      result.push({
        kind: "particle",
        sortKey: p.wy,
        wx: p.wx,
        wy: p.wy,
        z: p.z,
        size: p.size,
        color: p.color,
        alpha: (p.life / p.maxLife) * 0.8,
      });
    }
    return result;
  }

  get count(): number {
    return this.particles.length;
  }
}
