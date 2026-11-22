import { expect, it } from "vitest";
import { CONSTRUCTION_CRATE, WRECKING_BALL } from "../entities/ConstructionCargo.js";
import {
  MARBLE_CHUTE,
  MARBLE_TRACK,
  SEESAW,
  SEESAW_HEIGHT,
} from "../entities/PhysicsPlayground.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { runEquipment } from "../server/EquipmentControl.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import { isForklift } from "../traffic/Forklift.js";
import { craneRig, isMobileCrane } from "../traffic/MobileCrane.js";
import { marbleRunRecipe, seesawRecipe } from "./ConstructionPlaygroundRecipe.js";
import { constructionYardRecipe, constructionYardSite } from "./ConstructionYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };

it("drops a freely rotating steel ball down the chute into a crate stack", async () => {
  const session = await ScenarioSession.create(marbleRunRecipe());
  try {
    const actors = session.realm.entityManager.entities;
    const crane = required(actors.find(isMobileCrane));
    const crates = actors.filter((e) => e.type === CONSTRUCTION_CRATE);
    const chute = required(actors.find((e) => e.type === MARBLE_CHUTE));
    await session.step(idle);
    session.realm.vehicles.enter(session.player, crane.id);
    const hold = async (excavatorAction: ExcavatorAction, until: () => boolean) => {
      for (let i = 0; i < 220 && !until(); i++) await session.step({ ...idle, excavatorAction });
      expect(until()).toBe(true);
      for (let i = 0; i < 20; i++) await session.step(idle);
    };
    const rig = () => craneRig(crane.vehicleExcavator);
    await hold("boom-up", () => rig().pitch >= 0.48);
    await hold("stick-out", () => rig().extension >= 34);
    const command = (action: "crane-hook" | "crane-tool") =>
      runEquipment(session.realm.vehicles, session.player, { entityId: crane.id, action });
    command("crane-tool");
    const marble = required(actors.find((e) => e.type === WRECKING_BALL));
    for (let i = 0; i < 18; i++) await session.step(idle);
    expect(marble.wz).toBeGreaterThan(50);
    command("crane-hook");
    expect(crane.vehicleCraneLoadId).toBeUndefined();
    let rolled = false;
    let reachedChute = false;
    let reachedCrates = false;
    for (let i = 0; i < 300; i++) {
      await session.step(idle);
      if (Math.abs(marble.bodyRotation?.[1] ?? 0) > 0.25) rolled = true;
      if (marble.position.wx > 95 && marble.position.wx < 125 && (marble.wz ?? 0) > 4)
        reachedChute = true;
      if (marble.position.wx > 126) reachedCrates = true;
    }
    const state = JSON.stringify({
      marble: marble.position,
      z: marble.wz,
      chute: chute.position,
      crates: crates.map((e) => ({ ...e.position, z: e.wz })),
    });
    expect(rolled, state).toBe(true);
    expect(reachedChute, state).toBe(true);
    expect(reachedCrates, state).toBe(true);
    expect(
      crates.some((e) => e.position.wx > 169),
      state,
    ).toBe(true);
    expect(
      crates.every((e) => (e.wz ?? 0) < 30),
      state,
    ).toBe(true);
  } finally {
    await session.close();
  }
});

it("lets a driver cross a seesaw that tips around a fixed center", async () => {
  const session = await ScenarioSession.create(seesawRecipe());
  try {
    const actors = session.realm.entityManager.entities;
    const car = required(actors.find((e) => e.type === "vehicle-v1:race-coupe"));
    const deck = required(actors.find((e) => e.type === SEESAW));
    for (let i = 0; i < 30; i++) await session.step(idle);
    expect(required(deck.bodyRotation)[1]).toBeLessThan(-0.05);
    session.realm.vehicles.enter(session.player, car.id);
    let maxTilt = 0;
    let crossed = false;
    for (let i = 0; i < 310; i++) {
      await session.step(crossed ? idle : { ...idle, dy: -0.45, relativeDriving: true });
      const rotation = required(deck.bodyRotation);
      const local = rotateBodyVector(rotation, 0, 0, 2);
      expect(deck.position.wx + local.x).toBeCloseTo(0, 3);
      expect((deck.wz ?? 0) + local.z).toBeCloseTo(SEESAW_HEIGHT, 3);
      maxTilt = Math.max(maxTilt, rotation[1]);
      if (car.position.wx > 105) crossed = true;
    }
    const state = JSON.stringify({
      maxTilt,
      car: car.position,
      z: car.wz,
      rotation: deck.bodyRotation,
    });
    expect(maxTilt, state).toBeGreaterThan(0.05);
    expect(crossed, state).toBe(true);
    await session.reload();
    await session.step(idle);
    const restored = required(session.realm.entityManager.entities.find((e) => e.type === SEESAW));
    expect(required(restored.bodyRotation)[1]).toBeGreaterThan(0.05);
  } finally {
    await session.close();
  }
});

it("lets the forklift lift and carry the exit chute through its side slots", async () => {
  const recipe = marbleRunRecipe();
  recipe.player.position = { wx: 143, wy: 63 };
  const session = await ScenarioSession.create(recipe);
  try {
    const actors = session.realm.entityManager.entities;
    const forklift = required(actors.find(isForklift));
    const chute = required(actors.find((e) => e.type === MARBLE_CHUTE));
    for (let i = 0; i < 20; i++) await session.step(idle);
    session.realm.vehicles.enter(session.player, forklift.id);
    for (let i = 0; i < 180 && forklift.position.wy > 37; i++)
      await session.step({ ...idle, dy: -0.35, relativeDriving: true });
    for (let i = 0; i < 35; i++) await session.step(idle);
    for (let i = 0; i < 105 && (chute.wz ?? 0) < 9; i++)
      await session.step({ ...idle, excavatorAction: "stick-out" });
    expect(
      chute.wz,
      JSON.stringify({ forklift: forklift.position, chute: chute.position }),
    ).toBeGreaterThan(7);
    const originalY = chute.position.wy;
    for (let i = 0; i < 25; i++) await session.step(idle);
    for (let i = 0; i < 200 && forklift.position.wy < 69; i++)
      await session.step({ ...idle, dy: 0.55, relativeDriving: true });
    expect(
      chute.position.wy,
      JSON.stringify({ forklift: forklift.position, chute: chute.position, z: chute.wz }),
    ).toBeGreaterThan(originalY + 22);
  } finally {
    await session.close();
  }
});

it("stages the two activities and their vehicles in a generated construction yard", async () => {
  const session = await ScenarioSession.create(constructionYardRecipe());
  try {
    for (let i = 0; i < 30; i++) await session.step(idle);
    const { id, vehicles } = constructionYardSite();
    const actors = session.realm.entityManager.entities;
    const deck = required(actors.find((e) => e.proceduralId === `${id}:seesaw:deck`));
    expect(deck.type).toBe(SEESAW);
    expect(deck.bodyRotation?.[1]).toBeLessThan(-0.05);
    expect(actors.find((e) => e.proceduralId === `${id}:marble:track`)?.type).toBe(MARBLE_TRACK);
    for (const role of ["marble-crane", "seesaw-car"]) {
      const placement = required(vehicles.find((v) => v.identity.endsWith(`:${role}`)));
      expect(actors.find((e) => e.proceduralId === placement.identity)?.type).toBe(
        `vehicle-v1:${placement.model}`,
      );
    }
  } finally {
    await session.close();
  }
});
