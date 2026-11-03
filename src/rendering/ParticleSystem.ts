import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { surfaceDecals } from "./ProjectedDecals.js";
import type { ParticleItem, SceneItem } from "./SceneItem.js";
import type {
  Point3,
  SurfaceAttachment,
  SurfaceReceivers,
  SurfaceVertex,
} from "./SurfaceReceivers.js";
import { physicalSupportPlane, planeZ } from "./SurfaceReceivers.js";

interface Particle {
  wx: number;
  wy: number;
  z: number;
  previousZ: number;
  originZ: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  excludeId?: number | undefined;
}
interface Burst {
  kind: "dust" | "cloud" | "water" | "wisp";
  wx: number;
  wy: number;
  wz: number;
  intensity: number;
  excludeId?: number | undefined;
}
interface Mark {
  center: SurfaceAttachment;
  u: SurfaceAttachment;
  v: SurfaceAttachment;
  life: number;
  maxLife: number;
  radius: number;
  excludeId?: number | undefined;
}
const COLORS = {
  dust: ["#8B6914", "#A0782C", "#6B4F1D", "#C4A265"],
  water: ["#4488CC", "#66AADD", "#3377BB", "#88CCEE", "#FFFFFF"],
  cloud: ["#FFFFFF", "#EEEEEE", "#DDDDDD", "#CCCCCC"],
  wisp: ["#FF3333", "#CC2222", "#FF5555", "#AA1111"],
};
const GRAVITY = 120;
export type ParticlePresentation = ParticleItem[] | Pick<ParticleSystem, "collectItems">;
function basis(normal: Point3): [Point3, Point3] {
  const length = Math.hypot(normal[2], normal[0]);
  const u: Point3 = length > 1e-6 ? [normal[2] / length, 0, -normal[0] / length] : [1, 0, 0];
  const [nx, ny, nz] = normal;
  return [u, [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]]];
}
/** Cosmetic particles have world XYZ; receiver queries are shared with shadows.
 * Only landed marks attach to a moving surface. Released puffs remain independent. */
export class ParticleSystem {
  private particles: Particle[] = [];
  private pending: Burst[] = [];
  private marks: Mark[] = [];
  private lastContact: { receiverId: string; point: Point3; normal: Point3 } | undefined;
  private previous: { id: number; point: Point3; feet: AABB } | undefined;
  private airborneClearance = false;
  private inFlight = false;
  private landing: { burst: Burst; feet: AABB } | undefined;
  spawnLandingDust(wx: number, wy: number, intensity = 1, wz = 0, excludeId?: number) {
    this.pending.push({ kind: "dust", wx, wy, wz, intensity, excludeId });
  }
  spawnStompCloud(wx: number, wy: number, wz = 0) {
    this.pending.push({ kind: "cloud", wx, wy, wz, intensity: 1 });
  }
  spawnWaterSplash(wx: number, wy: number, intensity = 1, wz = 0) {
    this.pending.push({ kind: "water", wx, wy, wz, intensity });
  }
  spawnHostileWisp(wx: number, wy: number, wz = 0) {
    if (Math.random() <= 0.3) this.pending.push({ kind: "wisp", wx, wy, wz, intensity: 1 });
  }
  /** Shared game/lab transition observer; a respawn returns the old splash point for audio. */
  observePlayer(player: Entity): Point3 | undefined {
    const point: Point3 = [player.position.wx, player.position.wy, player.wz ?? 0];
    const airborne = player.jumpVZ !== undefined && player.parentId === undefined;
    const previous = this.previous;
    const feet = player.collider
      ? getEntityAABB(player.position, player.collider)
      : { left: point[0], right: point[0], top: point[1], bottom: point[1] };
    let splash: Point3 | undefined;
    if (previous?.id !== player.id || player.parentId !== undefined) {
      this.inFlight = false;
      this.airborneClearance = false;
      this.landing = undefined;
    }
    if (airborne) {
      if (!this.inFlight) this.airborneClearance = false;
      this.inFlight = true;
      this.landing = undefined;
    } else if (this.inFlight && previous) {
      const dx = point[0] - previous.point[0],
        dy = point[1] - previous.point[1];
      if (dx * dx + dy * dy > 32 * 32) {
        splash = previous.point;
        this.spawnWaterSplash(splash[0], splash[1], 1, splash[2]);
        this.inFlight = false;
        this.landing = undefined;
      } else if (point[2] <= previous.point[2] + 0.1) {
        this.landing = {
          burst: {
            kind: "dust",
            wx: point[0],
            wy: point[1],
            wz: point[2],
            intensity: 1,
            excludeId: player.id,
          },
          feet,
        };
      } else this.landing = undefined;
    }
    this.previous = { id: player.id, point, feet };
    return splash;
  }

