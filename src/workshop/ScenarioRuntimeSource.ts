import movement from "../entities/EntityManager.ts?raw";
import characterBudget from "../physics/CharacterMotionBudget.ts?raw";
import characterPhysics from "../physics/CharacterPhysics.ts?raw";
import controlledBall from "../physics/ControlledBallMotion.ts?raw";
import controlledCar from "../physics/ControlledCarMotion.ts?raw";
import characterLanding from "../physics/PlayerLanding.ts?raw";
import characterMovement from "../physics/PlayerMovement.ts?raw";
import characterContact from "../physics/rapier/CharacterContact.ts?raw";
import characterShape from "../physics/rapier/CharacterShape.ts?raw";
import clippedTerrain from "../physics/rapier/ClippedTerrain.ts?raw";
import collisionGeometry from "../physics/rapier/CollisionGeometry.ts?raw";
import characterBackend from "../physics/rapier/GameCharacterPhysics.ts?raw";
import persistentWorld from "../physics/rapier/PersistentCollisionWorld.ts?raw";
import client from "../scenarios/ScenarioClient.ts?raw";
import presentation from "../scenarios/ScenarioPresentationHost.ts?raw";
import protocol from "../scenarios/ScenarioProtocol.ts?raw";
import session from "../scenarios/ScenarioSession.ts?raw";
import worker from "../scenarios/ScenarioWorkerHost.ts?raw";
import entry from "../scenarios/scenario.worker.ts?raw";
import realm from "../server/Realm.ts?raw";
import clock from "../server/ServerLoop.ts?raw";
import channel from "../transport/OrderedWorkerChannel.ts?raw";
import fierceProfiles from "../wildlife/FierceCreatures.ts?raw";
import fierceDens from "../wildlife/FierceDens.ts?raw";
import foodWeb from "../wildlife/FoodWeb.ts?raw";
import predators from "../wildlife/Predator.ts?raw";
import predatorMotion from "../wildlife/PredatorMotion.ts?raw";
import predatorAI from "../wildlife/predatorAI.ts?raw";
import wildlifeRespawns from "../wildlife/WildlifeRespawns.ts?raw";

/** Live behavior reviews include host timing/transport, not just recipe/physics. */
export const scenarioRuntimeSource = {
  persistentWorld,
  collisionGeometry,
  controlledCar,
  controlledBall,
  characterPhysics,
  characterMovement,
  characterLanding,
  clippedTerrain,
  characterContact,
  characterBudget,
  characterBackend,
  characterShape,
  generation,
  predatorAI,
  wildlifeRespawns,
  predators,
  predatorMotion,
  fierceProfiles,
  fierceDens,
  foodWeb,
  movement,
  realm,
  client,
  presentation,
  protocol,
  session,
  worker,
  entry,
  clock,
  channel,
};

import generation from "../generation/Generator.ts?raw";
