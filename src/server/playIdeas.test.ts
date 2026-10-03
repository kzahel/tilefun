import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { IDEA_IMAGE_LIMIT } from "../ideas/PlayIdea.js";
import { PlayIdeasService, parseIdea } from "./playIdeas.js";
import { WorkshopAuth } from "./workshopAuth.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const submission = () => ({
  id: randomUUID(),
  text: "I want to go inside the tent",
  language: "en-US",
  screenshot: png,
  context: {
    worldId: "world-test",
    generation: "{}",
    x: 12,
    y: 24,
    build: "test",
    capturedAt: new Date().toISOString(),
  },
});
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-ideas-"));
  // Direct loopback is the owner; a forwarded/public request must authenticate.
  const auth = new WorkshopAuth(join(directory, "auth"), undefined, true);
  let service = new PlayIdeasService(join(directory, "play-ideas"), auth);
  const server = createServer((req, res) => {
    void service.handle(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const origin = `http://127.0.0.1:${address.port}`;
  cleanups.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const request = (
    method = "GET",
    suffix = "",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(`${origin}/tilefun/api/play-ideas${suffix}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-Workshop-CSRF": "local",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return {
    request,
    directory,
    restart: () => {
      service = new PlayIdeasService(join(directory, "play-ideas"), auth);
    },
  };
}
it("allows public submission but protects list, pictures, status and deletion", async () => {
  const f = await fixture(),
    idea = submission(),
    publicHeaders = { "X-Forwarded-Host": "public.example" };
  expect((await f.request("POST", "", idea, publicHeaders)).status).toBe(200);
  for (const [method, suffix, body] of [
    ["GET", "", undefined],
    ["GET", `/${idea.id}`, undefined],
    ["PATCH", `/${idea.id}`, { status: "done" }],
    ["DELETE", `/${idea.id}`, undefined],
  ] as const) {
    expect((await f.request(method, suffix, body, publicHeaders)).status).toBe(401);
  }
  expect(
    (await f.request("POST", "", submission(), { Origin: "https://elsewhere.example" })).status,
  ).toBe(403);
  expect((await f.request("POST", "", submission(), { Origin: "" })).status).toBe(403);
  expect(
    (await f.request("PATCH", `/${idea.id}`, { status: "done" }, { "X-Workshop-CSRF": "" })).status,
  ).toBe(403);
});
it("persists exact text and context, deduplicates concurrent retries and retains owner status across restart", async () => {
  const f = await fixture(),
    idea = submission();
  const responses = await Promise.all([
    f.request("POST", "", { ...idea, audio: "must not persist" }),
    f.request("POST", "", idea),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect((await f.request("POST", "", { ...idea, text: "different" })).status).toBe(409);
  expect((await f.request("PATCH", `/${idea.id}`, { status: "planned" })).status).toBe(200);
  f.restart();
  expect((await f.request("POST", "", idea)).status).toBe(200);
  const saved = await (await f.request("GET", `/${idea.id}`)).json();
  expect(saved).toMatchObject({ ...idea, status: "planned" });
  expect(saved).not.toHaveProperty("audio");
  const list = await (await f.request()).json();
  expect(list.total).toBe(1);
  expect(list.ideas[0]).not.toHaveProperty("screenshot");
  expect((await readdir(join(f.directory, "play-ideas"))).length).toBe(1);
  expect((await f.request("DELETE", `/${idea.id}`)).status).toBe(200);
  expect((await f.request("GET", `/${idea.id}`)).status).toBe(404);
});
it("rejects malformed, oversized and non-image payloads without persisting them", async () => {
  const f = await fixture();
  for (const value of [
    null,
    {},
    { ...submission(), text: " " },
    { ...submission(), text: "x".repeat(2001) },
    { ...submission(), screenshot: "data:image/svg+xml,<svg/>" },
    { ...submission(), screenshot: `data:image/png;base64,${"a".repeat(IDEA_IMAGE_LIMIT)}` },
    { ...submission(), context: { ...submission().context, x: "12" } },
  ]) {
    expect((await f.request("POST", "", value)).status).toBe(400);
  }
  expect((await (await f.request()).json()).total).toBe(0);
  expect(() => parseIdea({ ...submission(), id: "../../escape" })).toThrow();
});
it("limits anonymous submission attempts", async () => {
  const f = await fixture(),
    idea = submission();
  for (let i = 0; i < 10; i++) expect((await f.request("POST", "", idea)).status).toBe(200);
  const limited = await f.request("POST", "", idea);
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("60");
  expect((await (await f.request()).json()).total).toBe(1);
});

it("refuses additional files when the inbox reaches capacity", async () => {
  const f = await fixture();
  const directory = join(f.directory, "play-ideas");
  await mkdir(directory);
  await Promise.all(
    Array.from({ length: 500 }, async () => {
      const idea = submission();
      await writeFile(
        join(directory, `${idea.id}.json`),
        JSON.stringify({ ...idea, status: "new", createdAt: new Date().toISOString() }),
      );
    }),
  );
  expect((await f.request("POST", "", submission())).status).toBe(413);
  expect((await readdir(directory)).length).toBe(500);
});
