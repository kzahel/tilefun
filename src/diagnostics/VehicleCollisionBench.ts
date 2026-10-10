/** Diagnostic prototype only. No gameplay consumer imports this module. */
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { SpatialHash } from "../entities/SpatialHash.js";

export interface BoxPose {
  x: number;
  y: number;
  yaw: number;
  halfLength: number;
  halfWidth: number;
  z: number;
  height: number;
}
export type CollisionMode = "cardinal-aabb" | "yaw-obb";
export type CollisionScene = "cruise" | "tight-turn" | "roof-riders";
export type CollisionLane = "authority-all" | "controlled-replay-6";
export const COLLISION_SCENES: CollisionScene[] = ["cruise", "tight-turn", "roof-riders"];
export const COLLISION_MODES: CollisionMode[] = ["cardinal-aabb", "yaw-obb"];
export const COLLISION_LANES: CollisionLane[] = ["authority-all", "controlled-replay-6"];
const STEPS = 64;
const PROBE_SPACING = 4;
const MAX_SUBSTEPS = 32;

export function boxBounds(p: BoxPose): AABB {
  const c = Math.abs(Math.cos(p.yaw)),
    s = Math.abs(Math.sin(p.yaw));
  const x = p.halfLength * c + p.halfWidth * s;
  const y = p.halfLength * s + p.halfWidth * c;
  return { left: p.x - x, right: p.x + x, top: p.y - y, bottom: p.y + y };
}

/** Four horizontal separating axes plus vertical intervals; touching is not overlap. */
export function boxesOverlap(a: BoxPose, b: BoxPose): boolean {
  if (a.z >= b.z + b.height || b.z >= a.z + a.height) return false;
  const ac = Math.cos(a.yaw),
    as = Math.sin(a.yaw);
  const bc = Math.cos(b.yaw),
    bs = Math.sin(b.yaw);
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const c = Math.abs(ac * bc + as * bs),
    s = Math.abs(-as * bc + ac * bs);
  return (
    Math.abs(dx * ac + dy * as) < a.halfLength + b.halfLength * c + b.halfWidth * s - 1e-9 &&
    Math.abs(-dx * as + dy * ac) < a.halfWidth + b.halfLength * s + b.halfWidth * c - 1e-9 &&
    Math.abs(dx * bc + dy * bs) < b.halfLength + a.halfLength * c + a.halfWidth * s - 1e-9 &&
    Math.abs(-dx * bs + dy * bc) < b.halfWidth + a.halfLength * s + a.halfWidth * c - 1e-9
  );
}

export function localPoint(p: BoxPose, x: number, y: number) {
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  return { x: p.x + c * x - s * y, y: p.y + s * x + c * y };
}

export function sweepSteps(a: BoxPose, b: BoxPose): number {
  const travel = Math.hypot(b.x - a.x, b.y - a.y);
  const arc = Math.hypot(a.halfLength, a.halfWidth) * Math.abs(b.yaw - a.yaw);
  const steps = Math.max(1, Math.ceil((travel + arc) / PROBE_SPACING));
  if (steps > MAX_SUBSTEPS) throw Error("Diagnostic sweep exceeds its subdivision budget");
  return steps;
}

