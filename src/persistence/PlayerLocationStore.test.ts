import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { FsPersistenceStore } from "./FsPersistenceStore.js";
import { type PlayerLocation, PlayerLocationStore } from "./PlayerLocationStore.js";

it("orders complete location records, isolates profiles and reopens after a failed write and retry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tilefun-player-location-"));
  const store = new FsPersistenceStore(dir, ["players"]);
  const locations = new PlayerLocationStore(store);
  const location: PlayerLocation = {
    version: 1,
    realmId: "world-one",
    parentWorldId: "world-one",
    generation: createDescriptor("flat", 42),
    player: { x: 1, y: 2, cameraX: 1, cameraY: 2, cameraZoom: 1, gemsCollected: 3 },
  };
  try {
    await locations.save("one", location);
    vi.spyOn(store, "save").mockRejectedValueOnce(new Error("disk failed"));
    await expect(locations.save("one", { ...location, realmId: "failed" })).rejects.toThrow(
      "disk failed",
    );
    const first = locations.save("one", { ...location, realmId: "intermediate" });
    const second = locations.save("one", { ...location, realmId: "final" });
    await Promise.all([first, second, locations.save("two", location)]);
    const reopened = new PlayerLocationStore(new FsPersistenceStore(dir, ["players"]));
    expect(await reopened.load("one")).toEqual({ ...location, realmId: "final" });
    expect(await reopened.load("two")).toEqual(location);
    expect(await reopened.load("missing")).toBeNull();
    reopened.close();
  } finally {
    locations.close();
    await rm(dir, { recursive: true, force: true });
  }
});
