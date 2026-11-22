import { expect, it } from "vitest";
import { CONSTRUCTION_CRATE, CONSTRUCTION_PALLET } from "../entities/ConstructionCargo.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import { FLATBED, isFlatbed, onFlatbed } from "../traffic/Flatbed.js";
import { forkliftRig, isForklift } from "../traffic/Forklift.js";
import { constructionYardRecipe, constructionYardSite } from "./ConstructionYardRecipe.js";
import { forkliftYardRecipe } from "./ForkliftYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const steering = { ...idle, relativeDriving: true };
const height = (e: Entity) => e.wz ?? 0;

function controls(session: ScenarioSession, forklift: Entity) {
  const wait = async (ticks: number) => {
    for (let i = 0; i < ticks; i++) await session.step(idle);
  };
  const rig = () => forkliftRig(forklift.vehicleExcavator);
  const work = async (excavatorAction: ExcavatorAction, target: () => boolean) => {
    for (let i = 0; i < 180 && !target(); i++) await session.step({ ...idle, excavatorAction });
    expect(
      target(),
      JSON.stringify({ excavatorAction, rig: rig(), forklift: forklift.position, z: forklift.wz }),
    ).toBe(true);
    await wait(25);
  };
  const drive = async (target: () => boolean, dy: number) => {
    for (let i = 0; i < 560 && !target(); i++) await session.step({ ...steering, dy });
    expect(
      target(),
      JSON.stringify({ forklift: forklift.position, z: forklift.wz, speed: forklift.velocity }),
    ).toBe(true);
    await wait(45);
  };
  return { wait, rig, work, drive };
}

it("inserts the physical tines and deposits a pallet on the flatbed", async () => {
  const session = await ScenarioSession.create(forkliftYardRecipe());
  try {
    const entity = session.realm.entityManager.entities;
    const forklift = required(entity.find(isForklift));
    const pallet = required(
      entity.find((e) => e.type === CONSTRUCTION_PALLET && e.position.wy === 0),
    );
    const flatbed = required(entity.find(isFlatbed));
    const { drive, work, rig, wait } = controls(session, forklift);
    await wait(55);
    session.realm.vehicles.enter(session.player, forklift.id);
    await drive(() => forklift.position.wx >= -83, -0.35);
    expect(pallet.position.wx).toBeCloseTo(-51, 0);
    await work("stick-out", () => rig().lift >= 26);
    expect(height(pallet)).toBeGreaterThan(FLATBED.floor + 2);
    await work("boom-up", () => rig().tilt >= 0.045);
    await drive(() => pallet.position.wx >= 42, -0.42);
    await work("boom-down", () => rig().tilt <= 0.025);
    await work("stick-in", () => rig().lift <= 22);
    await drive(() => forklift.position.wx <= -26, 0.6);
    expect(
      onFlatbed(flatbed, pallet),
      JSON.stringify({ pallet: pallet.position, z: pallet.wz, forks: rig() }),
    ).toBe(true);
    expect(forklift.vehicleCraneLoadId).toBeUndefined();
    const pose = forklift.vehicleExcavator;
    await session.reload();
    expect(session.realm.entityManager.entities.find(isForklift)?.vehicleExcavator).toBe(pose);
  } finally {
    await session.close();
  }
});

it("stacks a wooden crate on another crate", async () => {
  const recipe = forkliftYardRecipe();
  recipe.id = "forklift-stacking-test";
  recipe.player = createPlayer(-106, 72);
  required(recipe.parkedVehicles?.[0]).wy = 41;
  const session = await ScenarioSession.create(recipe);
  try {
    const entity = session.realm.entityManager.entities;
    const forklift = required(entity.find(isForklift));
    const crates = entity.filter((e) => e.type === CONSTRUCTION_CRATE);
    const load = required(crates.find((e) => e.position.wx < 0));
    const base = required(crates.find((e) => e.position.wx > 0));
    const { drive, work, rig, wait } = controls(session, forklift);
    await wait(55);
    session.realm.vehicles.enter(session.player, forklift.id);
    await drive(() => forklift.position.wx >= -84, -0.32);
    await work("stick-out", () => rig().lift >= 23);
    expect(height(load)).toBeGreaterThan(18);
    await drive(() => load.position.wx >= base.position.wx - 2, -0.33);
    await work("stick-in", () => rig().lift <= 19);
    await drive(() => forklift.position.wx <= -35, 0.55);
    expect(height(load) - height(base)).toBeCloseTo(18, 0);
    expect(Math.abs(load.position.wx - base.position.wx)).toBeLessThan(9);
  } finally {
    await session.close();
  }
});

it("lifts the waiting pallet in the generated construction yard", async () => {
  const yard = constructionYardSite();
  const parked = required(yard.vehicles.find((v) => v.model === "forklift"));
  const recipe = constructionYardRecipe();
  recipe.id = "regional-forklift-test";
  recipe.player = createPlayer(parked.wx, parked.wy + 33);
  const session = await ScenarioSession.create(recipe);
  try {
    const actors = session.realm.entityManager.entities;
    const forklift = required(actors.find((e) => e.proceduralId === parked.identity));
    const pallet = required(actors.find((e) => e.proceduralId === `${yard.id}:forklift:pallet`));
    const { drive, rig, wait, work } = controls(session, forklift);
    await wait(55);
    session.realm.vehicles.enter(session.player, forklift.id);
    await drive(() => forklift.position.wx >= parked.wx + 27, -0.35);
    await work("stick-out", () => rig().lift >= 15);
    expect(height(pallet)).toBeGreaterThan(12);
  } finally {
    await session.close();
  }
});
