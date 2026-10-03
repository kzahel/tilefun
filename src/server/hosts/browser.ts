import { IdbPersistenceStore } from "../../persistence/IdbPersistenceStore.js";
import { dbNameForWorld, WorldRegistry } from "../../persistence/WorldRegistry.js";
import type { GameServerDeps } from "../GameServer.js";

export function browserServerDependencies(): GameServerDeps {
  return {
    registry: new WorldRegistry(),
    createStore: (id) => new IdbPersistenceStore(dbNameForWorld(id)),
  };
}
