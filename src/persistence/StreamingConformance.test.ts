import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { SqlitePersistenceStore } from "./SqlitePersistenceStore.js";
import { streamingConformance } from "./StreamingConformance.js";

it("runs sustained travel and semantic restart through the real SQLite adapter", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-streaming-sqlite-"));
  try {
    const result = await streamingConformance(() => new SqlitePersistenceStore(directory));
    expect(result).toMatchObject({
      chunksVisited: 1000,
      maxActors: 1,
      maxChunks: 1,
      maxFeatures: 1,
      attachments: true,
      deletions: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
