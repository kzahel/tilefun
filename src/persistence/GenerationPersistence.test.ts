import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  createDescriptor,
  type GenerationDescriptor,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import { Realm } from "../server/Realm.js";
import { Chunk } from "../world/Chunk.js";
import { FsPersistenceStore } from "./FsPersistenceStore.js";
import { FsWorldRegistry } from "./FsWorldRegistry.js";

it("filesystem worlds pin complete settings and restore edited terrain across realm and registry reloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-generation-"));
  const registry = new FsWorldRegistry(directory);
  const realm = new Realm([]);
  try {
    await registry.open();
    for (const choice of ["classic", "island", "flat", "regional"] as const) {
      const generation = createDescriptor(choice, 2026);
      const meta = await registry.createWorld(choice, undefined, undefined, undefined, generation);
      expect(meta.seed).toBeUndefined();
      expect(meta.worldType).toBeUndefined();
      const store = () =>
        new FsPersistenceStore(join(directory, meta.id), ["meta", "chunks", "players"]);
      await realm.loadWorld(meta.id, registry, store);
      expect(realm.generation).toEqual(generation);
      const edit = new Chunk();
      edit.subgrid.fill(TerrainId.DirtWarm);
      edit.roadGrid.fill(2);
      const persistence = store();
      await persistence.open();
      await persistence.save([
        {
          collection: "chunks",
          key: "-1,2",
          value: { subgrid: edit.subgrid.buffer, roadGrid: edit.roadGrid.buffer },
        },
        {
          collection: "meta",
          key: "state",
          value: {
            playerX: 0,
            playerY: 0,
            cameraX: 0,
            cameraY: 0,
            cameraZoom: 1,
            entities: [],
            nextEntityId: 1,
          },
        },
      ]);
      registry.close();
      await registry.open();
      expect((await registry.getWorld(meta.id))?.generation).toEqual(generation);
      await realm.loadWorld(meta.id, registry, store);
      expect(realm.world.getChunk(-1, 2).subgrid).toEqual(edit.subgrid);
      expect(realm.world.getChunk(-1, 2).roadGrid).toEqual(edit.roadGrid);
      expect(realm.generation).toEqual(generation);
    }
    const before = (await registry.listWorlds()).length;
    await expect(
      registry.createWorld("bad", undefined, undefined, undefined, {
        ...createDescriptor("regional", 2026),
        version: "future",
      } as unknown as GenerationDescriptor),
    ).rejects.toThrow();
    expect((await registry.listWorlds()).length).toBe(before);
  } finally {
    realm.destroy();
    registry.close();
    await rm(directory, { recursive: true, force: true });
  }
});
it("authority resolves an omitted seed once and a resolved descriptor requires no random source", () => {
  let calls = 0;
  const descriptor = resolveCreation({ choice: "regional" }, () => {
    calls++;
    return 17;
  });
  expect(descriptor.seed).toBe(17);
  expect(
    resolveCreation(descriptor, () => {
      calls++;
      return 99;
    }),
  ).toEqual(descriptor);
  expect(calls).toBe(1);
});

it("deleting a parent removes only its own persisted interior instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-interior-cleanup-"));
  const registry = new FsWorldRegistry(directory);
  try {
    await registry.open();
    const parent = await registry.createWorld("Parent"),
      other = await registry.createWorld("Other");
    const child = join(directory, "worlds", `interior~${parent.id}~settlement%3A0%3A0~0`);
    const unrelated = join(directory, "worlds", `interior~${other.id}~settlement%3A0%3A0~0`);
    await mkdir(child, { recursive: true });
    await mkdir(unrelated, { recursive: true });
    await registry.deleteWorld(parent.id);
    await expect(access(child)).rejects.toThrow();
    await expect(access(unrelated)).resolves.toBeUndefined();
    expect((await registry.listWorlds()).map((w) => w.id)).toEqual([other.id]);
  } finally {
    registry.close();
    await rm(directory, { recursive: true, force: true });
  }
});
