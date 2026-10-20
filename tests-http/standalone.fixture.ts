import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, test as base, expect, request } from "@playwright/test";
import { hashWorkshopPassword } from "../src/server/workshopAuth.js";

export const password = "tilefun-standalone-node-test-only";
export const test = base.extend<{
  standalone: { api: APIRequestContext; directory: string; baseURL: string; adminToken: string };
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires fixture dependencies to be destructured.
  standalone: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), "tilefun-http-test-"));
    const authDirectory = join(directory, "workshop");
    await mkdir(authDirectory);
    await writeFile(
      join(authDirectory, "owner.json"),
      JSON.stringify({
        version: 1,
        username: "owner",
        passwordHash: await hashWorkshopPassword(password),
      }),
      { mode: 0o600 },
    );
    const listener = createServer();
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("No free test port");
    const port = address.port;
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    const baseURL = `http://localhost:${port}`;
    const adminToken = randomBytes(32).toString("hex");
    const child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        NET_TRANSPORT: "ws",
        DATA_DIR: directory,
        TILEFUN_ADMIN_TOKEN: adminToken,
        TILEFUN_TRUSTED_COOP: "0",
        WORKSHOP_LOCAL_AUTH_BYPASS: "0",
        WORKSHOP_AUTH_DIR: authDirectory,
        WORKSHOP_DATA_DIR: authDirectory,
        ART_NOTES_DIR: join(directory, "art-notes"),
        INTERIOR_REVIEW_DIR: join(directory, "interior-review"),
      },
      stdio: "pipe",
    });
    let logs = "";
    child.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    const api = await request.newContext({ baseURL });
    try {
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null) throw new Error(logs);
            try {
              return (await api.get("/tilefun/api/auth/session")).ok();
            } catch {
              return false;
            }
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      await use({ api, directory, baseURL, adminToken });
    } finally {
      await api.dispose();
      if (child.exitCode === null) {
        const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        child.kill("SIGTERM");
        await exited;
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
});
export { expect };
