import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { hashWorkshopPassword } from "../src/server/workshopAuth.js";
import { WORKSHOP_TEST_PASSWORD } from "./workshop-setup.js";

test("standalone browser login renders a native review and sends its vote", async ({ browser }) => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "tilefun-workshop-standalone-"));
  const authDirectory = join(directory, "workshop");
  await mkdir(authDirectory);
  await writeFile(
    join(authDirectory, "owner.json"),
    JSON.stringify({
      version: 1,
      username: "owner",
      passwordHash: await hashWorkshopPassword(WORKSHOP_TEST_PASSWORD),
    }),
    { mode: 0o600 },
  );
  const base = "http://localhost:4196";
  let child: ChildProcess | undefined;
  const context = await browser.newContext({
    baseURL: base,
    storageState: { cookies: [], origins: [] },
  });
  try {
    child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: "4196",
        NET_TRANSPORT: "ws",
        DATA_DIR: directory,
        WORKSHOP_LOCAL_AUTH_BYPASS: "0",
        WORKSHOP_AUTH_DIR: authDirectory,
        WORKSHOP_DATA_DIR: authDirectory,
        ART_NOTES_DIR: join(directory, "art-notes"),
        INTERIOR_REVIEW_DIR: join(directory, "interior-review"),
      },
      stdio: "pipe",
    });
    let logs = "";
    child.stdout?.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      logs += chunk;
    });
    await expect
      .poll(async () => {
        if (child?.exitCode !== null) throw Error(logs);
        if (!logs.includes(`Server listening on ${base}`)) return false;
        try {
          return (await fetch(base + "/tilefun/api/auth/session")).ok;
        } catch {
          return false;
        }
      })
      .toBe(true);
    const page = await context.newPage();
    await page.goto("/tilefun/workshop.html#/login");
    await page.getByLabel("Password", { exact: true }).fill(WORKSHOP_TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "What’s ready to look at?" })).toBeVisible();
    await page.goto("/tilefun/workshop.html#/review/surface%3Asurface-v1-narrow");
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await page.getByRole("button", { name: "Looks right ✓", exact: true }).click();
    await expect
      .poll(async () => await (await context.request.get("/tilefun/api/art-notes")).json())
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            buildingVerdict: expect.objectContaining({ value: "approved" }),
          }),
        ]),
      );
    expect(await readFile(join(directory, "art-notes/notes.ndjson"), "utf8")).toContain(
      '"approved"',
    );
  } finally {
    try {
      await context.close();
    } finally {
      if (child && child.exitCode === null) {
        const exited = new Promise<void>((resolve) => child?.once("exit", () => resolve()));
        child.kill("SIGTERM");
        await exited;
      }
      await rm(directory, { recursive: true, force: true });
    }
  }
});
