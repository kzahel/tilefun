import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveStatic } from "./staticFiles.js";

describe("dedicated server static files", () => {
  let root: string;
  let server: Server;
  let port: number;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "tilefun-static-"));
    const dist = join(root, "dist");
    await mkdir(join(dist, "nested"), { recursive: true });
    await writeFile(join(dist, "index.html"), "game");
    await writeFile(join(dist, "nested", "index.html"), "nested");
    await writeFile(join(root, "secret.txt"), "private");
    await symlink(join(root, "secret.txt"), join(dist, "linked.txt"), "file");
    server = createServer((req, res) => {
      if (!serveStatic(req, res, dist, "/tilefun/")) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    port = address.port;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  });
  function get(path: string, method = "GET") {
    return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port, path, method }, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      req.on("error", reject);
      req.end();
    });
  }
  it.each([
    "../secret.txt",
    "%2e%2e/secret.txt",
    "%2e%2e%2fsecret.txt",
    "..%5csecret.txt",
    "%00",
    "%ZZ",
    "linked.txt",
    "%2fetc/passwd",
  ])("rejects unsafe asset path %s", async (path) => {
    expect((await get(`/tilefun/${path}`)).status).toBe(400);
  });
  it("serves the app, directories, and SPA routes", async () => {
    expect(await get("/tilefun/")).toEqual({ status: 200, body: "game" });
    expect(await get("/tilefun/nested/")).toEqual({ status: 200, body: "nested" });
    expect(await get("/tilefun/route?value=1")).toEqual({ status: 200, body: "game" });
  });
  it("supports HEAD and rejects mutation methods", async () => {
    expect(await get("/tilefun/", "HEAD")).toEqual({ status: 200, body: "" });
    expect((await get("/tilefun/", "POST")).status).toBe(405);
  });
});
