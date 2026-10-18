import movement from "../entities/EntityManager.ts?raw";
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

/** Live behavior reviews include host timing/transport, not just recipe/physics. */
export const scenarioRuntimeSource = {
  generation,
  predatorAI,
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