export interface ProbeCounts {
  poses: number;
  queries: number;
  candidates: number;
  narrowTests: number;
  hits: number;
  riderTests: number;
  checksum: number;
}
const counts = (): ProbeCounts => ({
  poses: 0,
  queries: 0,
  candidates: 0,
  narrowTests: 0,
  hits: 0,
  riderTests: 0,
  checksum: 2166136261,
});
function mix(c: ProbeCounts, value: number) {
  c.checksum = Math.imul(c.checksum ^ value, 16777619) >>> 0;
}
function proxy(id: number, p: BoxPose): Entity {
  return {
    id,
    type: "collision-bench",
    position: { wx: p.x, wy: p.y },
    velocity: null,
    sprite: null,
    collider: null,
    wanderAI: null,
  };
}
function indexPose(e: Entity, p: BoxPose, index: SpatialHash) {
  const b = boxBounds(p);
  e.position.wx = p.x;
  e.position.wy = p.y;
  e.collider = {
    offsetX: 0,
    offsetY: (b.bottom - b.top) / 2,
    width: b.right - b.left,
    height: b.bottom - b.top,
    physicalHeight: p.height,
  };
  index.update(e);
}
function cardinal(p: BoxPose): BoxPose {
  const vertical = Math.abs(Math.sin(p.yaw)) > Math.abs(Math.cos(p.yaw));
  return {
    ...p,
    yaw: 0,
    halfLength: vertical ? p.halfWidth : p.halfLength,
    halfWidth: vertical ? p.halfLength : p.halfWidth,
  };
}
export function collisionPose(p: BoxPose, mode: CollisionMode) {
  return mode === "yaw-obb" ? p : cardinal(p);
}

/** Deterministic demand trace: poses are prescribed, collision verdicts never alter the route. */
export function createCollisionFixture(
  scene: CollisionScene,
  vehicles: number,
  mode: CollisionMode,
  lane: CollisionLane,
) {
  if (!Number.isInteger(vehicles) || vehicles < 1 || vehicles > 128)
    throw Error("Vehicle count must be 1–128");
  const index = new SpatialHash();
  const geometry = new Map<number, BoxPose>();
  const bodies: Entity[] = [];
  const allProxies: Entity[] = [];
  const poseAt = (i: number, tick: number): BoxPose => {
    const phase = (tick / STEPS) * Math.PI * 2;
    const originX = (i % 8) * 90 - 320,
      originY = Math.floor(i / 8) * 76 - 512;
    return {
      x: originX + 30 * Math.sin(phase),
      y: originY + 22 * (1 - Math.cos(phase)),
      yaw: phase + i * 0.13,
      halfLength: 28,
      halfWidth: 10,
      z: 0,
      height: 24,
    };
  };
  const obstacleCount = scene === "cruise" ? 32 : 256;
  for (let i = 0; i < obstacleCount; i++) {
    const p: BoxPose = {
      x: (i % 16) * 48 - 360,
      y: Math.floor(i / 16) * 76 - 500,
      yaw: 0,
      halfLength: scene === "cruise" ? 5 : 14,
      halfWidth: 7,
      z: 0,
      height: scene === "roof-riders" && i % 3 === 0 ? 48 : 20,
    };
    const e = proxy(1000 + i, p);
    indexPose(e, p, index);
    // update inserts an unindexed proxy in the native index.
    geometry.set(e.id, p);
    allProxies.push(e);
  }
  for (let i = 0; i < vehicles; i++) {
    const p = collisionPose(poseAt(i, 0), mode),
      e = proxy(i + 1, p);
    indexPose(e, p, index);
    geometry.set(e.id, p);
    bodies.push(e);
    allProxies.push(e);
  }
  const probe = (p: BoxPose, self: number, c: ProbeCounts, bruteForce: boolean) => {
    const b = boxBounds(p);
    const nearby = bruteForce
      ? allProxies
      : index.queryRange(
          Math.floor(b.left / CHUNK_SIZE_PX),
          Math.floor(b.top / CHUNK_SIZE_PX),
          Math.floor(b.right / CHUNK_SIZE_PX),
          Math.floor(b.bottom / CHUNK_SIZE_PX),
        );
    c.queries++;
    c.candidates += nearby.length;
    for (const e of nearby) {
      if (e.id === self || !e.collider) continue;
      const other = geometry.get(e.id);
      if (
        !other ||
        p.z >= other.z + other.height ||
        other.z >= p.z + p.height ||
        !aabbsOverlap(b, getEntityAABB(e.position, e.collider))
      )
        continue;
      c.narrowTests++;
      const hit = mode === "cardinal-aabb" || boxesOverlap(p, other);
      if (hit) c.hits++;
      mix(c, e.id * 2 + Number(hit));
    }
  };
  const run = (bruteForce = false): ProbeCounts => {
    const c = counts();
    for (let tick = 1; tick <= STEPS; tick++) {
      for (let i = 0; i < vehicles; i++) {
        const e = bodies[i];
        if (!e) throw Error("Missing vehicle proxy");
        const p = collisionPose(poseAt(i, tick - 1), mode);
        geometry.set(e.id, p);
        indexPose(e, p, index);
      }
      const controlled = lane === "authority-all" ? vehicles : 1;
      for (let replay = 0; replay < (lane === "authority-all" ? 1 : 6); replay++) {
        for (let i = 0; i < controlled; i++) {
          const a = poseAt(i, tick - 1),
            b = poseAt(i, tick);
          const subdivisions = sweepSteps(a, b);
          for (let step = 0; step <= subdivisions; step++) {
            const t = step / subdivisions;
            const raw = {
              ...a,
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
              yaw: a.yaw + (b.yaw - a.yaw) * t,
            };
            const p = collisionPose(raw, mode);
            c.poses++;
            probe(p, i + 1, c, bruteForce);
            if (scene === "roof-riders") {
              // Rotate two roof-local occupants; ground-level bodies are Z-rejected.
              for (const offset of [-18, 18]) {
                const point = localPoint(raw, offset, 0);
                const rider = {
                  ...raw,
                  ...point,
                  yaw: 0,
                  halfLength: 5,
                  halfWidth: 3,
                  z: raw.height,
                  height: 16,
                };
                c.riderTests++;
                probe(rider, i + 1, c, bruteForce);
              }
            }
          }
        }
      }
    }
    return c;
  };
  return { run, steps: STEPS, obstacleCount };
}

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
  return { median: at(0.5), p95: at(0.95), max: at(1) };
}

