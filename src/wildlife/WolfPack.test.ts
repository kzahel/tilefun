import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { decodeActor, durableId, encodeActor } from "../persistence/ActorRecords.js";
import { createDeer } from "./Deer.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches, updatePredatorAI } from "./predatorAI.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
it("joins its own pack's prey, flanks, and rejects another pack's call", () => {
  const leader = createPredator("dire-wolf", 0, 0),
    mate = createPredator("dire-wolf", 0, 16),
    outsider = createPredator("dire-wolf", 0, -16),
    deer = createDeer(100, 0),
    near = createDeer(40, -16);
  Object.assign(required(leader.predator), {
    packId: "a",
    targetId: durableId(deer),
    state: "display",
  });
  Object.assign(required(mate.predator), { packId: "a", packRole: 1, timer: 0 });
  Object.assign(required(outsider.predator), { packId: "b", timer: 0 });
  const actors = [leader, mate, outsider, deer, near];
  updatePredatorAI(mate, 0.1, open, actors, []);
  expect(mate.predator?.targetId).toBe(deer.persistentId);
  expect(mate.predator?.state).toBe("chase");
  expect(mate.predator?.displaySerial).toBeUndefined();
  updatePredatorAI(mate, 0.2, open, actors, []);
  expect(mate.predator?.aim).not.toEqual(deer.position);
  updatePredatorAI(outsider, 0.1, open, actors, []);
  expect(outsider.predator?.targetId).toBe(near.persistentId);
  expect(outsider.predator?.state).toBe("display");
});
it.each([true, false])(
  "T. rex eats a wolf with natural=%s and preserves only natural pack lineage",
  (natural) => {
    const manager = new EntityManager(),
      rex = manager.spawn(createPredator("t-rex", 0, 0)),
      wolf = manager.spawn(createPredator("dire-wolf", 30, 0));
    Object.assign(required(wolf.predator), { packId: "a", packRole: 2 });
    if (natural) wolf.naturalSpawnId = "world-wolf";
    Object.assign(required(rex.predator), {
      state: "pounce",
      elapsed: 0.5,
      targetId: durableId(wolf),
    });
    resolvePredatorCatches(manager, [...manager.entities], open, []);
    expect(rex.predator?.meals).toBe(1);
    expect(manager.byId.has(wolf.id)).toBe(false);
    const replacement = manager.entities.find((e) => e.type === wolf.type);
    if (natural) {
      expect(replacement?.naturalSpawnId).toBe("world-wolf");
      expect(replacement?.predator?.packRole).toBe(2);
      expect(replacement?.predator?.packId).toBe("a");
      const restored = decodeActor(encodeActor(required(replacement)));
      expect("predator" in restored && restored.predator?.packId).toBe("a");
    } else expect(replacement).toBeUndefined();
  },
);
