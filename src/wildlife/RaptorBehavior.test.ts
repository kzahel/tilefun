import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { durableId } from "../persistence/ActorRecords.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createPredator } from "./Predator.js";
import { clearPredatorFlight, resolvePredatorCatches, startlePredator } from "./predatorAI.js";
import { createRabbit } from "./Rabbit.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
describe.each(["owl", "eagle", "hawk"] as const)("%s shared aerial hunting", (species) => {
  it.each([
    "contact",
    "airborne-prey",
    "airborne-hunter",
    "height-gap",
    "horizontal-gap",
    "blocked",
    "water",
  ])("requires real landed contact for a catch from above: %s", (condition) => {
    const manager = new EntityManager(),
      hunter = manager.spawn(createPredator(species, 0, 0)),
      prey = manager.spawn(createRabbit(0, 0));
    hunter.wz = hunter.groundZ = required(prey.collider).physicalHeight ?? 0;
    required(hunter.predator).state = "pounce";
    required(hunter.predator).elapsed = 0.5;
    required(hunter.predator).targetId = durableId(prey);
    if (condition === "airborne-prey") {
      prey.wz = prey.jumpZ = 3;
      hunter.wz += 3;
      hunter.groundZ += 3;
    }
    if (condition === "airborne-hunter") hunter.jumpZ = 4;
    if (condition === "height-gap") hunter.wz += 3;
    if (condition === "horizontal-gap") prey.position.wx = 32;
    resolvePredatorCatches(
      manager,
      [...manager.entities],
      { ...open, canOccupy: () => condition !== "blocked", isWater: () => condition === "water" },
      [],
    );
    expect(hunter.predator?.meals).toBe(condition === "contact" ? 1 : 0);
    expect(manager.byId.has(prey.id)).toBe(condition !== "contact");
  });
  it("rejects wet or blocked corridors and flights beyond the planning bound", () => {
    const bird = createPredator(species, 0, 0);
    expect(clearPredatorFlight(bird, { wx: 100, wy: 0 }, 0, open)).toBe(true);
    expect(clearPredatorFlight(bird, { wx: 300, wy: 0 }, 0, open)).toBe(false);
    expect(clearPredatorFlight(bird, { wx: 100, wy: 0 }, 0, { ...open, isWater: () => true })).toBe(
      false,
    );
    expect(
      clearPredatorFlight(bird, { wx: 100, wy: 0 }, 0, { ...open, canOccupy: () => false }),
    ).toBe(false);
  });

  it.each([false, true])(
    "reloads a real attack flight and lands safely (interrupted=%s)",
    async (interrupted) => {
      const hunter = createPredator(species, 64, 64),
        prey = createRabbit(128, 64);
      required(hunter.predator).timer = 0;
      prey.naturalSpawnId = "natural-raptor-prey";
      const session = await ScenarioSession.create({
        version: 1,
        id: `raptor-${species}-${interrupted}`,
        generation: FLAT_SCENARIO,
        player: createPlayer(64, 192),
        props: [],
        nativeProps: [{ type: "prop-griffin-perch", wx: 32, wy: 64 }],
        actors: [hunter, prey],
        traffic: [],
      });
      try {
        expect(session.realm.propManager.props.some((p) => p.type === "prop-griffin-perch")).toBe(
          true,
        );
        const bird = () =>
          required(session.realm.entityManager.entities.find((e) => e.type === hunter.type));
        for (let i = 0; i < 240 && !bird().predator?.flight; i++) await session.step(idle);
        expect(bird().predator?.flight?.attack).toBe(true);
        await session.step(idle);
        expect(bird().sprite?.clip).toBe(6);
        expect(bird().wz).toBeGreaterThan(0);
        const arc = JSON.parse(JSON.stringify(bird().predator?.flight)),
          position = { ...bird().position };
        await session.reload();
        expect(bird().predator?.flight).toEqual(arc);
        expect(bird().position).toEqual(position);
        if (interrupted) startlePredator(bird(), { wx: 0, wy: 0 });
        for (let i = 0; i < 240 && bird().predator?.flight; i++) {
          expect(bird().predator?.meals).toBe(0);
          await session.step(idle);
        }
        expect(bird().predator?.flight).toBeUndefined();
        expect(bird().wz).toBeLessThanOrEqual(8);
        if (interrupted) expect(bird().predator?.targetId).toBeUndefined();
        else {
          // A rabbit can escape the first landing; permit a bounded second hunt.
          for (let i = 0; i < 1800 && !bird().predator?.meals; i++) await session.step(idle);
          expect(bird().predator?.meals).toBe(1);
          expect(session.realm.entityManager.wildlifeRespawns.size).toBe(1);
          expect(session.realm.entityManager.entities.some((e) => e.type === prey.type)).toBe(
            false,
          );
        }
        required(bird().predator).cooldown = 60;
        for (let i = 0; i < 600; i++) await session.step(idle);
        expect(bird().predator?.state).toBe("perch");
        expect(bird().wz).toBe(24);
        const saved = JSON.parse(JSON.stringify(bird().predator));
        await session.reload();
        expect(bird().predator).toEqual(saved);
        expect(bird().wz).toBe(24);
      } finally {
        await session.close();
      }
    },
  );
});
