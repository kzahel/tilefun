import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { expect, it } from "vitest";
import { privateDataPlugin } from "./privateDataPlugin.js";

it("blocks private Vite files through project, fs, import, encoded and symlink URLs", async () => {
  const root = await mkdtemp(join(tmpdir(), "tilefun-private-http-"));
  await mkdir(join(root, "data/workshop"), { recursive: true });
  await mkdir(join(root, "public/data"), { recursive: true });
  await writeFile(join(root, "data/workshop/owner.json"), '"private-test-marker"');
  await writeFile(join(root, "public/data/catalog.json"), '"public-index"');
  await symlink(join(root, "data/workshop"), join(root, "public/link"));
  const server = await createServer({
    configFile: false,
    root,
    base: "/tilefun/",
    plugins: [privateDataPlugin(root)],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string")
      throw new Error("Missing private-file test server");
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of [
      "/tilefun/data/workshop/owner.json",
      "/tilefun/data/workshop/owner.json?raw",
      "/tilefun/data/workshop/owner.json?import",
      "/tilefun/data%2fworkshop%2fowner.json",
      `/tilefun/@fs/${root}/data/workshop/owner.json`,
      `/@fs/${root}/data/workshop/owner.json`,
      "/tilefun/link/owner.json",
    ]) {
      const response = await fetch(base + path);
      expect(response.status, path).toBe(403);
      expect(await response.text()).not.toContain("private-test-marker");
    }
    const response = await fetch(base + "/tilefun/data/catalog.json");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('"public-index"');
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
