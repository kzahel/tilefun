import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { type ArtCatalog, required } from "./ArtCatalog.js";
import { ArtNoteInbox } from "./ArtNoteInbox.js";
import type { ArtNote } from "./ArtNotes.js";

const catalog = JSON.parse(readFileSync("public/data/art-catalog.json", "utf8")) as ArtCatalog;
afterEach(() => vi.unstubAllGlobals());
it("retains an acknowledged POST across a failed refresh and reload without sending it twice", async () => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key),
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  const sheet = required(catalog.sheets[0]);
  const row: ArtNote = {
    id: "note-1",
    threadId: "thread-1",
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    sheetSize: [sheet.width, sheet.height],
    rect: [0, 0, 16, 16],
    sliceKeys: [],
    intent: "building",
    status: "pending",
    note: "Roof gap",
    reply: "",
    createdAt: "2026-09-30T12:00:00Z",
  };
  let posts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts++;
        return new Response('{"saved":true}');
      }
      throw new Error("Offline after save");
    }),
  );
  const inbox = new ArtNoteInbox(catalog, "test-inbox");
  inbox.enqueue(row);
  await vi.waitFor(() => expect(inbox.status).toContain("Offline after save"));
  expect(inbox.outbox).toHaveLength(0);
  expect(inbox.notes).toEqual([row]);
  const restored = new ArtNoteInbox(catalog, "test-inbox");
  await restored.sync();
  expect(restored.notes).toEqual([row]);
  expect(posts).toBe(1);
});
