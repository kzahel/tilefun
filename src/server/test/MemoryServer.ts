import {
  createDescriptor,
  type GenerationDescriptor,
} from "../../generation/GenerationDescriptor.js";
import type { IWorldRegistry, WorldMeta } from "../../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../../persistence/RecordPersistenceStore.js";
import { SAVE_FORMAT } from "../../persistence/SaveFormat.js";
import { LocalTransport } from "../../transport/LocalTransport.js";
import type { IServerTransport } from "../../transport/Transport.js";
import { GameServer } from "../GameServer.js";
import type { RealmDirectory } from "../RealmDirectory.js";

/** A server transport whose "local" connection the helper connects after startup. */
interface MemoryTransport {
  readonly serverSide: IServerTransport;
  triggerConnect(): void;
}

/** Another world to travel to: a flat one by id, or one with its own generator. */
type ExtraWorld = string | { id: string; generation: GenerationDescriptor };

/**
 * Normal asynchronous startup, with one disposable flat world and memory storage.
 * Pass `MemoryConnections` for several device connections through the binary codec,
 * and `worlds` for more worlds to travel to. `stores` holds each store by id.
 */
export async function memoryServer(): Promise<{
  server: GameServer;
  transport: LocalTransport;
  stores: ReadonlyMap<string, RecordPersistenceStore>;
}>;
export async function memoryServer<T extends MemoryTransport>(
  transport: T,
  options?: { worlds?: readonly ExtraWorld[] },
): Promise<{
  server: GameServer;
  transport: T;
  stores: ReadonlyMap<string, RecordPersistenceStore>;
}>;
export async function memoryServer(
  transport: MemoryTransport = new LocalTransport(),
  { worlds = [] }: { worlds?: readonly ExtraWorld[] } = {},
): Promise<{
  server: GameServer;
  transport: MemoryTransport;
  stores: ReadonlyMap<string, RecordPersistenceStore>;
}> {
  const meta = (id: string, generation = createDescriptor("flat", 42)): WorldMeta => ({
    id,
    name: id,
    worldType: "flat", // As `createWorld` records it; the generation descriptor decides.
    seed: generation.seed,
    createdAt: 0,
    lastPlayedAt: 0,
    saveFormat: SAVE_FORMAT,
    generation,
  });
  const metas = [
    { ...meta("test"), name: "Test" },
    ...worlds.map((w) => (typeof w === "string" ? meta(w) : meta(w.id, w.generation))),
  ];
  const registry: IWorldRegistry = {
    async open() {},
    close() {},
    async listWorlds() {
      return metas;
    },
    async getWorld(id) {
      return metas.find((world) => world.id === id);
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
  // These tests create their own actors; flat generation scatters chickens at random. The
  // extra flat worlds are therefore loaded (and emptied) here, before anyone travels to them.
  for (const e of [...server.entityManager.entities])
    if (e.type !== "player") server.entityManager.remove(e.id);
  const { realms } = server as unknown as { realms: RealmDirectory };
  for (const id of worlds.filter((w) => typeof w === "string")) {
    const { entityManager } = await realms.getOrCreate(id);
    for (const e of [...entityManager.entities]) entityManager.remove(e.id);
  }

  return { server, transport, stores };
}
