import { describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index.js";

function setup() {
  const entries = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string) => {
    entries.set(key, value);
  });
  const list = vi.fn(async () => ({ keys: [...entries.keys()].map((name) => ({ name })) }));
  const env = {
    ROOMS: { put, list, get: async (key: string) => entries.get(key) ?? null },
  } as unknown as Env;
  const send = (
    body: unknown,
    peer = "peer-1",
    headers: Record<string, string> = { "Content-Type": "application/json" },
  ) =>
    worker.fetch(
      new Request(`https://rooms.test/rooms/${peer}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers,
      }),
      env,
    );
  return { entries, put, list, env, send };
}
const valid = { name: "Family", hostName: "Parent", playerCount: 2 };

describe("room directory validation", () => {
  it("stores only validated room fields with a short TTL", async () => {
    const { send, put } = setup();
    expect((await send({ ...valid, unexpected: "discard" })).status).toBe(200);
    expect(put).toHaveBeenCalledWith("peer-1", JSON.stringify(valid), { expirationTtl: 90 });
  });
  it.each([
    null,
    {},
    { ...valid, name: "" },
    { ...valid, name: "a".repeat(81) },
    { ...valid, hostName: "a".repeat(65) },
    { ...valid, playerCount: -1 },
    { ...valid, playerCount: 1.5 },
    { ...valid, playerCount: 65 },
  ])("rejects invalid room data %j without writing KV", async (body) => {
    const { send, put } = setup();
    expect((await send(body)).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
  it("bounds actual request bytes and rejects invalid IDs and media types", async () => {
    const { send, env, put } = setup();
    expect((await send(valid, "%ZZ")).status).toBe(400);
    expect((await send(valid, "%2foutside")).status).toBe(400);
    expect((await send(valid, "peer", {})).status).toBe(415);
    expect((await send({ ...valid, padding: "a".repeat(4096) })).status).toBe(413);
    expect(
      (
        await worker.fetch(
          new Request("https://rooms.test/rooms/peer", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: "{",
          }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
  it("bounds listing work, drops corrupt entries, and keeps the public CORS contract", async () => {
    const { entries, env, list } = setup();
    entries.set("good", JSON.stringify(valid));
    entries.set("bad", "{broken");
    entries.set("invalid", "{}");
    const response = await worker.fetch(new Request("https://rooms.test/rooms"), env);
    expect(list).toHaveBeenCalledWith({ limit: 100 });
    expect(await response.json()).toEqual([{ peerId: "good", ...valid }]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(
      (await worker.fetch(new Request("https://rooms.test/rooms", { method: "OPTIONS" }), env))
        .status,
    ).toBe(204);
  });
});
