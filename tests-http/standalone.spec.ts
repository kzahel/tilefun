import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WebSocket } from "ws";
import type { ArtCatalog } from "../src/art/ArtCatalog.js";
import { decodeServerMessage, encodeClientMessage } from "../src/shared/binaryCodec.js";
import type { ServerMessage } from "../src/shared/protocol.js";
import { WORKSHOP_TOOLS } from "../src/workshop/ToolRegistry.js";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";
import { expect, password, test } from "./standalone.fixture.js";

test("standalone serves every current Workshop destination as HTML", async ({
  standalone: { api },
}) => {
  for (const url of new Set(
    ["tools.html", ...WORKSHOP_TOOLS.map((tool) => tool.url)].map((url) => url.split("#")[0]),
  )) {
    const response = await api.get(`/tilefun/${url}`);
    expect(response.ok(), url).toBe(true);
    expect(response.headers()["content-type"], url).toContain("text/html");
  }
});

test("standalone protects both compatibility APIs and persists exact writes into the inbox and filesystem", async ({
  standalone: { api, directory },
}) => {
  expect((await api.get("/tilefun/api/art-notes")).status()).toBe(401);
  expect((await api.post("/tilefun/api/interior-review", { data: {} })).status()).toBe(401);
  expect(
    (
      await api.post("/tilefun/api/workshop/events", {
        data: { id: crypto.randomUUID(), type: "asset" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await api.post("/tilefun/api/auth/login", { data: { username: "owner", password } })).ok(),
  ).toBe(true);
  expect(
    (
      await api.post("/tilefun/api/workshop/events", {
        data: { id: crypto.randomUUID(), type: "scene" },
      })
    ).status(),
  ).toBe(403);
  const session = await (await api.get("/tilefun/api/auth/session")).json();
  const headers = { "X-Workshop-CSRF": session.csrfToken };
  expect((await (await api.get("/tilefun/api/workshop/inbox")).json()).manifestCurrent).toBe(true);
  const manifest = JSON.parse(
    await readFile("public/data/workshop-manifest.json", "utf8"),
  ) as WorkshopManifest;
  const room = manifest.candidates.find(
    (candidate) => candidate.kind === "interior" && !candidate.excluded,
  );
  if (!room?.interior) throw new Error("No room fixture");
  const interior = {
    ...room.interior,
    id: "standalone-room",
    createdAt: new Date().toISOString(),
    verdict: "wrong",
    note: "Standalone compatibility",
  };
  expect(
    (await api.post("/tilefun/api/interior-review", { headers, data: interior })).status(),
  ).toBe(200);
  const catalog = JSON.parse(await readFile("public/data/art-catalog.json", "utf8")) as ArtCatalog;
  const sheet = catalog.sheets[0];
  if (!sheet) throw new Error("No source sheet");
  const note = {
    id: "standalone-source",
    threadId: "standalone-source",
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    sheetSize: [sheet.width, sheet.height],
    rect: [0, 0, 16, 16],
    sliceKeys: [],
    intent: "building",
    status: "pending",
    note: "Standalone source",
    reply: "",
    createdAt: new Date().toISOString(),
  };
  expect((await api.post("/tilefun/api/art-notes", { headers, data: note })).status()).toBe(200);
  expect(await (await api.get("/tilefun/api/art-notes")).json()).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: note.id, note: note.note })]),
  );
  const inbox = await (await api.get("/tilefun/api/workshop/inbox")).json();
  expect(inbox.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: `interior:${room.id}`, note: interior.note }),
    ]),
  );
  expect(await readFile(join(directory, "art-notes/notes.ndjson"), "utf8")).toContain(note.note);
  expect(await readFile(join(directory, "interior-review/feedback.ndjson"), "utf8")).toContain(
    interior.note,
  );
});

test("standalone binary WebSocket administration rejects guests and preserves the authorized value", async ({
  standalone: { baseURL, adminToken },
}) => {
  const connect = async () => {
    const ws = new WebSocket(`${baseURL.replace("http:", "ws:")}/?uuid=${crypto.randomUUID()}`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    return ws;
  };
  const sockets: WebSocket[] = [];
  try {
    const admin = await connect();
    sockets.push(admin);
    const guest = await connect();
    sockets.push(guest);
    const command = (socket: WebSocket, requestId: number, text: string, token?: string) =>
      new Promise<ServerMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.off("message", receive);
          reject(new Error("No rcon response"));
        }, 5000);
        const receive = (data: import("ws").RawData) => {
          const bytes = data as Buffer;
          const message = decodeServerMessage(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
          );
          if ("requestId" in message && message.requestId === requestId) {
            clearTimeout(timer);
            socket.off("message", receive);
            resolve(message);
          }
        };
        socket.on("message", receive);
        socket.send(
          encodeClientMessage({
            type: "rcon",
            requestId,
            command: text,
            ...(token ? { adminToken: token } : {}),
          }),
        );
      });
    expect(await command(admin, 1, "sv_speed 2", adminToken)).toMatchObject({
      type: "rcon-response",
      output: expect.arrayContaining([expect.stringContaining("2")]),
    });
    expect(await command(guest, 2, "sv_speed 99")).toMatchObject({
      type: "request-error",
      message: expect.stringContaining("requires an admin token"),
    });
    expect(await command(admin, 3, "sv_speed", adminToken)).toMatchObject({
      type: "rcon-response",
      output: expect.arrayContaining([expect.stringContaining("2")]),
    });
  } finally {
    for (const socket of sockets) socket.terminate();
  }
});
