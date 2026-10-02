import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { CITY_REVIEW_RUNS } from "../src/art/CityReviewRuns.js";
import { CITY_PLACES_REVIEW_CASES } from "../src/art/DenseDistrictShowcase.js";

for (const [run, meta] of Object.entries(CITY_REVIEW_RUNS)) {
  test(`${run} is indexed with exact feedback, phone controls and independent review state`, async ({
    page,
  }) => {
    const notes: unknown[] = [];
    await page.route("**/api/art-notes", (r) => {
      if (r.request().method() === "POST") notes.push(r.request().postDataJSON());
      return r.fulfill({ json: r.request().method() === "POST" ? { saved: true } : notes });
    });
    await page.goto("/tilefun/workshop.html");
    await expect(page.locator(`[data-batch="${run}"]`)).toContainText(
      `${CITY_PLACES_REVIEW_CASES.filter((c) => c.run === run).length} unchecked`,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    for (const c of CITY_PLACES_REVIEW_CASES.filter((c) => c.run === run)) {
      await page.goto(`/tilefun/building-lab.html?run=${run}&case=${c.id}`);
      await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
      await expect(page.locator("#recipe-id")).toHaveText(c.id);
      expect(
        Number(await page.locator("#building").getAttribute("data-chunks")),
      ).toBeLessThanOrEqual(81);
      for (const id of [
        "approve-building",
        "reject-building",
        "next-building",
        "previous-building",
      ]) {
        const b = await page.locator(`#${id}`).boundingBox();
        expect(b).toBeTruthy();
        expect(b!.y + b!.height).toBeLessThanOrEqual(844);
      }
      const png = await page
        .locator("#building")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
      writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(png.split(",")[1]!, "base64"));
      await expect(page.locator("#district-play")).toHaveAttribute(
        "href",
        new RegExp(meta.version),
      );
    }
    await page.locator("#building-note").fill("Please review this place");
    await page.locator("#save-building-note").click();
    await expect.poll(() => notes.length).toBeGreaterThan(0);
    expect(notes.at(-1)).toMatchObject({
      buildingReview: { districtRecipe: meta.recipe, url: expect.stringContaining(`run=${run}`) },
    });
    await page.goto(
      `/tilefun/workshop.html#/review/district%3A${CITY_PLACES_REVIEW_CASES.find((c) => c.run === run)!.id}`,
    );
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  });
  test(`${run} explorer and actual game use the same descriptor and persist edits`, async ({
    page,
  }) => {
    const generation = {
      type: "regional",
      version: meta.version,
      seed: 2026,
      preset: "temperate-v1",
    };
    await page.goto(
      `/tilefun/world-explorer.html?generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
    );
    await expect(page.locator("#app")).toHaveAttribute("data-tile-complete", "true");
    await page.getByRole("link", { name: "Play here" }).click();
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(generation),
    );
    const result = await page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      const p = g.stateView.props.find((p) => p.proceduralId?.includes(":city-places-"));
      if (!p) throw Error("Missing actual city place props");
      g.transport.send({ type: "edit-delete-prop", propId: p.id });
      g.transport.send({ type: "flush" });
      return { worldId: g.mainMenu.currentWorldId, id: p.proceduralId };
    });
    await page.goto(
      `/tilefun/world-explorer.html?worldId=${result.worldId}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
    );
    await expect(page.locator("#app")).toHaveAttribute("data-tile-complete", "true");
    await page.getByRole("link", { name: "Play here" }).click();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(generation),
    );
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            (
              document.querySelector("#game") as unknown as {
                __game: import("../src/client/GameClient.js").GameClient;
              }
            ).__game.stateView.props.some((p) => p.proceduralId === id),
          result.id,
        ),
      )
      .toBe(false);
  });
}
