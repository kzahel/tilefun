import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ArtNote } from "../src/art/ArtNotes.js";
import { DENSE_REVIEW_CASES } from "../src/art/DenseDistrictShowcase.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const url = "/tilefun/building-lab.html?run=districts";
const ready = '#app[data-ready="true"]';
test("three real district views share review navigation and fit phone controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/art-notes", (r) => r.fulfill({ json: [] }));
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("1/3");
  await page.locator("#building-note").fill("District draft");
  await page.locator("#next-building").click();
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#previous-building").click();
  await expect(page.locator("#building-note")).toHaveValue("District draft");
  for (const c of DENSE_REVIEW_CASES) {
    await page.locator("#district-case").selectOption(c.id);
    await expect(page.locator("#recipe-id")).toHaveText(c.id);
    await expect(page.locator("#facts")).toContainText("buildings");
    const chunks = Number(await page.locator("#building").getAttribute("data-chunks"));
    expect(chunks).toBeGreaterThan(0);
    expect(chunks).toBeLessThanOrEqual(81);
    const png = await page
      .locator("#building")
      .evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    writeFileSync(`/tmp/tilefun-${c.id}.png`, Buffer.from(required(png.split(",")[1]), "base64"));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of [
      "building",
      "previous-building",
      "next-building",
      "approve-building",
      "reject-building",
    ]) {
      const b = required(await page.locator(`#${id}`).boundingBox());
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(844);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.locator("#geometry").check();
  await page.screenshot({ path: "/tmp/tilefun-dense-debug.png", fullPage: true });
  await expect(page.locator("#district-play")).toHaveAttribute("href", /regional-v5/);
  expect(errors).toEqual([]);
});
test("district judgments pause independently, sync offline feedback, and reopen changed scenes", async ({
  page,
}) => {
  const notes: ArtNote[] = [];
  let online = true;
  await page.route("**/api/art-notes", (r) => {
    if (!online) return r.abort();
    if (r.request().method() === "POST") {
      notes.push(r.request().postDataJSON());
      return r.fulfill({ json: { saved: true } });
    }
    return r.fulfill({ json: notes });
  });
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#approve-building").click();
  await expect(page.locator("#review-progress")).toContainText("1 approved");
  expect(notes[0]?.buildingReview).toMatchObject({
    scene: "district",
    caseId: "district-v1-neighborhood",
    districtRecipe: "dense-district-v2",
    prefabIds: expect.arrayContaining(["prop-city-dense-v1-bakery-3"]),
    renderFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  await page.locator("#building-note").fill("Change frontage");
  await page.locator("#reject-building").click();
  online = false;
  await page.locator("#building-note").fill("Change green");
  await page.locator("#reject-building").click();
  await expect(page.locator("#review-pause")).toBeVisible();
  await page.reload();
  await expect(page.locator("#review-pause")).toBeVisible();
  await expect(page.locator("#queue-sync")).toContainText("pending server save");
  online = true;
  await page.locator("#refresh-building-notes").click();
  await expect(page.locator("#queue-sync")).toHaveText("Server inbox up to date.");
  await page.goto("/tilefun/building-lab.html?run=surfaces");
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.locator("#review-progress")).toContainText("0 approved");
  required(required(notes[0]).buildingReview).renderFingerprint = "0".repeat(64);
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#undo-building").click();
  await expect(page.locator("#review-pause")).toBeHidden();
  await page.locator("#review-filter").selectOption("unchecked");
  await expect(page.locator("#review-progress")).toContainText("0 approved");
});
test("district notes round trip through the isolated inbox and are discoverable from the master index", async ({
  page,
  request,
}) => {
  await page.goto("/tilefun/tools.html");
  await page.locator("#dense-review").click();
  await expect(page.locator(ready)).toBeVisible();
  const marker = `Dense API ${Date.now()}`;
  await page.locator("#building-note").fill(marker);
  await page.locator("#save-building-note").click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  const notes = (await (await request.get("/tilefun/api/art-notes")).json()) as ArtNote[];
  expect(notes.find((n) => n.note === marker)?.buildingReview).toMatchObject({
    scene: "district",
    districtRecipe: "dense-district-v2",
    caseId: "district-v1-neighborhood",
  });
  await page.goto("/tilefun/art-workbench.html?sheet=me-complete");
  await expect(
    page.locator('a[href*="run=districts"][href*="district-v1-neighborhood"]').first(),
  ).toBeVisible();
});
test("archived dense review hands off to the current station start with a moving train", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.locator(ready)).toBeVisible();
  await page.locator("#district-play").click();
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-tile-complete", "true");
  await expect(page.locator("#regional-revision")).toHaveValue("regional-v5");
  await page.getByRole("link", { name: "Create current world with this seed" }).click();
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(createDescriptor("regional", 2026)),
  );
  const read = () =>
    page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      return g.stateView.entities
        .filter((e) => e.type === "train-local-v1" || e.type === "train-curve-proof-v1")
        .map((e) => ({ id: e.id, ...e.position }));
    });
  await expect.poll(async () => (await read()).length).toBeGreaterThan(0);
  const before = await read();
  await expect
    .poll(
      async () =>
        (await read()).some((e) => {
          const old = before.find((o) => o.id === e.id);
          return old && Math.hypot(e.wx - old.wx, e.wy - old.wy) > 8;
        }),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-dense-game.png" });
});
test("dense building edits and actor tombstones survive saved-world inspection and resume", async ({
  page,
}) => {
  const crossing = required(plan.actors.find((a) => a.featureId.endsWith(":crossing:walker")));
  const generation = createDescriptor("regional", 2026);
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
      page.evaluate((crossing) => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return (
          g.stateView.props.some((p) => p.type.startsWith("prop-city-dense-v1-")) &&
          g.stateView.props.some((p) => p.type === "prop-street-lamp") &&
          g.stateView.entities.some(
            (e) => e.type === crossing.type && Math.abs(e.position.wy - crossing.wy) < 2,
          )
        );
      }, crossing),
    )
    .toBe(true);
  const changed = await page.evaluate(async (crossing) => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    const building = g.stateView.props.find((p) => p.type.startsWith("prop-city-dense-v1-"));
    const lamp = g.stateView.props.find((p) => p.type === "prop-street-lamp");
    const actor = g.stateView.entities.find(
      (e) => e.type === crossing.type && Math.abs(e.position.wy - crossing.wy) < 2,
    );
    if (!building || !lamp || !actor) throw new Error("Missing dense residency");
    const wx = lamp.position.wx + 16,
      wy = lamp.position.wy;
    g.transport.send({ type: "edit-delete-prop", propId: building.id });
    g.transport.send({ type: "edit-move-prop", propId: lamp.id, wx, wy });
    g.transport.send({ type: "edit-delete-entity", entityId: actor.id });
    const lifecycle = g as unknown as {
      loop: { stop(): void };
      netEmulatedTransport: {
        base: {
          setHidden(hidden: boolean): void;
          flush(): Promise<void>;
          shutdown(): Promise<void>;
        };
      };
    };
    lifecycle.loop.stop();
    lifecycle.netEmulatedTransport.base.setHidden(true);
    await lifecycle.netEmulatedTransport.base.flush();
    await lifecycle.netEmulatedTransport.base.shutdown();
    return {
      worldId: g.mainMenu.currentWorldId,
      buildingId: building.proceduralId,
      lampId: lamp.proceduralId,
      actorId: crossing.featureId,
      actorType: crossing.type,
      actorY: crossing.wy,
      wx,
      wy,
    };
  }, crossing);
  await page.goto(
    `/tilefun/world-explorer.html?worldId=${changed.worldId}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
  );
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-tile-complete", "true");
  await expect
    .poll(async () => JSON.parse((await app.getAttribute("data-actor-ids")) ?? "[]"))
    .not.toContain(changed.actorId);
  await page.getByRole("link", { name: "Play here" }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  await expect
    .poll(() =>
      page.evaluate((changed) => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        const lamp = g.stateView.props.find((p) => p.proceduralId === changed.lampId);
        return {
          deleted: !g.stateView.props.some((p) => p.proceduralId === changed.buildingId),
          actorDeleted: !g.stateView.entities.some(
            (e) => e.type === changed.actorType && Math.abs(e.position.wy - changed.actorY) < 2,
          ),
          wx: lamp?.position.wx,
          wy: lamp?.position.wy,
        };
      }, changed),
    )
    .toEqual({ deleted: true, actorDeleted: true, wx: changed.wx, wy: changed.wy });
});
const plan = required(new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0));
for (const kind of ["shop", "apartment"] as const)
  test(`promoted dense ${kind} enters and returns through the shared interior`, async ({
    page,
  }) => {
    const lot = required(
      plan.blocks
        .flatMap((b) => b.lots)
        .find((l) =>
          kind === "shop" ? l.buildingType.includes("bakery") : l.buildingType.includes("condo"),
        ),
    );
    const arrival = {
      x: lot.entrance.x,
      y: lot.entrance.y,
      generation: createDescriptor("regional", 2026),
    };
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    const enter = page.getByRole("button", { name: new RegExp(`Enter ${kind}`) });
    await expect(enter).toBeVisible();
    await enter.click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await page.getByRole("button", { name: "Return to street" }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect(enter).toBeVisible();
  });
