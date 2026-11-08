import { createDescriptor } from "../../generation/GenerationDescriptor.js";
import type { IWorldRegistry, WorldMeta } from "../../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../../persistence/RecordPersistenceStore.js";
import { SAVE_FORMAT } from "../../persistence/SaveFormat.js";
import { LocalTransport } from "../../transport/LocalTransport.js";
import type { IServerTransport } from "../../transport/Transport.js";
import { GameServer } from "../GameServer.js";

/** A server transport whose "local" connection the helper connects after startup. */
interface MemoryTransport {
  readonly serverSide: IServerTransport;
  triggerConnect(): void;
}

/**
 * Normal asynchronous startup, with one disposable flat world and memory storage.
 * Pass `MemoryConnections` for several device connections through the binary codec.
 */
export async function memoryServer(): Promise<{ server: GameServer; transport: LocalTransport }>;
export async function memoryServer<T extends MemoryTransport>(
  transport: T,
): Promise<{ server: GameServer; transport: T }>;
export async function memoryServer(transport: MemoryTransport = new LocalTransport()) {
  const world: WorldMeta = {
    id: "test",
    name: "Test",
    worldType: "flat",
    seed: 42,
    createdAt: 0,
    lastPlayedAt: 0,
    saveFormat: SAVE_FORMAT,
    generation: createDescriptor("flat", 42),
  };
  const registry: IWorldRegistry = {
    async open() {},
    close() {},
    async listWorlds() {
      return [world];
    },
    async getWorld(id) {
      return id === world.id ? world : undefined;
    },
    async createWorld() {
      throw Error("Unexpected world creation");
    },
    async updateLastPlayed() {},
    async renameWorld() {},
    async deleteWorld() {},
  };
  const stores = new Map<string, RecordPersistenceStore>();
  const server = new GameServer(transport.serverSide, {
    registry,
    createStore: (id) => {
      let store = stores.get(id);
      if (!store) {
        store = new RecordPersistenceStore(new MemoryRecordStore());
        stores.set(id, store);
      }
      return store;
    },
  });
  await server.init();
  transport.triggerConnect();
  await server.settle();
  // These tests create their own actors; normal flat generation adds two chickens.
  for (const e of [...server.entityManager.entities])
    if (e.type !== "player") server.entityManager.remove(e.id);

  return { server, transport };
}
