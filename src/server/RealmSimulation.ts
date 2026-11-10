import type { Entity } from "../entities/Entity.js";
import { tickSharedBallGameplay } from "../physics/BallGameplay.js";
import { rotationsEqual } from "../physics/BodyRotation.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import type { PhysicsScene } from "../physics/PhysicsScene.js";
import { isTrain } from "../railway/Train.js";
import type { WorkContext } from "../wildlife/AnimalWorkSystem.js";
import { tickFoodSources } from "../wildlife/FoodGrowth.js";
import { resolvePredatorCatches } from "../wildlife/predatorAI.js";
import { runOverSmallAnimals } from "../wildlife/Roadkill.js";
import { tickWildlifeRespawns } from "../wildlife/WildlifeRespawns.js";
import type { Realm } from "./Realm.js";

/** Last bed angle marked durable per vehicle; the step owns the clock, not a command. */
const persistedBedTilts = new WeakMap<Entity, number>();

type GameplayRealm = Pick<
  Realm,
  | "entityManager"
  | "animalWork"
  | "vehicleRegistry"
  | "vehicles"
  | "world"
  | "ownedBalls"
  | "records"
  | "worldAPI"
>;

/** Post-physics gameplay: catches, car persistence, food, ball contacts and mod hooks. */
export function resolveSimulationGameplay(
  realm: GameplayRealm,
  active: Entity[],
  awake: Entity[],
  participants: Entity[],
  entityTickDts: ReadonlyMap<Entity, number>,
  work: WorkContext,
  scene: PhysicsScene,
) {
  const stepDt = PHYSICS_DT;
  const wildlifeEnvironment = work.environment;
  const workPlayers = work.players;
  const workReady = work.ready;
  const playerPositions = workPlayers.map((p) => p.entity.position);
  tickWildlifeRespawns(realm.entityManager, stepDt, wildlifeEnvironment, playerPositions);
  resolvePredatorCatches(realm.entityManager, active, wildlifeEnvironment, playerPositions);
  realm.animalWork.resolveCatches(active, {
    environment: wildlifeEnvironment,
    players: workPlayers,
    ready: workReady,
  });

  // Route/parking clocks no longer own poses. Persist shared readback for cars.
  for (const e of participants) {
    const car = realm.vehicleRegistry?.states.get(e.id);
    if (!car) continue;
    if (
      e.position.wx !== e.prevPosition?.wx ||
      e.position.wy !== e.prevPosition?.wy ||
      e.wz !== e.prevWz ||
      e.vehicleHeading !== e.prevVehicleHeading ||
      !rotationsEqual(e.bodyRotation, e.prevBodyRotation) ||
      (persistedBedTilts.get(e) ?? 0) !== (e.vehicleBedTilt ?? 0)
    ) {
      persistedBedTilts.set(e, e.vehicleBedTilt ?? 0);
      realm.vehicleRegistry?.onChange?.(car, false);
    }
  }
  realm.vehicles.sync();

  tickFoodSources(realm.entityManager, entityTickDts, wildlifeEnvironment, workReady);

  // Contacts trigger gameplay; they never run another ball integration.
  tickSharedBallGameplay(realm.entityManager, participants, scene, (x, y) =>
    realm.world.getCollisionIfLoaded(x, y),
  );
  runOverSmallAnimals(
    realm.entityManager,
    participants.filter(
      (e) => isTrain(e) || realm.vehicleRegistry?.states.get(e.id)?.driverId !== undefined,
    ),
    scene,
  );
  // A napping animal carries nothing and is no toy: only simulated actors need posing.
  realm.animalWork.syncAll(awake);
  realm.ownedBalls.sync(awake);

  // Continuous motion/AI state reaches storage through the RealmRecords sweep (234).
  // ── TickService.postSimulation ──
  realm.worldAPI.tick.firePost(stepDt);

  // ── TagService removal detection ──
  realm.worldAPI.tags.tick();

  // ── OverlapService detection ──
  realm.worldAPI.overlap.tick();
}
