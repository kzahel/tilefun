import { expect, type Page, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

async function play(page: Page) {
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 2026)))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");
  await page.waitForFunction(
    () => (document.querySelector("#game") as HTMLCanvasElement).dataset.ready === "true",
  );
}
test("synthetic Worker crash uploads stack and context to the owner diagnostic inbox", async ({
  page,
}) => {
  await play(page);
  const upload = page.waitForResponse(
    (r) => r.url().endsWith("/api/fault-reports") && r.request().method() === "POST",
  );
  const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
  if (!worker) throw Error("No authority Worker");
  await worker.evaluate(() => {
    function syntheticTelemetryCrash() {
      return Promise.reject(new Error("Synthetic telemetry Worker crash"));
    }
    void syntheticTelemetryCrash();
  });
  await expect(page.locator("#tilefun-error-overlay")).toContainText(
    "Synthetic telemetry Worker crash",
  );
  const response = await upload;
  expect(response.status()).toBe(200);
  const report = response.request().postDataJSON();
  expect(report.kind).toBe("fatal");
  expect(report.stack).toContain("syntheticTelemetryCrash");
  expect(report.context.mode).toBe("local-worker");
  expect(report.context.generation).toContain("flat");
  expect(report.context.worldId).toBeTruthy();
  expect(report.browser).toContain("Chrome");
  await page.goto("/tilefun/workshop.html#/diagnostics");
  await page
    .getByRole("button", { name: "fatal: Synthetic telemetry Worker crash", exact: true })
    .first()
    .click();
  await expect(page.locator("article")).toContainText("syntheticTelemetryCrash");
  await page.locator("article").getByRole("button", { name: "Delete report" }).click();
  await expect(page.locator("article")).toHaveCount(0);
});
test("offline fault survives reload and is retried with the same report ID", async ({ page }) => {
  await play(page);
  let reportId = "";
  await page.route("**/api/fault-reports", async (route) => {
    reportId = route.request().postDataJSON().id;
    await route.abort("internetdisconnected");
  });
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("Synthetic offline telemetry crash") }),
    ),
  );
  await expect(page.locator("#tilefun-error-overlay")).toContainText(
    "Synthetic offline telemetry crash",
  );
  await expect.poll(() => reportId).not.toBe("");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("tilefun.fault-outbox.v1") ?? "[]").length,
      ),
    )
    .toBe(1);
  await page.unroute("**/api/fault-reports");
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/fault-reports") && r.request().method() === "POST",
  );
  await page.reload();
  const response = await uploaded;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().id).toBe(reportId);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("tilefun.fault-outbox.v1") ?? "[]").length,
      ),
    )
    .toBe(0);
});
test("a silent authority hang becomes a recoverable error and an automatic hang report", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await play(page);
  const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
  if (!worker) throw Error("No authority Worker");
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/fault-reports") && r.request().method() === "POST",
    { timeout: 45_000 },
  );
  // Stop input production to isolate the watchdog. During active play, the
  // existing bounded channel can report queue overflow before the watchdog fires.
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: existing game diagnostic hook
    (document.querySelector("#game") as any).__game.loop.stop();
  });
  // Schedule after evaluation returns; the watchdog terminates this blocked Worker.
  await worker.evaluate(() => {
    setTimeout(() => {
      const until = performance.now() + 45_000;
      while (performance.now() < until) {
        /* synthetic authority hang */
      }
    }, 50);
  });
  await expect(page.locator("#tilefun-error-overlay")).toContainText(
    "Local server stopped responding",
    { timeout: 45_000 },
  );
  const response = await uploaded;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    kind: "server-hang",
    authority: { state: "failed" },
  });
  await page
    .locator("#tilefun-error-overlay")
    .getByRole("button", { name: "Reload", exact: true })
    .click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 15_000 });
  await expect(page.locator("#tilefun-error-overlay")).toHaveCount(0);
});

test("a lost map request reports its timeout while the healthy authority remains usable", async ({
  page,
}) => {
  await play(page);
  const uploaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/fault-reports") && r.request().method() === "POST",
  );
  const message = await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: controlled request-loss diagnostic
    const g = (document.querySelector("#game") as any).__game;
    const broker = g.requests,
      transmit = broker.transmit,
      timeout = broker.timeoutMs;
    broker.timeoutMs = 50;
    broker.transmit = () => {}; // Lose this single request before it reaches the Worker.
    try {
      await g.gcSendRequest({ type: "get-world-map", requestId: g.nextRequestId++ });
      return "unexpected response";
    } catch (error) {
      return String(error);
    } finally {
      broker.transmit = transmit;
      broker.timeoutMs = timeout;
    }
  });
  expect(message).toContain("Request timed out: get-world-map");
  const response = await uploaded;
  expect(response.status()).toBe(200);
  const report = response.request().postDataJSON();
  expect(report.kind).toBe("request-timeout");
  expect(report.events.at(-1).type).toBe("request:get-world-map");
  await expect(page.locator("#tilefun-error-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "Open world map" }).click();
  await expect(page.getByTestId("world-map")).toHaveAttribute("data-settled", "true");
});