  private emit(b: Burst, receivers?: SurfaceReceivers) {
    // Contact bursts attach to a receiver; airborne wisps/stomp clouds retain
    // the caller's 3D birth position and only query a floor while falling.
    const contact =
      b.kind === "dust" || b.kind === "water"
        ? receivers?.hit(b.wx, b.wy, b.wz + 1, b.excludeId)
        : undefined;
    const normal = contact?.normal ?? [0, 0, 1],
      origin = contact?.point ?? [b.wx, b.wy, b.wz],
      velocity = contact?.velocity ?? [0, 0, 0];
    const [u, v] = basis(normal);
    if (b.kind === "dust" && contact)
      this.lastContact = {
        receiverId: contact.face.id,
        point: contact.point,
        normal: contact.normal,
      };
    const water = b.kind === "water",
      cloud = b.kind === "cloud",
      wisp = b.kind === "wisp";
    const count = wisp
      ? 1
      : cloud
        ? 12
        : Math.round((water ? 8 : 6) + (water ? 6 : 4) * b.intensity);
    const colors = COLORS[b.kind];
    if (b.kind === "dust" && contact && receivers) {
      const at = (d: Point3): SurfaceAttachment =>
        receivers.attach({
          ...contact,
          point: [origin[0] + d[0], origin[1] + d[1], origin[2] + d[2]],
        });
      this.marks.push({
        center: receivers.attach(contact),
        u: at(u),
        v: at(v),
        life: 0.24,
        maxLife: 0.24,
        radius: 4,
        excludeId: b.excludeId,
      });
    }
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = wisp
        ? 3 + Math.random() * 6
        : 10 + Math.random() * (water ? 20 : cloud ? 20 : 25) * b.intensity;
      const lift = wisp
        ? 10 + Math.random() * 15
        : water
          ? 40 + Math.random() * 50
          : cloud
            ? 35 + Math.random() * 40
            : 20 + Math.random() * 30;
      const life = wisp
        ? 0.4 + Math.random() * 0.3
        : water
          ? 0.3 + Math.random() * 0.3
          : cloud
            ? 0.3 + Math.random() * 0.15
            : 0.2 + Math.random() * 0.2;
      const du = (Math.random() - 0.5) * (wisp ? 8 : 4),
        dv = (Math.random() - 0.5) * 2;
      const x = origin[0] + u[0] * du + v[0] * dv,
        y = origin[1] + u[1] * du + v[1] * dv,
        z = origin[2] + u[2] * du + v[2] * dv + 0.03;
      const along = Math.cos(angle) * speed,
        side = Math.sin(angle) * speed;
      this.particles.push({
        wx: x,
        wy: y,
        z,
        previousZ: z,
        originZ: z,
        vx: u[0] * along + v[0] * side + normal[0] * lift + velocity[0],
        vy: u[1] * along + v[1] * side + normal[1] * lift + velocity[1],
        vz: u[2] * along + v[2] * side + normal[2] * lift + velocity[2],
        life,
        maxLife: life,
        size: cloud ? 2 + Math.random() * 1.5 : 1 + Math.random() * 1.2,
        color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? "#fff",
        excludeId: b.excludeId,
      });
    }
  }
  update(dt: number) {
    let write = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.wx += p.vx * dt;
      p.wy += p.vy * dt;
      p.previousZ = p.z;
      p.vz -= GRAVITY * dt;
      p.z += p.vz * dt;
      this.particles[write++] = p;
    }
    this.particles.length = write;
    for (const m of this.marks) m.life -= dt;
    this.marks = this.marks.filter((m) => m.life > 0);
  }
  collectItems(receivers?: SurfaceReceivers): SceneItem[] {
    if (this.inFlight && this.previous) {
      const {
        point: [wx, wy, wz],
        feet,
      } = this.previous;
      const contact = receivers?.hit(wx, wy, wz + 1, this.previous.id);
      const plane = contact ? physicalSupportPlane(contact) : undefined;
      const reachX = Math.max(Math.abs(feet.left - wx), Math.abs(feet.right - wx));
      const reachY = Math.max(Math.abs(feet.top - wy), Math.abs(feet.bottom - wy));
      const allowance =
        0.75 + (plane ? Math.abs(plane[0]) * reachX + Math.abs(plane[1]) * reachY : 0);
      const gap = plane ? wz - planeZ(plane, wx, wy) : Infinity;
      // A support flag can flicker while riding a settled dynamic body. Require
      // genuine air clearance before such a transition can make landing dust.
      if (receivers && gap > allowance + 2) this.airborneClearance = true;
      if (this.landing && (Math.abs(gap) <= allowance || !receivers)) {
        if (this.airborneClearance || !receivers) this.pending.push(this.landing.burst);
        this.inFlight = false;
        this.airborneClearance = false;
        this.landing = undefined;
      }
    }

    for (const b of this.pending) this.emit(b, receivers);
    this.pending.length = 0;
    const result: SceneItem[] = [];
    for (const p of this.particles) {
      const floor =
        p.vz <= 0
          ? receivers?.hit(p.wx, p.wy, Math.max(p.previousZ, p.z, p.originZ) + 1, p.excludeId)
          : undefined;
      const z = floor?.point[2] ?? (receivers ? -Infinity : p.originZ);
      if (p.vz <= 0 && p.z < z) {
        p.z = z;
        p.vz = 0;
      }
      result.push({
        kind: "particle",
        sortKey: p.wy + p.z,
        wx: p.wx,
        wy: p.wy,
        z: p.z,
        size: p.size,
        color: p.color,
        alpha: (p.life / p.maxLife) * 0.8,
      });
    }
    if (receivers)
      for (const mark of this.marks) {
        const center = receivers.locate(mark.center),
          u = receivers.locate(mark.u),
          v = receivers.locate(mark.v);
        if (!center || !u || !v) continue;
        const radius = mark.radius + (1 - mark.life / mark.maxLife) * 5;
        const polygon: SurfaceVertex[] = [
          [-1, -1, 0, 0],
          [1, -1, 1, 0],
          [1, 1, 1, 1],
          [-1, 1, 0, 1],
        ].map(([a = 0, b = 0, uu = 0, vv = 0]) => ({
          x: center[0] + radius * (a * (u[0] - center[0]) + b * (v[0] - center[0])),
          y: center[1] + radius * (a * (u[1] - center[1]) + b * (v[1] - center[1])),
          u: uu,
          v: vv,
        }));
        result.push(
          ...surfaceDecals(
            receivers.project(polygon, center[2], mark.excludeId),
            "ring",
            (0.24 * mark.life) / mark.maxLife,
            "#b29c73",
          ),
        );
      }
    return result;
  }
  clear() {
    this.particles.length = 0;
    this.pending.length = 0;
    this.marks.length = 0;
    this.previous = undefined;
    this.inFlight = false;
    this.airborneClearance = false;
    this.landing = undefined;
    this.lastContact = undefined;
  }
  get count() {
    return this.particles.length;
  }
  get diagnostics() {
    return {
      particles: this.particles.length,
      pending: this.pending.length,
      marks: this.marks.length,
      ...(this.lastContact ? { lastContact: this.lastContact } : {}),
    };
  }
}
