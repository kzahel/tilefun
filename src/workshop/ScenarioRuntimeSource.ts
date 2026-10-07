import client from "../scenarios/ScenarioClient.ts?raw";
import presentation from "../scenarios/ScenarioPresentationHost.ts?raw";
import protocol from "../scenarios/ScenarioProtocol.ts?raw";
import session from "../scenarios/ScenarioSession.ts?raw";
import worker from "../scenarios/ScenarioWorkerHost.ts?raw";
import entry from "../scenarios/scenario.worker.ts?raw";
import clock from "../server/ServerLoop.ts?raw";
import channel from "../transport/OrderedWorkerChannel.ts?raw";

/** Live behavior reviews include host timing/transport, not just recipe/physics. */
export const scenarioRuntimeSource = {
  generation,
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
