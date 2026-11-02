/** Native controlled-collision microbenchmark, NOT game/cutover qualification.
 * Replays identical prescribed starts/intents into the real adapter and two lean
 * KCC models. Lean models omit pushing, support identity and authored special rules.
 * Batched queries additionally see a tick-start snapshot, not sequential commits.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import RAPIER from "@dimforge/rapier3d-compat";
import { CollisionIndex } from "../src/entities/CollisionIndex.js";
import { getEntityAABB } from "../src/entities/collision.js";
import { CharacterMotionBudget } from "../src/physics/CharacterMotionBudget.js";
import type { CharacterMotionSource } from "../src/physics/CharacterPhysics.js";
import { getMovementPhysicsParams } from "../src/physics/PlayerMovement.js";
import { characterShape } from "../src/physics/rapier/CharacterShape.js";
import { createGameCharacterPhysics } from "../src/physics/rapier/GameCharacterPhysics.js";
import { createFauna } from "../src/wildlife/Fauna.js";

const option = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = option("output", path.join(os.tmpdir(), "tilefun-physics-model"));
const counts = option("counts", "24,96,384").split(",").map(Number);
const trials = Number(option("trials", "3"));
const warmup = Number(option("warmup", "40"));
const ticks = Number(option("ticks", "120"));
assert(counts.every((n) => Number.isInteger(n) && n > 0 && n <= 384));
assert([trials, warmup, ticks].every((n) => Number.isInteger(n) && n > 0 && n <= 1000));
const backend = await createGameCharacterPhysics();
const physics = { ...getMovementPhysicsParams(), characterPhysics: 3 as const, walkSpeed: 64 };
const dt = 1 / 60;
const scale = 16;
const skin = 0.002;
type Lane =
  | "adapter"
  | "adapter-cached-descriptors"
  | "lean-sequential"
  | "lean-batched"
  | "rigid-bodies";
type Layout = "spread" | "contact-pairs";
const lanes: Lane[] = [
  "adapter",
  "adapter-cached-descriptors",
  "lean-sequential",
  "lean-batched",
  "rigid-bodies",
];
const layouts: Layout[] = ["spread", "contact-pairs"];
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.floor(sorted.length * 0.5)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    p99Ms: sorted[Math.floor(sorted.length * 0.99)],
    maxMs: sorted.at(-1),
  };
};
const git = (args: string[]) =>
  execFileSync(
    process.platform === "win32" ? "wsl" : "git",
    process.platform === "win32" ? ["git", ...args] : args,
    { encoding: "utf8" },
  ).trim();
const report = {
  revision: git(["rev-parse", "HEAD"]),
  dirty: !!git(["status", "--porcelain"]),
  date: new Date().toISOString(),
  cpu: os.cpus()[0]?.model,
  node: process.version,
  platform: process.platform,
  trials,
  warmup,
  ticks,
  notes: [
    "Native synchronous microbenchmark: no AI, Worker transport, replication, prediction or rendering.",
    "Same ordinary dog box shapes, section floors, counts and prescribed tick-start poses/intents in all lanes.",
    "Prescribed poses reset each tick; this is a query trace, not a closed-loop simulation or gameplay parity test.",
    "Adapter uses real production motor, fine CollisionIndex and pushing; lean models omit push/support identity/water/one-way/airborne policy and callbacks.",
    "Adapter cached-descriptors memoizes the cuboid descriptor factory only, a benchmark-local allocation ablation valid for these fixed unrotated boxes. Factory requests remain; actual construction after warmup is avoided. Final diagnostic endpoints must agree with adapter.",
    "Lean sequential refreshes world per actor; lean batched refreshes once, queries tick-start scene and delays collider writes until all results exist.",
    "Rigid bodies use one global dynamic step, gravity and locked rotations; this is a different controller model, not existing player/NPC motor behavior.",
    "Timing runs are uninstrumented. Operation counts/timings come from one separate warm diagnostic tick; nested phase times are not additive.",
  ],
  cases: [] as unknown[],
};
await mkdir(output, { recursive: true });

function fixture(population: number, layout: Layout, lane: Lane) {
  const isAdapter = lane === "adapter" || lane === "adapter-cached-descriptors";
  const cuboidFactory = RAPIER.ColliderDesc.cuboid;
  const descriptors = new Map<string, RAPIER.ColliderDesc>();
  let constructedDescriptors = 0;
  if (lane === "adapter-cached-descriptors")
    RAPIER.ColliderDesc.cuboid = (x, y, z) => {
      const key = `${x},${y},${z}`;
      let descriptor = descriptors.get(key);
      if (!descriptor) {
        descriptor = cuboidFactory(x, y, z);
        descriptors.set(key, descriptor);
        constructedDescriptors++;
      }
      return descriptor;
    };
  const entities = Array.from({ length: population }, (_, i) => {
    const e = createFauna("dog", 96 + (i % 16) * 24, 96 + Math.floor(i / 16) * 18);
    e.id = i + 1;
    e.wz = 0;
    e.groundZ = 0;
    if (layout === "contact-pairs" && e.collider) {
      const pair = Math.floor(i / 2);
      e.position.wx = 96 + (pair % 8) * 48 + (i % 2) * (e.collider.width + 0.5);
      e.position.wy = 96 + Math.floor(pair / 8) * (e.collider.height + 6);
    }
    return e;
  });
  const initial = entities.map((e) => ({ ...e.position }));
  const collision = backend.createWorld();
  const index = new CollisionIndex();
  const budget = new CharacterMotionBudget();
  const sources: CharacterMotionSource[] = entities.map((entity) => ({
    getCollision: () => 0,
    getHeight: () => 0,
    queryProps: () => [],
    queryEntities: (bounds) => index.query(bounds),
    movingEntity: entity,
    excludeIds: new Set([entity.id]),
    noclip: false,
    collisionWorld: collision,
    geometryVersion: () => ({ identity: initial, revision: 0 }),
    motionBudget: budget,
    pushBody(before, after) {
      Object.assign(before, after);
      index.update(before);
    },
  }));
  collision.beginFrame();
  if (lane === "rigid-bodies") collision.world.gravity = { x: 0, y: -9.81, z: 0 };
  const cached = entities.map((entity, i) => {
    const shape = characterShape(entity, "box");
    const b = initial[i];
    const source = sources[i];
    assert(b && source);
    collision.prepare(
      entity,
      { left: b.wx - 32, top: b.wy - 32, right: b.wx + 32, bottom: b.wy + 32 },
      source,
    );
    const position = {
      x: shape.center.x - collision.origin.x,
      y: shape.center.y - collision.origin.y + skin,
      z: shape.center.z - collision.origin.z,
    };
    const rigidBody =
      lane === "rigid-bodies"
        ? collision.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
              .setSoftCcdPrediction(0.2)
              .lockRotations()
              .setTranslation(position.x, position.y, position.z),
          )
        : undefined;
    return {
      collider: rigidBody
        ? collision.world.createCollider(shape.descriptor, rigidBody)
        : collision.actor(entity, false),
      rigidBody,
      half: shape.half,
      offsetX: shape.center.x - b.wx / scale,
      offsetZ: shape.center.z - b.wy / scale,
      position,
      move: { x: 0, y: 0, z: 0 },
    };
  });
  collision.refresh(dt);
  const controller = collision.controller;
  controller.enableAutostep(4 / scale, 0.1, false);
  controller.enableSnapToGround(4 / scale);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 3);
  controller.setApplyImpulsesToDynamicBodies(false);
  const origin = collision.origin;
  let contacts = 0;
  function frame(tick: number) {
    collision.beginFrame();
    budget.clear();
    const sway = Math.sin(tick * 0.035) * 3;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const start = initial[i];
      const body = cached[i];
      assert(e && start && body && e.velocity);
      e.position.wx = start.wx + sway;
      e.position.wy = start.wy;
      e.wz = e.groundZ = e.jumpZ = 0;
      delete e.jumpVZ;
      e.velocity.vx = layout === "contact-pairs" && i % 2 ? -64 : 64;
      e.velocity.vy = 0;
      if (!isAdapter) {
        body.position.x = e.position.wx / scale + body.offsetX - origin.x;
        body.position.y = body.half.y + skin - origin.y;
        body.position.z = e.position.wy / scale + body.offsetZ - origin.z;
        if (body.rigidBody) {
          body.rigidBody.setTranslation(body.position, true);
          body.rigidBody.setLinvel({ x: e.velocity.vx / scale, y: 0, z: 0 }, true);
        } else body.collider.setTranslation(body.position);
      }
    }
    if (isAdapter) index.rebuild(entities);
    else if (lane === "lean-batched" || lane === "rigid-bodies") collision.refresh(dt);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const body = cached[i];
      const source = sources[i];
      assert(e && body && source && e.velocity);
      if (isAdapter) {
        backend.step(e, dt, physics, source);
        index.update(e);
      } else if (body.rigidBody) {
        const end = body.rigidBody.translation();
        e.position.wx = (end.x + origin.x - body.offsetX) * scale;
        e.position.wy = (end.z + origin.z - body.offsetZ) * scale;
        e.wz = (end.y + origin.y - body.half.y) * scale - skin * scale;
      } else {
        if (lane === "lean-sequential") collision.refresh(dt);
        body.move.x = (e.velocity.vx * dt) / scale;
        body.move.y = body.move.z = 0;
        controller.computeColliderMovement(body.collider, body.move);
        const resolved = controller.computedMovement();
        contacts += controller.numComputedCollisions();
        body.move.x = resolved.x;
        body.move.y = resolved.y;
        body.move.z = resolved.z;
        // Same additional endpoint support cast as the general motor, without
        // gameplay classification/filter callback or support-entity lookup.
        const end = {
          x: body.position.x + resolved.x,
          y: body.position.y + resolved.y,
          z: body.position.z + resolved.z,
        };
        collision.world.castShape(
          end,
          body.collider.rotation(),
          { x: 0, y: -1, z: 0 },
          body.collider.shape,
          0,
          skin * 3,
          false,
          undefined,
          undefined,
          body.collider,
        );
        if (lane === "lean-sequential") body.collider.setTranslation(end);
        e.position.wx += resolved.x * scale;
        e.position.wy += resolved.z * scale;
        e.wz = (e.wz ?? 0) + resolved.y * scale;
      }
      assert(Number.isFinite(e.position.wx + e.position.wy + (e.wz ?? 0)));
    }
    if (lane === "lean-batched")
      for (const body of cached) {
        body.position.x += body.move.x;
        body.position.y += body.move.y;
        body.position.z += body.move.z;
        body.collider.setTranslation(body.position);
      }
    // Do not endFrame/prune in the lean model: all actors/sections are fixed
    // resident workload. Production adapter exercises its actual lifetime pass.
    if (isAdapter) collision.endFrame();
  }
  function diagnose(tick: number) {
    const operations: Record<string, { calls: number; ms: number }> = {};
    const restore: (() => void)[] = [];
    const wrap = <T extends object, K extends keyof T>(owner: T, key: K, name: string) => {
      const fn = owner[key];
      assert(typeof fn === "function");
      operations[name] ??= { calls: 0, ms: 0 };
      const metric = operations[name];
      Object.assign(owner, {
        [key]: function (this: T, ...args: unknown[]) {
          const started = performance.now();
          metric.calls++;
          try {
            return Reflect.apply(fn, this, args);
          } finally {
            metric.ms += performance.now() - started;
          }
        },
      });
      restore.push(() => {
        owner[key] = fn;
      });
    };
    wrap(RAPIER.ColliderDesc, "cuboid", "shapeDescriptorRequests");
    wrap(RAPIER.ColliderDesc, "capsule", "shapeDescriptorRequests");
    wrap(collision, "prepare", "prepare");
    wrap(collision, "actor", "actorSync");
    wrap(collision, "synchronizeNeighborhood", "neighborhood");
    wrap(collision, "refresh", "refresh");
    wrap(collision.world, "step", "worldSteps");
    wrap(collision.world, "castShape", "supportCasts");
    wrap(controller, "computeColliderMovement", "kccQueries");
    const descriptorsBefore = constructedDescriptors;
    try {
      frame(tick);
      let overlappingEndpointPairs = 0;
      let maxEndpointPenetrationPx = 0;
      for (let i = 0; i < entities.length; i++)
        for (let j = i + 1; j < entities.length; j++) {
          const a = entities[i],
            b = entities[j];
          assert(a?.collider && b?.collider);
          const aa = getEntityAABB(a.position, a.collider),
            bb = getEntityAABB(b.position, b.collider);
          const penetration = Math.min(
            aa.right - bb.left,
            bb.right - aa.left,
            aa.bottom - bb.top,
            bb.bottom - aa.top,
          );
          if (penetration > 0.05) {
            overlappingEndpointPairs++;
            maxEndpointPenetrationPx = Math.max(maxEndpointPenetrationPx, penetration);
          }
        }
      return {
        operations,
        residency: collision.diagnostics,
        rigidBodies: collision.world.bodies.len(),
        overlappingEndpointPairs,
        maxEndpointPenetrationPx,
        descriptorCache:
          lane === "adapter-cached-descriptors"
            ? {
                entries: descriptors.size,
                constructedDuringDiagnostic: constructedDescriptors - descriptorsBefore,
              }
            : null,
      };
    } finally {
      for (const reset of restore.reverse()) reset();
    }
  }
  return {
    frame,
    diagnose,
    endpoints: () => entities.flatMap((e) => [e.position.wx, e.position.wy, e.wz ?? 0]),
    dispose() {
      collision.dispose();
      RAPIER.ColliderDesc.cuboid = cuboidFactory;
    },
    contacts: () => contacts,
  };
}

const adapterEndpoints = new Map<
  string,
  { positions: number[]; result: { adapterEndpointAgreementPx: number | null } }
>();
for (let trial = 0; trial < trials; trial++)
  for (const layout of layouts)
    for (const population of counts)
      for (const lane of trial % 2 ? [...lanes].reverse() : lanes) {
        const model = fixture(population, layout, lane);
        try {
          for (let i = 0; i < warmup; i++) model.frame(i);
          const measurements: number[] = [];
          for (let i = warmup; i < warmup + ticks; i++) {
            const started = performance.now();
            model.frame(i);
            measurements.push(performance.now() - started);
          }
          const diagnostic = model.diagnose(warmup + ticks);
          const result = {
            trial,
            layout,
            population,
            lane,
            ...stats(measurements),
            ...diagnostic,
            leanComputedCollisions: model.contacts(),
            adapterEndpointAgreementPx: null as number | null,
          };
          if (lane === "adapter" || lane === "adapter-cached-descriptors") {
            const key = `${trial}:${layout}:${population}`;
            const other = adapterEndpoints.get(key);
            const positions = model.endpoints();
            if (other) {
              const error = Math.max(
                ...positions.map((v, i) => Math.abs(v - (other.positions[i] ?? Infinity))),
              );
              assert(error < 1e-5, "Descriptor caching changed adapter endpoints");
              result.adapterEndpointAgreementPx = other.result.adapterEndpointAgreementPx = error;
              adapterEndpoints.delete(key);
            } else adapterEndpoints.set(key, { positions, result });
          }
          report.cases.push(result);
          console.log(JSON.stringify({ trial, layout, population, lane, ...stats(measurements) }));
          await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
        } finally {
          model.dispose();
        }
      }
