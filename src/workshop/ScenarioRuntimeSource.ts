import predictor from "../client/PlayerPredictor.ts?raw";
import movement from "../entities/EntityManager.ts?raw";
import gravity from "../physics/Gravity.ts?raw";
import physicalEdits from "../physics/PhysicalEdits.ts?raw";
import physicsBodies from "../physics/PhysicsBodies.ts?raw";
import physicsDefaults from "../physics/PhysicsDefaults.ts?raw";
import physics from "../physics/PhysicsScene.ts?raw";
import physicsState from "../physics/PhysicsState.ts?raw";
import controls from "../physics/PlayerControls.ts?raw";
import clippedTerrain from "../physics/rapier/ClippedTerrain.ts?raw";
import collisionGeometry from "../physics/rapier/CollisionGeometry.ts?raw";
import client from "../scenarios/ScenarioClient.ts?raw";
import presentation from "../scenarios/ScenarioPresentationHost.ts?raw";
import protocol from "../scenarios/ScenarioProtocol.ts?raw";
import replica from "../scenarios/ScenarioReplica.ts?raw";
import session from "../scenarios/ScenarioSession.ts?raw";
import worker from "../scenarios/ScenarioWorkerHost.ts?raw";
import entry from "../scenarios/scenario.worker.ts?raw";
import realm from "../server/Realm.ts?raw";
import realmWildlife from "../server/RealmWildlife.ts?raw";
import clock from "../server/ServerLoop.ts?raw";
import physicsCodec from "../shared/physicsStateCodec.ts?raw";
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
  physics,
  physicsState,
  physicalEdits,
  physicsBodies,
  realmWildlife,
  physicsDefaults,
  gravity,
  controls,
  predictor,
  physicsCodec,
  replica,
  collisionGeometry,
  clippedTerrain,
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
