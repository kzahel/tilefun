import type { ScenarioRequest } from "./ScenarioProtocol.js";
import { ScenarioWorkerHost } from "./ScenarioWorkerHost.js";

const host = new ScenarioWorkerHost();
self.onmessage = (event: MessageEvent<ScenarioRequest>) => {
  void host
    .request(event.data)
    .then((response) => self.postMessage(response, { transfer: response.frames }));
};
