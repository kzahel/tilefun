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
      const origin = 200 * index;
      const animal = ENTITY_FACTORIES[type](origin, 0);
      assert.deepEqual(animal.collider, collider, `${type} factory`);
      assert.deepEqual(decodeActor(encodeActor(animal)).collider, collider, `${type} saved actor`);
      assert.deepEqual(
        deserializeEntity(serializeEntity(animal)).collider,
        collider,
        `${type} replica`,
      );
      const player = createPlayer(origin, 0);
      const foot = getEntityAABB(player.position, player.collider);
      const left = foot.left - origin,
        right = foot.right - origin;
      player.position.wx += outside === "right" ? bounds.right - left + 2 : cx - (left + right) / 2;
      player.position.wy +=
        outside === "back" ? bounds.top - foot.bottom - 2 : cy - (foot.top + foot.bottom) / 2;
      animal.id = index * 2 + 1;
      player.id = animal.id + 1;
      player.wz = collider.physicalHeight + 10;
      actors.push(animal, player);
      pairs.push({ animal, player, outside });
    }
    const idle = new Map();
    for (let i = 0; i < 120; i++) {
      scene.synchronize(actors);
      scene.step(idle, geometry);
    }
    for (const { animal, player, outside } of pairs) {
      const expected = outside === "center" ? animal.wz + collider.physicalHeight : 0;
      assert.ok(
        Math.abs(player.wz - expected) < 0.15,
        `${type} ${outside}: ${player.wz} vs ${expected}`,
      );
      const state = scene.bodyState(player.id);
      assert.ok(state?.grounded);
      assert.equal(state.supportId === animal.id, outside === "center");
    }
    return Number(pairs[0].player.wz.toFixed(2));
  } finally {
    scene.dispose();
  }
}
