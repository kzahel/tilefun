import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseFaultReport } from "../diagnostics/FaultReport.js";
import { FaultReportsService } from "./faultReports.js";
import { WorkshopAuth } from "./workshopAuth.js";

const submission = () => ({
  id: randomUUID(),
  kind: "fatal",
  capturedAt: new Date().toISOString(),
  message: "synthetic crash",
  stack: "Error: synthetic crash\n at test",
  build: "test",
  browser: "test browser",
  context: {
    mode: "local-worker",
    worldId: "world",
    generation: "{}",
    x: 1,
    y: 2,
    serverTick: 30,
    hidden: false,
  },
  events: [{ at: Date.now(), type: "request:join-realm" }],
  authority: null,
});
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-faults-"));
  // Direct loopback is the owner; a forwarded/public request must authenticate.
  const auth = new WorkshopAuth(join(directory, "auth"), undefined, true);
  let service = new FaultReportsService(join(directory, "fault-reports"), auth);
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
    fetch(`${origin}/tilefun/api/fault-reports${suffix}`, {
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
      service = new FaultReportsService(join(directory, "fault-reports"), auth);
    },
  };
}

it("accepts anonymous same-origin reports but protects owner reads and deletion", async () => {
  const f = await fixture(),
    r = submission(),
    publicHeaders = { "X-Forwarded-Host": "public.example" };
  expect((await f.request("POST", "", r, publicHeaders)).status).toBe(200);
  for (const [method, suffix] of [
    ["GET", ""],
    ["GET", `/${r.id}`],
    ["DELETE", `/${r.id}`],
  ])
    expect((await f.request(method, suffix, undefined, publicHeaders)).status).toBe(401);
  expect((await f.request("POST", "", r, { Origin: "https://elsewhere.example" })).status).toBe(
    403,
  );
  expect((await f.request("POST", "", r, { Origin: "" })).status).toBe(403);
  expect((await f.request("DELETE", `/${r.id}`, undefined, { "X-Workshop-CSRF": "" })).status).toBe(
    403,
  );
});
it("deduplicates concurrent retries, whitelists fields and retains reports across restart", async () => {
  const f = await fixture(),
    r = submission();
  const responses = await Promise.all([
    f.request("POST", "", {
      ...r,
      token: "secret",
      context: { ...r.context, playerName: "private" },
    }),
    f.request("POST", "", r),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect((await f.request("POST", "", { ...r, message: "changed" })).status).toBe(409);
  f.restart();
  const saved = await (await f.request("GET", `/${r.id}`)).json();
  expect(saved).toMatchObject(r);
  expect(saved).not.toHaveProperty("token");
  expect(saved.context).not.toHaveProperty("playerName");
  const list = await (await f.request()).json();
  expect(list.total).toBe(1);
  expect(list.reports[0]).not.toHaveProperty("stack");
  expect(await readdir(join(f.directory, "fault-reports"))).toHaveLength(1);
  expect((await f.request("DELETE", `/${r.id}`)).status).toBe(200);
  expect((await f.request("GET", `/${r.id}`)).status).toBe(404);
});
it("rejects invalid, oversized and traversal payloads and rate limits intake", async () => {
  const f = await fixture();
  for (const r of [
    null,
    {},
    { ...submission(), id: "../../escape" },
    { ...submission(), stack: "x".repeat(8001) },
    { ...submission(), events: Array(25).fill({ at: 1, type: "test" }) },
    { ...submission(), context: { ...submission().context, x: "oops" } },
  ])
    expect((await f.request("POST", "", r)).status).toBe(400);
  expect(() => parseFaultReport({ ...submission(), authority: {} })).toThrow();
  expect((await f.request("POST", "", { ...submission(), extra: "x".repeat(32000) })).status).toBe(
    413,
  );
  for (let i = 0; i < 3; i++) expect((await f.request("POST", "", submission())).status).toBe(200);
  const limited = await f.request("POST", "", submission());
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("60");
});

it("bounds disk retention and releases capacity after owner deletion", async () => {
  const f = await fixture(),
    directory = join(f.directory, "fault-reports");
  await mkdir(directory);
  const reports = Array.from({ length: 500 }, submission);
  await Promise.all(
    reports.map((r) =>
      writeFile(
        join(directory, `${r.id}.json`),
        JSON.stringify({ ...r, receivedAt: new Date().toISOString() }),
      ),
    ),
  );
  const additional = submission();
  expect((await f.request("POST", "", additional)).status).toBe(413);
  expect(await readdir(directory)).toHaveLength(500);
  expect((await f.request("DELETE", `/${reports[0]?.id}`)).status).toBe(200);
  expect((await f.request("POST", "", additional)).status).toBe(200);
});
