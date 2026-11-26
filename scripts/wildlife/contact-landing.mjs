// Exercise the shared solver on flat ground, independently of AI and camera.
import assert from "node:assert/strict";
import { getEntityAABB } from "../../src/entities/collision.ts";
import { ENTITY_FACTORIES } from "../../src/entities/EntityFactories.ts";
import { createPlayer } from "../../src/entities/Player.ts";
import { decodeActor, encodeActor } from "../../src/persistence/ActorRecords.ts";
import { PhysicsScene } from "../../src/physics/PhysicsScene.ts";
import { deserializeEntity, serializeEntity } from "../../src/shared/serialization.ts";

export async function verifyLanding(type, collider) {
  const scene = await PhysicsScene.create();
  try {
    const geometry = {
      getCollision: () => 0,
      getHeight: () => 0,
      queryProps: () => [],
      geometryVersion: () => ({ identity: scene, revision: 0 }),
    };
    const bounds = getEntityAABB({ wx: 0, wy: 0 }, collider);
    const cx = (bounds.left + bounds.right) / 2,
      cy = (bounds.top + bounds.bottom) / 2;
    const actors = [],
      pairs = [];
    for (const [index, outside] of ["center", "right", "back"].entries()) {
      // Keep each target centered within a flat tile, away from a terrain seam.
      const origin = 72 + 192 * index,
        originY = 72;
      const animal = ENTITY_FACTORIES[type](origin, originY);
      assert.deepEqual(animal.collider, collider, `${type} factory`);
      assert.deepEqual(decodeActor(encodeActor(animal)).collider, collider, `${type} saved actor`);
      assert.deepEqual(
        deserializeEntity(serializeEntity(animal)).collider,
        collider,
        `${type} replica`,
      );
      const player = createPlayer(origin, originY);
      const foot = getEntityAABB({ wx: 0, wy: 0 }, player.collider);
      const left = foot.left,
        right = foot.right;
      player.position.wx += outside === "right" ? bounds.right - left + 2 : cx - (left + right) / 2;
      player.position.wy +=
        outside === "back" ? bounds.top - foot.bottom - 2 : cy - (foot.top + foot.bottom) / 2;
      animal.id = index * 2 + 1;
      player.id = animal.id + 1;
      player.wz = collider.physicalHeight + 10;
      actors.push(animal, player);
      pairs.push({ animal, player, outside, groundTicks: 0, supportTicks: 0 });
    }
    const idle = new Map();
    for (let i = 0; i < 120; i++) {
      scene.synchronize(actors);
      scene.step(idle, geometry);
      for (const pair of pairs) {
        const state = scene.bodyState(pair.player.id);
        if (state.grounded && state.supportId === pair.animal.id) pair.supportTicks++;
        if (state.grounded && Math.abs(state.z) < 0.15) pair.groundTicks++;
      }
    }
    for (const { animal, player, outside, supportTicks, groundTicks } of pairs) {
      const expected = outside === "center" ? animal.wz + collider.physicalHeight : 0;
      assert.ok(
        Math.abs(player.wz - expected) < 0.15,
        `${type} ${outside}: ${player.wz} vs ${expected}`,
      );
      const state = scene.bodyState(player.id);
      if (outside === "center") {
        assert.ok(
          state?.grounded && state.supportId === animal.id && supportTicks >= 60,
          `${type}: unstable center landing (${supportTicks} ticks)`,
        );
      } else {
        assert.equal(supportTicks, 0, `${type}: caught player beyond ${outside} edge`);
        assert.ok(
          groundTicks >= 60 && Math.abs(state.vz) < 0.1,
          `${type}: ${outside} player failed to settle on terrain (${groundTicks} ground ticks)`,
        );
      }
    }
    return Number(pairs[0].player.wz.toFixed(2));
  } finally {
    scene.dispose();
  }
}
