import { expect, it } from "vitest";
import { createPlayer } from "../src/entities/Player.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { required } from "../src/shared/required.js";
import { PREDATOR_PROFILES, predatorType } from "../src/wildlife/Predator.js";
import { predatorHomes } from "./PredatorHomes.fixture.js";
import { testPart } from "./TestParts.test-helper.js";

/** Per-species predator deletion/placement reopen cases for one `PredatorPlacement.partN.test.ts` slice. */
export function definePredatorPlacementSuite(partFileUrl: string): void {
  it.each(testPart(PREDATOR_PROFILES, partFileUrl))(
    "$species natural deletion and editor placement survive reopening",
    async (p) => {
      const spawn = required(predatorHomes.get(predatorType(p.species)));
      const session = await ScenarioSession.create({
        version: 1,
        id: `predator-placement-${p.species}`,
        generation: createDescriptor("regional", 2026),
        landscape: "thicket",
        player: createPlayer(spawn.wx - 64, spawn.wy),
        props: [],
      });
      try {
        const animals = () =>
          session.realm.entityManager.entities.filter((e) => e.type === predatorType(p.species));
        const original = animals();
        const removed = required(original[0]);
        expect(removed.proceduralId).toBeDefined();
        const ids = new Set(original.map((e) => e.persistentId));
        session.realm.handleMessage(session.player.clientId, session.player, {
          type: "edit-spawn",
          entityType: predatorType(p.species),
          wx: spawn.home.wx,
          wy: spawn.home.wy - 32,
        });
        expect(animals()).toHaveLength(original.length + 1);
        const manual = required(animals().find((e) => !ids.has(e.persistentId)));
        expect(manual.proceduralId).toBeUndefined();
        session.realm.handleMessage(session.player.clientId, session.player, {
          type: "edit-delete-entity",
          entityId: removed.id,
        });
        await session.reload();
        expect(animals()).toHaveLength(original.length);
        expect(animals().some((e) => e.persistentId === removed.persistentId)).toBe(false);
        expect(animals().some((e) => e.persistentId === manual.persistentId)).toBe(true);
      } finally {
        await session.close();
      }
    },
  );
}
