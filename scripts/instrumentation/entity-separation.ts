import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createChicken } from "../../src/entities/Chicken.js";
import { separateOverlappingEntities } from "../../src/entities/collision.js";
import type { Entity } from "../../src/entities/Entity.js";
import { CollisionFlag } from "../../src/world/TileRegistry.js";

// Isolate separation for a sleeping crowd. Solid tiles keep the dense fixture
// stationary in the ungated control, making work repeatable across iterations.
const population = 400;
const iterations = 30;
const entities = Array.from({ length: population }, (_, i) => {
  const entity = createChicken(100, 100);
  entity.id = i + 1;
  return entity;
});
const players = new Set<Entity>();
const sleeping = new Map<Entity, number>();
const mask = CollisionFlag.Solid | CollisionFlag.Water;

function measure(gated: boolean) {
  let collisionQueries = 0;
  const collision = () => {
    collisionQueries++;
    return CollisionFlag.Solid;
  };
  const run = () =>
    separateOverlappingEntities(
      entities,
      players,
      1 / 60,
      collision,
      mask,
      gated ? sleeping : undefined,
    );
  for (let i = 0; i < 5; i++) run();
  collisionQueries = 0;
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  for (const entity of entities) assert.deepEqual(entity.position, { wx: 100, wy: 100 });
  return {
    collisionQueriesPerPass: collisionQueries / iterations,
    medianMs: samples[Math.floor(samples.length / 2)],
  };
}

const ungated = measure(false);
const gated = measure(true);
assert.ok(ungated.collisionQueriesPerPass > 0);
assert.equal(gated.collisionQueriesPerPass, 0);
console.log(
  JSON.stringify(
    {
      population,
      iterations,
      ungated,
      gated,
      scope: "Separation only; synthetic blocked crowd, not gameplay FPS or whole-Worker cost.",
    },
    null,
    2,
  ),
);
