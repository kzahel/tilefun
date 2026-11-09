import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

// The headless shell doesn't reproduce GPU-vs-CPU canvas fingerprint differences.
test.use({ channel: "chromium", deviceScaleFactor: 2 });
const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;
const vehicleUrl = (id: string) =>
  `/tilefun/workshop.html#/tool/vehicles?view=${encodeURIComponent(id)}`;

test("normal Chromium can review every vehicle with the registered appearance", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const vehicles = manifest.candidates.filter((c) => c.kind === "vehicle");
  expect(vehicles).toHaveLength(180);
  for (const candidate of vehicles) {
    await page.goto(vehicleUrl(candidate.id));
    await expect(page.getByRole("heading", { name: candidate.name, exact: true })).toBeVisible();
    await expect(page.getByLabel("Vehicle geometry diagram"), candidate.id).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.getByRole("button", { name: "Approve view →", exact: true })).toBeEnabled();
  }
  expect(errors).toEqual([]);
});

test("vehicle appearance verification still blocks a mismatched manifest", async ({ page }) => {
  const id = "vehicle:compact-1:north";
  await page.route("**/api/workshop/manifest", async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as WorkshopManifest;
    const candidate = data.candidates.find((c) => c.id === id);
    if (!candidate) throw new Error("Missing vehicle candidate");
    candidate.fingerprint = "0".repeat(64);
    await route.fulfill({ response, json: data });
  });
  await page.goto(vehicleUrl(id));
  await expect(page.getByRole("alert")).toContainText("Vehicle appearance changed");
  await expect(page.getByRole("button", { name: "Approve view →", exact: true })).toBeDisabled();
});
