import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { DEV_READY_MARKER, devUpdatePlugin } from "../src/server/devUpdatePlugin.js";

test("edits and ready markers preserve play; controller reload saves, and save failure stays playable", async ({
  page,
}) => {
  const server = await createServer({
    configFile: false,
    base: "/tilefun/",
    cacheDir: test.info().outputPath("vite-cache"),
    define: { "import.meta.env.VITE_MANUAL_RELOAD": "true" },
    optimizeDeps: { entries: ["index.html"] },
    plugins: [devUpdatePlugin(), react()],
    server: { host: "127.0.0.1", port: 0, hmr: false, ws: false, watch: null },
    logLevel: "error",
  });
  try {
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => console.log("page error", error.message));
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing port");
    const url = `http://127.0.0.1:${address.port}/tilefun/?renderer=canvas`;
    const stream = page.waitForResponse((res) => res.url().endsWith("/__dev-updates"));
    await page.goto(url);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await stream;
    const ticks = () =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return game.getFaultContext().serverTick;
      });
    const before = await ticks();
    await page.evaluate(() => {
      (window as unknown as { sessionToken: string }).sessionToken = "same-page";
    });
    const edit = () => server.watcher.emit("all", "change", resolve("src/main.ts"));
    const ready = () => server.watcher.emit("all", "change", resolve(DEV_READY_MARKER));
    edit();
    // Even a Vite full reload/error must never reach the running game.
    server.environments.client?.hot.send({ type: "full-reload", path: "*" });
    server.environments.client?.hot.send({
      type: "error",
      err: { message: "Intermediate edit", stack: "" },
    });
    const notice = page.getByTestId("dev-update-notice");
    await expect(notice).toContainText("Code changed", { timeout: 10000 });
    ready();
    await expect(notice).toContainText("Changes ready to try");
    edit();
    await expect(notice).toContainText("Code changing");
    await expect(notice).not.toContainText("Changes ready");
    await expect.poll(ticks).toBeGreaterThan(before);
    expect(
      await page.evaluate(() => (window as unknown as { sessionToken: string }).sessionToken),
    ).toBe("same-page");
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BUTTON");
    await server.restart();
    await expect(notice).toContainText("Code changed");
    await expect.poll(ticks).toBeGreaterThan(before);
    ready();
    await expect(notice).toContainText("Changes ready to try");
    // Fail the real save boundary once, without introducing a production test hook.
    await page.evaluate(async () => {
      const moduleUrl = new URL("src/transport/WorkerClientTransport.ts", location.href).href;
      const { WorkerClientTransport } = await import(moduleUrl);
      const original = WorkerClientTransport.prototype.flush;
      WorkerClientTransport.prototype.flush = () => {
        WorkerClientTransport.prototype.flush = original;
        return Promise.reject(new Error("Test save failure"));
      };
    });
    await notice.getByRole("button", { name: "Save and reload" }).click();
    await expect(notice).toContainText("Test save failure");
    const failureTick = await ticks();
    await expect.poll(ticks).toBeGreaterThan(failureTick);
    // Reach the reload action through the ordinary menu and semantic controller confirm.
    await page.keyboard.press("Escape");
    const menu = page.getByTestId("world-menu");
    await expect(menu).toBeVisible();
    const reload = menu.getByRole("button", { name: /Changes ready to try.*Save and reload/ });
    await reload.focus();
    const navigation = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("tilefun-controller", { detail: "confirm" })),
    );
    await navigation;
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(menu).toBeHidden();
    await expect(page.getByTestId("dev-update-notice")).toBeHidden();
    expect(
      await page.evaluate(() => (window as unknown as { sessionToken?: string }).sessionToken),
    ).toBeUndefined();
    await expect.poll(ticks).toBeGreaterThan(0);
  } catch (error) {
    console.log("page content", await page.locator("body").innerText());
    throw error;
  } finally {
    await page.goto("about:blank");
    await server.close();
  }
});
