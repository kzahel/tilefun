import { expect, it } from "vitest";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { RecordingBackend } from "./testing/RecordingBackend.js";

it("keeps review terrain identities scoped to their owner, assets and chunk revision", () => {
  const a = new RecordingBackend(new Map()),
    b = new RecordingBackend(new Map());
  const world = new World(),
    chunk = new Chunk(),
    camera = new Camera();
  camera.setViewport(256, 256);
  world.chunks.put(0, 0, chunk);
  const prepare = (r: RecordingBackend) =>
    r.prepareTerrain(camera, world, camera.getVisibleChunkRange());
  prepare(a);
  prepare(b);
  const id = a.resourceId(chunk, 0, 0),
    uploads = a.uploads;
  expect(id).not.toBeNull();
  expect(b.resourceId(chunk, 0, 0)).not.toBe(id);
  camera.x += 2;
  prepare(a);
  expect(a.uploads).toBe(uploads);
  chunk.invalidateVisuals();
  prepare(a);
  expect(a.resourceId(chunk, 0, 0)).not.toBe(id);
  const revised = a.resourceId(chunk, 0, 0);
  a.invalidateAssets();
  prepare(a);
  expect(a.resourceId(chunk, 0, 0)).not.toBe(revised);
  expect(b.hasTerrain(chunk)).toBe(true);
  const replacement = new Chunk();
  world.chunks.put(0, 0, replacement);
  prepare(a);
  expect(a.hasTerrain(chunk)).toBe(false);
  expect(a.hasTerrain(replacement)).toBe(true);
  a.dispose();
  a.dispose();
  expect(() => prepare(a)).toThrow("disposed");
});
