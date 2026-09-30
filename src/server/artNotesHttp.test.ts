import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type ArtCatalog, required } from "../art/ArtCatalog.js";
import { ArtNoteStore, artNotesHandler } from "./artNotesHttp.js";

const catalog = JSON.parse(readFileSync("public/data/art-catalog.json", "utf8")) as ArtCatalog;
const sheet = required(catalog.sheets[0]);
const row = {
  id: "n-1",
  threadId: "t-1",
  sheetId: sheet.id,
  fingerprint: sheet.fingerprint,
  sheetSize: [sheet.width, sheet.height],
  rect: [0, 0, 16, 16],
  sliceKeys: [],
  intent: "building",
  status: "pending",
  note: "Apartments",
  reply: "",
  createdAt: "2026-09-30T12:00:00Z",
};
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function store() {
  const dir = await mkdtemp(join(tmpdir(), "tilefun-art-"));
  directories.push(dir);
  return new ArtNoteStore(dir);
}
describe("machine art note inbox", () => {
  it("serializes concurrent writes, deduplicates retries, and survives a new store", async () => {
    const s = await store();
    await Promise.all([
      s.append(row),
      s.append(row),
      s.append({ ...row, id: "n-2", threadId: "t-2" }),
    ]);
    const restored = new ArtNoteStore(s.directory);
    expect(await restored.records()).toHaveLength(2);
    await restored.append({
      ...row,
      id: "n-3",
      status: "resolved",
      reply: "Implemented in rowhouse kit",
    });
    expect((await restored.records()).at(-1)?.reply).toContain("rowhouse kit");
  });
  it("rejects retargeting or conflicting retry IDs without poisoning subsequent saves", async () => {
    const s = await store();
    await s.append(row);
    await expect(s.append({ ...row, id: "n-2", rect: [16, 0, 16, 16] })).rejects.toThrow(
      "selection cannot change",
    );
    await expect(s.append({ ...row, note: "Different" })).rejects.toThrow("already exists");
    await s.append({ ...row, id: "n-3", status: "resolved" });
    expect(await s.records()).toHaveLength(2);
  });
  it("serves latest thread states and enforces same-origin writes", async () => {
    const s = await store();
    const handle = artNotesHandler(s);
    const server = createServer(
      (req, res) =>
        void handle(req, res).then((handled) => {
          if (!handled) {
            res.statusCode = 404;
            res.end();
          }
        }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test address");
    const base = `http://127.0.0.1:${address.port}`,
      url = `${base}/tilefun/api/art-notes`;
    try {
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "https://another.example" },
            body: JSON.stringify(row),
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: base },
            body: JSON.stringify(row),
          })
        ).status,
      ).toBe(200);
      await s.append({ ...row, id: "n-2", status: "resolved" });
      const response = await fetch(url);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject([{ threadId: "t-1", status: "resolved" }]);
      expect((await fetch(url, { method: "DELETE" })).status).toBe(405);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("preserves building review context through replies and rejects retargeting and unsafe links", async () => {
    const s = await store();
    const buildingReview = {
      scene: "mixed",
      prefabIds: ["prop-city-v1-bakery-3"],
      revision: "a".repeat(64),
      url: "/tilefun/building-lab.html?scene=mixed&prefab=prop-city-v1-bakery-3",
    };
    await s.append({ ...row, buildingReview });
    await s.append({
      ...row,
      buildingReview,
      id: "reply-1",
      reply: "Reviewing the shop sign",
      status: "in-progress",
    });
    expect((await s.records()).at(-1)?.buildingReview).toEqual(buildingReview);
    await expect(
      s.append({ ...row, id: "reply-2", buildingReview: { ...buildingReview, scene: "hotel" } }),
    ).rejects.toThrow("selection cannot change");
    await expect(
      s.append({
        ...row,
        id: "bad-url",
        threadId: "bad-url",
        buildingReview: { ...buildingReview, url: "javascript:alert(1)" },
      }),
    ).rejects.toThrow("Invalid building review");
  });
});
