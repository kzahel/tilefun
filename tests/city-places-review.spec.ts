import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import { CITY_REVIEW_RUNS } from "../src/art/CityReviewRuns.js";
import { CITY_PLACES_REVIEW_CASES } from "../src/art/DenseDistrictShowcase.js";
import { CityPlacesSource } from "../src/generation/regional/CityPlacesPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

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
    await expect(page.locator(`[data-batch="${run}"]`)).toContainText("1 unchecked");
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
        const b = required(await page.locator(`#${id}`).boundingBox());
        expect(b).toBeTruthy();
        expect(b.y + b.height).toBeLessThanOrEqual(844);
      }
      const png = await page
        .locator("#building")
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
      writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(required(png.split(",")[1]), "base64"));
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
      `/tilefun/workshop.html#/review/district%3A${required(CITY_PLACES_REVIEW_CASES.find((c) => c.run === run)).id}`,
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
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          return g.stateView.props.some((p) => p.proceduralId?.includes(":city-places-"));
        }),
      )
      .toBe(true);
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

for (const kind of ["office", "condo-wide"])
  test(`v9 ${kind} can enter and return through its audited approach`, async ({ page }) => {
    const plan = new CityPlacesSource(regionalWorld(2026), 9).owner(0, 0);
    const lot = plan?.blocks.flatMap((b) => b.lots).find((l) => l.buildingType.includes(kind));
    if (!lot) throw Error("Missing architecture lot");
    const generation = {
      type: "regional",
      version: "regional-v9",
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: lot.entrance.x, y: lot.entrance.y, generation };
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(
      page.getByRole("button", { name: kind === "office" ? /^Enter shop/ : /^Enter apartment/ }),
    ).toBeVisible();
    await page.keyboard.press("e");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await page.getByRole("button", { name: "Return to street" }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(generation),
    );
  });

test("destination visitors move in gameplay and their deletion survives explorer inspection and reopen", async ({
  page,
}) => {
  const generation = {
    type: "regional",
    version: "regional-v10",
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
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return g.stateView.props.some((p) => p.type.startsWith("prop-city-architecture-v1-"));
      }),
    )
    .toBe(true);
  const read = () =>
    page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      return g.stateView.entities
        .filter((e) => e.type === "person7")
        .map((e) => ({ id: e.id, ...e.position }));
    });
  await expect.poll(async () => (await read()).length).toBe(1);
  const before = (await read())[0];
  if (!before) throw Error("Missing destination visitor");
  await expect
    .poll(async () => {
      const a = (await read())[0];
      return a ? Math.hypot(a.wx - before.wx, a.wy - before.wy) : 0;
    })
    .toBeGreaterThan(8);
  const changed = await page.evaluate((id) => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
    g.transport.send({ type: "flush" });
    return g.mainMenu.currentWorldId;
  }, before.id);
  await page.goto(
    `/tilefun/world-explorer.html?worldId=${changed}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
  );
  await expect(page.locator("#app")).toHaveAttribute("data-tile-complete", "true");
  await expect
    .poll(async () =>
      JSON.parse((await page.locator("#app").getAttribute("data-actor-ids")) ?? "[]"),
    )
    .not.toContain("settlement:0:0:city-places-v10:visitor:0");
  await page.getByRole("link", { name: "Play here" }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  await expect.poll(async () => (await read()).length).toBe(0);
  await page.screenshot({ path: "/tmp/tilefun-city-destinations-game.png" });
});
