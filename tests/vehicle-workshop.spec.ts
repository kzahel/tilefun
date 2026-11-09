import { expect, test } from "@playwright/test";
import type { ArtNote } from "../src/art/ArtNotes.js";

const workshop = "/tilefun/workshop.html";
const viewUrl = (id: string) => `${workshop}#/tool/vehicles?view=${encodeURIComponent(id)}`;

test("vehicles are discoverable in the inbox and save exact directional boxes and height", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(workshop);
  await expect(page.getByRole("link", { name: /^Vehicles/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vehicle geometry", exact: true })).toBeVisible();
  const inbox = await (await page.request.get("/tilefun/api/workshop/inbox")).json();
  expect(inbox.candidates.filter((c: { kind: string }) => c.kind === "vehicle")).toHaveLength(180);
  const id = "vehicle:bus-1:east";
  await page.goto(viewUrl(id));
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".vehicle-directions button")).toHaveCount(4);
  await page.getByRole("button", { name: "Reset to proposal" }).click();
  await page.getByLabel("Ground width", { exact: true }).fill("100");
  await page.getByLabel("Physical height", { exact: true }).fill("1000000000");
  await page.getByRole("button", { name: "Save geometry / reopen" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid collider height");
  await page.getByLabel("Physical height", { exact: true }).fill("43");
  await page.getByLabel("Vehicle feedback").fill("Reviewed bus height and wheel footprint");
  const walker = page.getByLabel("Asset movement test", { exact: true });
  await expect(walker).toHaveAttribute("data-player-y", "40");
  await walker.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1100);
  await page.keyboard.up("ArrowUp");
  const stopped = Number(await walker.getAttribute("data-player-y"));
  expect(stopped).toBeGreaterThanOrEqual(2);
  expect(stopped).toBeLessThan(20);
  await page.screenshot({ path: "/tmp/tilefun-vehicles-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Approve view →", exact: true }).click();
  await expect
    .poll(async () => {
      const rows: ArtNote[] = await (await page.request.get("/tilefun/api/art-notes")).json();
      return rows.some(
        (n) =>
          n.assetAnnotation?.candidateId === id &&
          n.assetAnnotation.verdict === "approved" &&
          n.assetAnnotation.metadata.colliders?.[0]?.zHeight === 43 &&
          n.assetAnnotation.metadata.footprint?.[2] === 100,
      );
    })
    .toBe(true);
  // Remove the local geometry draft to verify server restoration independently.
  await page.evaluate(() => {
    const k = "tilefun.workshop.v1",
      s = JSON.parse(localStorage.getItem(k) ?? "{}");
    for (const key of Object.keys(s.state.drafts))
      if (key.startsWith("vehicle:vehicle:bus-1:east:")) delete s.state.drafts[key];
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto(viewUrl(id));
  await page.reload();
  await expect(page.getByLabel("Physical height", { exact: true })).toHaveValue("43");
  await expect(page.getByLabel("Ground width", { exact: true })).toHaveValue("100");
  expect(errors).toEqual([]);
});

test("vehicle drafts survive direction changes and offline corrections sync on phones", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = "vehicle:police-car:west";
  await page.goto(viewUrl(id));
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Physical height", { exact: true }).fill("29");
  await page.getByLabel("Vehicle feedback").fill("Phone geometry draft");
  await page.locator(".vehicle-directions button").filter({ hasText: "north" }).click();
  await page.locator(".vehicle-directions button").filter({ hasText: "west" }).click();
  await expect(page.getByLabel("Physical height", { exact: true })).toHaveValue("29");
  await expect(page.getByLabel("Vehicle feedback")).toHaveValue("Phone geometry draft");
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-vehicles-phone.png", fullPage: true });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save geometry / reopen" }).click();
  await expect(page.getByText(/1 pending save.*kept in this browser/)).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const rows: ArtNote[] = await (await page.request.get("/tilefun/api/art-notes")).json();
        return rows.some(
          (n) =>
            n.assetAnnotation?.candidateId === id &&
            n.note === "Phone geometry draft" &&
            n.assetAnnotation.metadata.colliders?.[0]?.zHeight === 29,
        );
      },
      { timeout: 25000 },
    )
    .toBe(true);
});

test("two vehicle reports pause the batch and require reasons", async ({ page }) => {
  await page.goto(viewUrl("vehicle:garbage-truck-green:north"));
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Leave a reason");
  await page.getByLabel("Vehicle feedback").fill("Ground box needs adjustment");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  await page.goto(viewUrl("vehicle:garbage-truck-green:east"));
  await expect(page.getByLabel("Vehicle geometry diagram")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Vehicle feedback").fill("Height needs adjustment");
  await page.getByRole("button", { name: "Needs changes ✕", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review paused after two Needs changes reports" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve view →", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Keep reviewing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve view →", exact: true })).toBeEnabled();
});
