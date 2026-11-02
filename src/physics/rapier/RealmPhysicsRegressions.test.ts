import { expect, it } from "vitest";
import { createBall } from "../../entities/Ball.js";
import { Direction } from "../../entities/Entity.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createPlayer } from "../../entities/Player.js";
import { FlatStrategy } from "../../generation/FlatStrategy.js";
import { FLAT_SCENARIO, scenarioWalls } from "../../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { surfaceProp } from "../../scenarios/WorldGeometryRecipe.js";
import { createVehicle } from "../../traffic/Vehicle.js";
import { World } from "../../world/World.js";
import { createCollisionWorld, prepareCharacterPhysics } from "../CharacterPhysics.js";
import { controlledCarMotion } from "../ControlledCarMotion.js";
import { getMovementPhysicsParams } from "../PlayerMovement.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("rejects a chassis rotation that sweeps into a wall", async () => {
  await prepareCharacterPhysics(3);
  const collision = createCollisionWorld(),
    world = new World(new FlatStrategy());
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) world.getChunk(x, y);
  const car = createVehicle("compact-1", 64, 64, Direction.Right);
  car.id = 1;
  car.vehicleHeading = 0;
  const desired = { ...car, position: { ...car.position }, vehicleHeading: Math.PI / 2 };
  try {
    const wall = scenarioWalls(0, 40, 128, 128)[0];
    if (!wall) throw Error("Missing wall");
    expect(
      controlledCarMotion(
        car,
        desired,
        0.1,
        world,
        [wall],
        [car],
        { ...getMovementPhysicsParams(), characterPhysics: 3 },
        collision,
        [],
      ),
    ).toBeUndefined();
  } finally {
    collision.dispose();
  }
});

it("commits car falling state on admitted commands without double stepping empty intervals", async () => {
  const deck = surfaceProp(
    { left: -64, top: 0, right: 96, bottom: 128 },
    { id: "deck", spaceId: "upper", z: 32, riseX: 0, riseY: 0, thickness: 8, connectsTo: [] },
  );
  const session = await ScenarioSession.create({
    version: 1,
    id: "falling-car",
    generation: FLAT_SCENARIO,
    props: [deck],
    player: createPlayer(0, 160),
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 64, facing: Direction.Right }],
    physics: { characterPhysics: 3 },
  });
  try {
    const car = session.realm.entityManager.entities.find((e) => e.type.startsWith("vehicle-v1:"));
    if (!car) throw Error("Missing car");
    car.wz = car.groundZ = 32;
    await session.command({ kind: "teleport", position: { wx: 32, wy: 64 }, z: 32 });
    await session.command({ kind: "enter-vehicle", entityId: car.id });
    let falling = false;
    for (let i = 0; i < 100; i++) {
      await session.step({ ...idle, dx: 1 }, 1 / 60);
      if (car.jumpVZ !== undefined) {
        falling = true;
        break;
      }
    }
    expect(falling).toBe(true);
    const before = car.wz ?? 0;
    const x = car.position.wx;
    session.tick(1 / 60);
    expect(car.position.wx).toBeCloseTo(x, 3);
    expect(car.wz).toBeCloseTo(before, 3);
    for (let i = 0; i < 45; i++) await session.step(idle, 1 / 60);
    expect(car.wz).toBeLessThan(before - 10);
    expect(car.wz).toBeCloseTo(0, 0);
    expect(car.jumpVZ).toBeUndefined();
  } finally {
    await session.close();
  }
});

it.each([false, true])(
  "bounces and reacts to a ball hit independently of NPC push eligibility (airborne=%s)",
  async (airborne) => {
    const npc = ENTITY_FACTORIES.person1?.(96, 32),
      ball = createBall(84, 32);
    if (!npc?.wanderAI) throw Error("Missing NPC");
    npc.wanderAI.timer = 100;
    if (airborne) {
      npc.wz = 4;
      npc.jumpVZ = 0;
    }
    ball.velocity = { vx: 90, vy: 0 };
    const session = await ScenarioSession.create({
      version: 1,
      id: `ball-contact-${airborne}`,
      generation: FLAT_SCENARIO,
      props: [],
      actors: [npc, ball],
      player: createPlayer(0, 64),
      physics: { characterPhysics: 3 },
    });
    try {
      const actor = session.realm.entityManager.entities.find((e) => e.type === "ball"),
        person = session.realm.entityManager.entities.find((e) => e.type === "person1");
      if (!actor || !person) throw Error("Missing actors");
      let bounce = false,
        reaction = false;
      for (let i = 0; i < 20; i++) {
        await session.step(idle, 1 / 60);
        bounce ||= (actor.velocity?.vx ?? 0) < -1;
        reaction ||= (person.wanderAI?.scaredTimer ?? 0) > 0;
      }
      expect(bounce).toBe(true);
      expect(reaction).toBe(true);
    } finally {
      await session.close();
    }
  },
);

it("rejects deferred apparatus commands before legacy collision/pose handlers run", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "exclusive-apparatus",
    generation: FLAT_SCENARIO,
    props: [],
    player: createPlayer(0, 0),
    physics: { characterPhysics: 3 },
  });
  try {
    expect(() => session.realm.vehicles.tow(session.player, 123, "attach")).toThrow(
      "not qualified for the Rapier realm proof",
    );
    expect(() => session.realm.vehicles.transporter(session.player, 123, "deploy")).toThrow(
      "not qualified for the Rapier realm proof",
    );
    expect(() => session.realm.vehicles.bed(session.player, 123, "load")).toThrow(
      "not qualified for the Rapier realm proof",
    );
  } finally {
    await session.close();
  }
});