/** Percentiles are of batch-amortized trace-step cost, NOT individual server ticks. */
export async function measureCollisionCase(
  scene: CollisionScene,
  vehicles: number,
  lane: CollisionLane,
  samples = 12,
) {
  const fixtures = COLLISION_MODES.map((mode) => ({
    mode,
    ...createCollisionFixture(scene, vehicles, mode, lane),
  }));
  const expected = fixtures.map((f) => f.run());
  for (let warm = 0; warm < 3; warm++) for (const f of fixtures) f.run();
  // Use the same cycles in both policies; ensure the faster policy amortizes coarse timers.
  let cycles = 1;
  for (;;) {
    const elapsed = fixtures.map((f) => {
      const start = performance.now();
      for (let i = 0; i < cycles; i++) f.run();
      return performance.now() - start;
    });
    if (Math.min(...elapsed) >= 25 || cycles >= 1024) break;
    cycles *= 2;
  }
  const timings: number[][] = [[], []];
  for (let sample = 0; sample < samples; sample++) {
    for (const idx of sample % 2 ? [1, 0] : [0, 1]) {
      const f = fixtures[idx],
        values = timings[idx];
      if (!f || !values) throw Error("Missing comparison policy");
      const start = performance.now();
      let actual: ProbeCounts | undefined;
      for (let i = 0; i < cycles; i++) actual = f.run();
      const duration = performance.now() - start;
      if (JSON.stringify(actual) !== JSON.stringify(expected[idx]))
        throw Error("Non-deterministic collision trace");
      values.push(duration / (cycles * STEPS));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    scene,
    vehicles,
    lane,
    steps: STEPS,
    obstacles: fixtures[0]?.obstacleCount,
    cycles,
    samples,
    policies: fixtures.map((f, i) => ({
      mode: f.mode,
      countsPerTrace: expected[i],
      batchAmortizedMsPerStep: summary(timings[i] ?? []),
      batchesMs: (timings[i] ?? []).map((ms) => ms * cycles * STEPS),
    })),
  };
}
