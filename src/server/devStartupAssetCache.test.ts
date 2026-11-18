import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { expect, it } from "vitest";
import { STARTUP_ASSET_MANIFEST, STARTUP_ASSET_VERSION } from "../shared/startupAssetCache.js";
import { devStartupAssetCache } from "./devStartupAssetCache.js";

it("revalidates the manifest and only serves immutable bytes at their matching version", async () => {
  const root = await mkdtemp(join(tmpdir(), "tilefun-startup-cache-"));
  const path = "assets/test.png";
  const file = join(root, "public", path);
  await mkdir(join(root, "public/assets"), { recursive: true });
  await writeFile(file, "first");
  await writeFile(join(root, "private.json"), '"private"');
  await symlink(join(root, "private.json"), join(root, "public/assets/linked.json"), "file");
  const server = await createServer({
    configFile: false,
    root,
    base: "/tilefun/",
    plugins: [devStartupAssetCache([path, "assets/linked.json"])],
    server: { host: "127.0.0.1", port: 0, watch: null },
    logLevel: "silent",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw Error("Missing startup-cache port");
    const base = `http://127.0.0.1:${address.port}/tilefun/`;
    const manifestUrl = base + STARTUP_ASSET_MANIFEST;
    const manifest = await fetch(manifestUrl);
    const etag = manifest.headers.get("etag") ?? "";
    expect(etag).toBeTruthy();
    expect(manifest.headers.get("cache-control")).toBe("no-cache");
    const first = (await manifest.json()) as Record<string, string>;
    const originalUrl = `${base}${path}?${STARTUP_ASSET_VERSION}=${first[path]}`;
    const original = await fetch(originalUrl);
    expect(original.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(original.headers.get("content-type")).toBe("image/png");
    expect(await original.text()).toBe("first");
    expect(first["assets/linked.json"]).toBeUndefined();
    const conditional = () => fetch(manifestUrl, { headers: { "If-None-Match": etag } });
    expect((await conditional()).status).toBe(304);

    await writeFile(file, "fresh");
    const updated = await conditional();
    expect(updated.status).toBe(200);
    const next = (await updated.json()) as Record<string, string>;
    expect(next[path]).not.toBe(first[path]);
    const stale = await fetch(originalUrl);
    expect(stale.status).toBe(404);
    expect(stale.headers.get("cache-control")).toBe("no-store");
    const fresh = await fetch(`${base}${path}?${STARTUP_ASSET_VERSION}=${next[path]}`);
    expect(await fresh.text()).toBe("fresh");
    expect(await (await fetch(base + path)).text()).toBe("fresh");
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
