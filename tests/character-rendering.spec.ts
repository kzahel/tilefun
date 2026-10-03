import { expect, test } from "@playwright/test";
import { CHARACTERS } from "../src/characters/CharacterCatalog.js";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

// Full Chromium exercises the GPU path that headless-shell cannot reproduce.
test.use({ channel: "chromium", deviceScaleFactor: 2 });

test("normal Chromium verifies every character against the generated manifest", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const def of CHARACTERS) {
    await page.goto(`/tilefun/workshop.html#/tool/character-lab?character=${def.id}`);
    await expect(page.getByRole("heading", { name: def.name, exact: true })).toBeVisible();
    await expect(page.getByLabel("Character movement test"), def.id).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.getByRole("button", { name: "Approve character" })).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("character verification rejects a mismatched manifest without enabling reviews", async ({
  page,
}) => {
  await page.route("**/api/workshop/manifest", async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as WorkshopManifest;
    const candidate = data.candidates.find((c) => c.id === "character:tiger");
    if (!candidate) throw new Error("Missing character candidate");
    candidate.fingerprint = "0".repeat(64);
    await route.fulfill({ response, json: data });
  });
  await page.goto("/tilefun/workshop.html#/tool/character-lab?character=tiger");
  await expect(page.getByRole("alert")).toContainText("report a rendering mismatch");
  await expect(page.getByRole("button", { name: "Approve character" })).toBeDisabled();
});
