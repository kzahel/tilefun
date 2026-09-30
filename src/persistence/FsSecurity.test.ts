import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsPersistenceStore } from "./FsPersistenceStore.js";
import { FsWorldRegistry } from "./FsWorldRegistry.js";
import { worldDirectory } from "./fsPaths.js";

describe("filesystem containment", () => {
  let directory: string;
  let data: string;
  let registry: FsWorldRegistry;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "tilefun-security-"));
    data = join(directory, "data");
    registry = new FsWorldRegistry(data);
    await registry.open();
  });
  afterEach(async () => {
    registry.close();
    await rm(directory, { recursive: true, force: true });
  });

  it.each(["../sentinel", "..", "", "/tmp", "..\\sentinel", "C:\\sentinel", "unknown"])(
    "rejects deletion of unregistered or unsafe ID %j without changing metadata or files",
    async (id) => {
      const world = await registry.createWorld("Keep");
      const sentinel = join(data, "sentinel");
      await mkdir(sentinel);
      await writeFile(join(sentinel, "keep.txt"), "keep");
      const metadata = await readFile(join(data, "registry.json"), "utf8");
      await expect(registry.deleteWorld(id)).rejects.toThrow();
      expect(await readFile(join(data, "registry.json"), "utf8")).toBe(metadata);
      expect(await readFile(join(sentinel, "keep.txt"), "utf8")).toBe("keep");
      expect(await registry.getWorld(world.id)).toBeDefined();
    },
  );

  it("deletes a registered world and retains unrelated storage", async () => {
    const world = await registry.createWorld("Delete");
    const other = await registry.createWorld("Keep");
    const path = worldDirectory(data, world.id);
    const otherPath = worldDirectory(data, other.id);
    await mkdir(path, { recursive: true });
    await mkdir(otherPath, { recursive: true });
    await registry.deleteWorld(world.id);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(otherPath)).toBe(true);
  });

  it("rejects symlink escapes when opening a world or accessing a collection", async () => {
    const outside = join(directory, "outside");
    await mkdir(outside);
    await symlink(outside, join(data, "worlds"), "junction");
    expect(() => worldDirectory(data, "world-1")).toThrow(/Symlink/);
    const store = new FsPersistenceStore(data, ["players"]);
    await symlink(outside, join(data, "players"), "junction");
    await expect(store.open()).rejects.toThrow(/Symlink/);
    await expect(
      store.save([{ collection: "players", key: "profile", value: {} }]),
    ).rejects.toThrow();
    await expect(store.get("players", "profile")).rejects.toThrow();
  });

  it("rejects collections outside the configured set", async () => {
    const store = new FsPersistenceStore(data, ["players"]);
    await store.open();
    await expect(
      store.save([{ collection: "../outside", key: "profile", value: {} }]),
    ).rejects.toThrow();
    await expect(store.getAll("../outside")).rejects.toThrow();
  });
});
