import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkshopInbox, WorkshopManifest } from "../workshop/WorkshopTypes.js";
import { ArtNoteStore } from "./artNotesHttp.js";
import { InteriorReviewStore } from "./interiorReviewPlugin.js";
import { hashWorkshopPassword, WorkshopAuth } from "./workshopAuth.js";
import { workshopInputDigest } from "./workshopManifest.js";
import { WorkshopService } from "./workshopService.js";

const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
const password = "workshop-test-password-only";
const passwordHash = await hashWorkshopPassword(password),
  digest = await workshopInputDigest();
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function fixture(configured = true, stale = false, localBypass = false) {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-workshop-")),
    authDir = join(directory, "auth");
  await mkdir(authDir);
  if (configured)
    await writeFile(
      join(authDir, "owner.json"),
      JSON.stringify({ version: 1, username: "owner", passwordHash }),
    );
  const manifestPath = join(directory, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, inputDigest: stale ? "0".repeat(64) : digest }),
  );
  const options = {
    directory,
    manifestPath,
    auth: new WorkshopAuth(authDir, undefined, localBypass),
    art: new ArtNoteStore(join(directory, "art")),
    interiors: new InteriorReviewStore(join(directory, "interiors")),
  };
  let service = new WorkshopService(options);
  const server = createServer(
    (req, res) =>
      void service.handle(req, res).then((handled) => {
        if (!handled) {
          res.statusCode = 404;
          res.end();
        }
      }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture server");
  const base = `http://127.0.0.1:${address.port}`;
  cleanups.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  let cookie = "",
    csrf = "";
  async function login() {
    const response = await fetch(base + "/tilefun/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ username: "owner", password }),
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const body = await response.json();
    csrf = body.csrfToken;
    expect(response.status).toBe(200);
    return response;
  }
  const request = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-Workshop-CSRF": csrf }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const event = (body: unknown) => request("/tilefun/api/workshop/events", body);
  return {
    directory,
    authDir,
    base,
    login,
    request,
    event,
    service: () => service,
    restart: () => {
      service = new WorkshopService(options);
    },
  };
}
const candidate = manifest.candidates.find((c) => c.batchId === "roads");
if (!candidate) throw new Error("No road fixture");

describe("Workshop API and login boundaries", () => {
  it("allows direct local review without login but protects public/proxied hosts and cross-site writes", async () => {
    const f = await fixture(false, false, true);
    expect(await (await f.request("/tilefun/api/auth/session")).json()).toMatchObject({
      authenticated: true,
      configured: false,
      local: true,
      csrfToken: "local",
    });
    for (const api of ["art-notes", "interior-review", "workshop/inbox"]) {
      expect((await f.request(`/tilefun/api/${api}`)).status).toBe(200);
      expect(
        await new Promise<number>((resolve, reject) => {
          const req = httpRequest(
            `${f.base}/tilefun/api/${api}`,
            { headers: { Host: "tilefun.graehlarts.com" } },
            (res) => {
              res.resume();
              resolve(res.statusCode ?? 0);
            },
          );
          req.on("error", reject);
          req.end();
        }),
      ).toBe(401);
      expect(
        (
          await f.request(`/tilefun/api/${api}`, undefined, {
            "X-Forwarded-Host": "tilefun.graehlarts.com",
          })
        ).status,
      ).toBe(401);
    }
    const body = {
      id: "local-source",
      type: "source",
      sheetId: "me-complete",
      fingerprint: candidate.sourceFingerprint,
      rect: [0, 0, 16, 16],
      sliceKeys: [],
      intent: "terrain",
      note: "Local request",
    };
    expect((await f.request("/tilefun/api/workshop/events", body)).status).toBe(403);
    expect(
      (
        await f.request("/tilefun/api/workshop/events", body, {
          "X-Workshop-CSRF": "local",
          Origin: "https://random.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await f.request("/tilefun/api/workshop/events", body, {
          "X-Workshop-CSRF": "local",
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
    ).toBe(403);
    expect(
      (await f.request("/tilefun/api/workshop/events", body, { "X-Workshop-CSRF": "local" }))
        .status,
    ).toBe(200);
    expect(await f.service().art.records()).toHaveLength(1);
  });
  it("fails closed without configuration and protects new and legacy reads/writes", async () => {
    const f = await fixture(false);
    expect(await (await f.request("/tilefun/api/auth/session")).json()).toEqual({
      authenticated: false,
      configured: false,
    });
    for (const path of [
      "/tilefun/api/art-notes",
      "/tilefun/api/interior-review",
      "/tilefun/api/workshop/inbox",
      "/tilefun/api/workshop/activity",
      "/tilefun/api/workshop/threads/art:unknown",
    ]) {
      expect((await f.request(path)).status).toBe(401);
      expect((await f.request(path, {})).status).toBe(401);
    }
    expect((await f.event({})).status).toBe(401);
  });
  it("uses revocable cookie sessions, requires CSRF and rejects cross-origin writes", async () => {
    const f = await fixture();
    const login = await f.login();
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect((await f.request("/tilefun/api/auth/session")).status).toBe(200);
    const body = {
      id: "road-approval",
      type: "review",
      candidateId: candidate.id,
      fingerprint: candidate.fingerprint,
      verdict: "approved",
      note: "",
    };
    expect(
      (await f.request("/tilefun/api/workshop/events", body, { "X-Workshop-CSRF": "" })).status,
    ).toBe(403);
    expect(
      (await f.request("/tilefun/api/workshop/events", body, { Origin: "https://random.example" }))
        .status,
    ).toBe(403);
    expect((await f.request("/tilefun/api/art-notes", {}, { "X-Workshop-CSRF": "" })).status).toBe(
      403,
    );
    expect(
      (await f.request("/tilefun/api/interior-review", {}, { "X-Workshop-CSRF": "" })).status,
    ).toBe(403);
    expect((await f.event(body)).status).toBe(200);
    f.restart();
    expect((await f.request("/tilefun/api/workshop/inbox")).status).toBe(200);
    expect((await f.request("/tilefun/api/auth/logout", {})).status).toBe(200);
    expect((await f.request("/tilefun/api/art-notes")).status).toBe(401);
  });
  it("rejects expired sessions and invalidates sessions after a password reset", async () => {
    const f = await fixture();
    await f.login();
    const path = join(f.authDir, "sessions.json"),
      sessions = JSON.parse(await readFile(path, "utf8"));
    for (const s of Object.values(sessions) as { expires: number }[]) s.expires = 0;
    await writeFile(path, JSON.stringify(sessions));
    expect((await f.request("/tilefun/api/workshop/inbox")).status).toBe(401);
    await f.login();
    await writeFile(
      join(f.authDir, "owner.json"),
      JSON.stringify({
        version: 1,
        username: "owner",
        passwordHash: await hashWorkshopPassword("another-test-password"),
      }),
    );
    expect((await f.request("/tilefun/api/workshop/inbox")).status).toBe(401);
  });
  it("rate limits failed owner logins without public registration", async () => {
    const f = await fixture();
    for (let i = 0; i < 6; i++) {
      const response = await fetch(f.base + "/tilefun/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "owner", password: "wrong" }),
      });
      expect(response.status).toBe(401);
    }
    const response = await fetch(f.base + "/tilefun/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner", password }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
  });
  it("discovers zero-event batches, saves exact judgments once, and keeps resolution separate", async () => {
    const f = await fixture();
    await f.login();
    const initial = (await (
      await f.request("/tilefun/api/workshop/inbox")
    ).json()) as WorkshopInbox;
    expect(initial.candidates.filter((c) => c.batchId === "districts")).toHaveLength(3);
    expect(initial.candidates.every((c) => c.state === "unchecked" || c.state === "excluded")).toBe(
      true,
    );
    const review = {
      id: "report-1",
      type: "review",
      candidateId: candidate.id,
      fingerprint: candidate.fingerprint,
      verdict: "changes",
      note: "Curb needs attention",
    };
    await Promise.all([f.event(review), f.event(review)]);
    expect(await f.service().art.records()).toHaveLength(1);
    expect((await f.event({ ...review, note: "Conflicting retry" })).status).toBe(409);
    expect(
      (
        await f.event({
          id: "reply-1",
          type: "reply",
          threadId: "art:report-1",
          reply: "Fixed; review the new appearance",
          status: "resolved",
        })
      ).status,
    ).toBe(200);
    const inbox = (await (await f.request("/tilefun/api/workshop/inbox")).json()) as WorkshopInbox;
    expect(inbox.candidates.find((c) => c.id === candidate.id)?.state).toBe("changes");
    expect(inbox.requests).toHaveLength(0);
    const thread = await (await f.request("/tilefun/api/workshop/threads/art:report-1")).json();
    expect(thread.history).toHaveLength(2);
    expect(thread.history[1].buildingVerdict).toEqual(thread.history[0].buildingVerdict);
    const stamp = thread.history[0].createdAt;
    // Simulate a crash after durable commands but before compatibility rows.
    await writeFile(f.service().art.file, "");
    f.restart();
    expect((await f.event(review)).status).toBe(200);
    expect((await f.service().art.records())[0]?.createdAt).toBe(stamp);
    expect(await f.service().art.records()).toHaveLength(2);
  });
  it("keeps interior replies out of human verdict order and serves full screenshot history", async () => {
    const f = await fixture();
    await f.login();
    const c = manifest.candidates.find((c) => c.kind === "interior" && !c.excluded);
    if (!c) throw new Error("No interior fixture");
    await f.event({
      id: "room-report",
      type: "review",
      candidateId: c.id,
      fingerprint: c.fingerprint,
      verdict: "changes",
      note: "Wrong join",
      pins: [{ x: 0, y: 0, size: 16 }],
    });
    await f.event({
      id: "room-reply",
      type: "reply",
      threadId: `interior:${c.id}`,
      reply: "Investigating",
      status: "in-progress",
    });
    let inbox = (await (await f.request("/tilefun/api/workshop/inbox")).json()) as WorkshopInbox;
    expect(inbox.requests[0]?.reply).toBe("Investigating");
    expect(inbox.candidates.find((r) => r.id === c.id)?.state).toBe("changes");
    await f.event({
      id: "room-good",
      type: "review",
      candidateId: c.id,
      fingerprint: c.fingerprint,
      verdict: "approved",
      note: "",
    });
    await f.event({
      id: "room-old-reply",
      type: "reply",
      threadId: `interior:${c.id}`,
      reply: "Old issue closed",
      status: "resolved",
    });
    inbox = await (await f.request("/tilefun/api/workshop/inbox")).json();
    expect(inbox.candidates.find((r) => r.id === c.id)?.state).toBe("approved");
    expect(await f.service().interiors.records()).toHaveLength(2);
    const row = (await f.service().interiors.records()).at(-1);
    if (!row) throw new Error("No record");
    const screenshot = "data:image/png;base64,AAAA";
    await f.service().interiors.append({ ...row, id: "screen", screenshot });
    const legacy = await (await f.request("/tilefun/api/interior-review")).json();
    expect(legacy[0].screenshot).toBeUndefined();
    const thread = await (await f.request(`/tilefun/api/workshop/threads/interior:${c.id}`)).json();
    expect(thread.history.at(-1).screenshot).toBe(screenshot);
  });
  it("refuses stale or excluded candidates, validates source targets, and cannot traverse files", async () => {
    const f = await fixture(true, true);
    await f.login();
    expect(
      (
        await f.event({
          id: "stale",
          type: "review",
          candidateId: candidate.id,
          fingerprint: candidate.fingerprint,
          verdict: "approved",
          note: "",
        })
      ).status,
    ).toBe(409);
    const inbox = await (await f.request("/tilefun/api/workshop/inbox")).json();
    expect(inbox.manifestCurrent).toBe(false);
    expect(
      (
        await f.event({
          id: "source",
          type: "source",
          sheetId: "me-complete",
          fingerprint: "0".repeat(64),
          rect: [0, 0, 16, 16],
          sliceKeys: [],
          intent: "terrain",
          note: "Road",
        })
      ).status,
    ).toBe(409);
    expect((await f.request("/tilefun/api/workshop/threads/art%3A..%2Fowner.json")).status).toBe(
      400,
    );
    expect(await f.service().art.records()).toHaveLength(0);
  });
});

it("persists exact asset metadata and canonical world annotations across retries and restart", async () => {
  const f = await fixture();
  await f.login();
  const bank = JSON.parse(
    readFileSync("public/data/outdoor-catalog.json", "utf8"),
  ) as import("../assets/outdoor/OutdoorCatalog.js").OutdoorCatalog;
  const asset = bank.assets.find((a) => a.evidence === "candidate")!;
  const event = {
    id: "outdoor-metadata-test",
    type: "asset",
    rect: asset.rect,
    fingerprint: bank.sourceFingerprint,
    catalogRevision: bank.revision,
    metadata: asset.metadata,
    verdict: "note",
    note: "Use this cart in the square",
  };
  expect((await f.event(event)).status).toBe(200);
  expect((await f.event(event)).status).toBe(200);
  let rows = await f.service().art.records();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.assetAnnotation?.metadata).toEqual(asset.metadata);
  f.restart();
  expect((await f.service().inbox()).requests[0]?.name).toBe(asset.metadata.name);
  const { createHash } = await import("node:crypto");
  const { ALL_DENSE_REVIEW_CASES, denseReviewScene } = await import(
    "../art/DenseDistrictShowcase.js"
  );
  const definition = ALL_DENSE_REVIEW_CASES.find((c) => c.id === "district-v10-destinations")!;
  const scene = denseReviewScene(definition),
    c = manifest.candidates.find((c) => c.id === `district:${definition.id}`)!;
  const selection = [scene.plan.center.x * 16, scene.plan.center.y * 16, 32, 32];
  const suggestion = {
    assetId: asset.id,
    rect: asset.rect,
    sourceFingerprint: bank.sourceFingerprint,
    metadata: asset.metadata,
    metadataFingerprint: createHash("sha256").update(JSON.stringify(asset.metadata)).digest("hex"),
  };
  const feedback = {
    id: "outdoor-scene-test",
    type: "scene",
    candidateId: c.id,
    fingerprint: c.fingerprint,
    rect: selection,
    featureIds: [],
    suggestions: [suggestion],
    note: "Tables and shade here",
  };
  expect((await f.event(feedback)).status).toBe(200);
  expect(
    (await f.event({ ...feedback, id: "bad-scene-region", rect: [0, 0, 32, 32] })).status,
  ).toBe(400);
  expect(
    (
      await f.event({
        ...feedback,
        id: "bad-scene-source",
        suggestions: [{ ...suggestion, sourceFingerprint: "0".repeat(64) }],
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await f.event({
        ...feedback,
        id: "bad-scene-payload",
        suggestions: [{ ...suggestion, metadataFingerprint: "0".repeat(64) }],
      })
    ).status,
  ).toBe(409);
  expect(
    (await f.event({ ...feedback, id: "bad-scene-feature", featureIds: ["invented-building"] }))
      .status,
  ).toBe(400);
  expect(
    (await f.event({ ...event, id: "bad-asset-revision", catalogRevision: "0".repeat(64) })).status,
  ).toBe(409);
  expect(
    (
      await f.event({
        ...event,
        id: "bad-asset-anchor",
        metadata: { ...asset.metadata, anchor: [-1, 0] },
      })
    ).status,
  ).toBe(400);
  f.restart();
  rows = await f.service().art.records();
  expect(rows).toHaveLength(2);
  expect(rows[1]?.sceneAnnotation?.generation).toEqual(scene.generation);
  expect(rows[1]?.sceneAnnotation?.rect).toEqual(selection);
  expect(rows[1]?.sceneAnnotation?.suggestions).toEqual([suggestion]);
  const original = rows[1]!;
  await expect(
    f.service().art.append({
      ...original,
      id: "retarget-world",
      sceneAnnotation: {
        ...original.sceneAnnotation!,
        rect: [selection[0]!, selection[1]!, 16, 16],
      },
    }),
  ).rejects.toThrow("selection cannot change");
  expect((await f.service().inbox()).requests).toHaveLength(2);
});

it("pattern kit judgments use the global queue and preserve exact rule/pixel identities", async () => {
  const f = await fixture();
  await f.login();
  const c = manifest.candidates.find((c) => c.kind === "pattern");
  if (!c) throw new Error("Missing pattern candidate");
  const e = {
    id: "pattern-approval-test",
    type: "review",
    candidateId: c.id,
    fingerprint: c.fingerprint,
    verdict: "approved",
    note: "Caps and fence checked.",
  };
  expect((await f.event(e)).status).toBe(200);
  const inbox = await (await f.request("/tilefun/api/workshop/inbox")).json();
  expect(inbox.candidates.find((r: { id: string }) => r.id === c.id).state).toBe("approved");
  expect(
    (await f.event({ ...e, id: "pattern-stale-test", fingerprint: "0".repeat(64) })).status,
  ).toBe(409);
  expect(
    (
      await f.event({
        ...e,
        id: "pattern-change-test",
        verdict: "changes",
        note: "Right join needs work.",
      })
    ).status,
  ).toBe(200);
  f.restart();
  const next = await (await f.request("/tilefun/api/workshop/inbox")).json();
  expect(next.candidates.find((r: { id: string }) => r.id === c.id).state).toBe("changes");
});
