import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

for (const transport of ["ws", "webrtc"] as const) {
  test(`dedicated ${transport} server rejects guest administration and consumes the browser admin credential`, async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);
    const directory = await mkdtemp(join(tmpdir(), "tilefun-admin-browser-"));
    const token = randomBytes(32).toString("hex");
    let child: ChildProcess | undefined;
    const guest = await browser.newContext();
    try {
      child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: transport === "ws" ? "4192" : "4193",
          NET_TRANSPORT: transport,
          DATA_DIR: directory,
          TILEFUN_ADMIN_TOKEN: token,
          TILEFUN_TRUSTED_COOP: "0",
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
          if (child?.exitCode !== null) throw new Error(logs);
          try {
            return (
              await fetch(`http://localhost:${transport === "ws" ? "4192" : "4193"}/api/world-list`)
            ).ok;
          } catch {
            return false;
          }
        })
        .toBe(true);
      const url = `/tilefun/?server=localhost:${transport === "ws" ? "4192" : "4193"}&transport=${transport}`;
      await page.goto(`${url}#adminToken=${token}`);
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      expect(new URL(page.url()).hash).toBe("");
      const adminOutput = await page.evaluate(async () => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: { consoleEngine: import("../src/console/ConsoleEngine.js").ConsoleEngine };
          }
        ).__game;
        return game.consoleEngine.rconSend?.("sv_speed 2");
      });
      expect(adminOutput?.join(" ")).toContain("2");
      const visitor = await guest.newPage();
      await visitor.goto(url);
      await expect(visitor.locator("#game")).toHaveAttribute("data-ready", "true");
      const error = await visitor.evaluate(async () => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: { consoleEngine: import("../src/console/ConsoleEngine.js").ConsoleEngine };
          }
        ).__game;
        try {
          await game.consoleEngine.rconSend?.("sv_speed 99");
          return "allowed";
        } catch (error) {
          return String(error);
        }
      });
      expect(error).toContain("requires an admin token");
      expect(
        (
          await page.evaluate(async () => {
            const game = (
              document.querySelector("#game") as unknown as {
                __game: { consoleEngine: import("../src/console/ConsoleEngine.js").ConsoleEngine };
              }
            ).__game;
            return game.consoleEngine.rconSend?.("sv_speed");
          })
        )?.join(" "),
      ).toContain("2");
    } finally {
      await guest.close();
      if (child && child.exitCode === null) {
        const exited = new Promise<void>((resolve) => child?.once("exit", () => resolve()));
        child.kill("SIGTERM");
        await exited;
      }
      await rm(directory, { recursive: true, force: true });
    }
  });
}
