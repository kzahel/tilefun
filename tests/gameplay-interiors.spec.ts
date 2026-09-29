import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { DistrictSource } from "../src/generation/regional/DistrictStrategy.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const source = new DistrictSource(regionalWorld(2026));
for (const kind of ["apartment", "shop", "home"] as const)
  test(`enters and returns from the shared ${kind} interior`, async ({ page }) => {
    const plan = source.owner(0, kind === "home" ? 1 : 0);
    const lot = plan?.blocks
      .flatMap((b) => b.lots)
      .find((l) =>
        kind === "home"
          ? l.buildingType === "prop-country-house"
          : kind === "shop"
            ? l.buildingType.includes("bakery") || l.buildingType.includes("shop")
            : l.buildingType.startsWith("prop-regional-apartment-"),
      );
    if (!lot) throw new Error(`Missing ${kind} checkpoint`);
    const generation = createDescriptor("regional", 2026),
      arrival = { x: lot.entrance.x, y: lot.entrance.y, generation };
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    const enter = page.getByRole("button", { name: new RegExp(`Enter ${kind}`) });
    await expect(enter).toBeVisible();
    await page.keyboard.press("e");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect(page.getByRole("button", { name: "Return to street" })).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (
              document.querySelector("#game") as unknown as {
                __game: import("../src/client/GameClient.js").GameClient;
              }
            ).__game.stateView.props.filter((p) => p.type.startsWith("prop-interior-furniture:"))
              .length,
        ),
      )
      .toBe(3);
    await page.screenshot({ path: `/tmp/tilefun-gameplay-interior-${kind}.png` });
    if (kind === "apartment") {
      const player = () =>
        page.evaluate(
          () =>
            (
              document.querySelector("#game") as unknown as {
                __game: import("../src/client/GameClient.js").GameClient;
              }
            ).__game.stateView.playerEntity,
        );
      await page.keyboard.down("Space");
      await expect.poll(async () => (await player()).wz ?? 0).toBeGreaterThan(2);
      await page.keyboard.up("Space");
      await expect.poll(async () => Math.abs((await player()).wz ?? 0)).toBeLessThan(1);
      const y = (await player()).position.wy;
      await page.keyboard.down("ArrowDown");
      await expect.poll(async () => (await player()).position.wy - y).toBeGreaterThan(4);
      await page.keyboard.up("ArrowDown");
    }
    await page.getByRole("button", { name: "Return to street" }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect(enter).toBeVisible();
    const position = await page.evaluate(
      () =>
        (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game.stateView.playerEntity.position,
    );
    expect(
      Math.hypot(position.wx / 16 - lot.entrance.x, position.wy / 16 - lot.entrance.y),
    ).toBeLessThan(2);
    await enter.click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    if (kind === "apartment") {
      const remainingFurniture = () =>
        page.evaluate(() => {
          const game = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          return game.stateView.props.filter((p) => p.type.startsWith("prop-interior-furniture:"))
            .length;
        });
      await expect.poll(remainingFurniture).toBe(3);
      await page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        const bed = game.stateView.props.find((p) => p.proceduralId === "fixture:bed");
        if (!bed) throw new Error("Missing bed");
        const table = game.stateView.props.find((p) => p.proceduralId === "fixture:side-table");
        if (!table) throw new Error("Missing side table");
        game.transport.send({ type: "edit-move-prop", propId: table.id, wx: 88, wy: 70 });
        game.transport.send({ type: "edit-delete-prop", propId: bed.id });
        game.transport.send({ type: "flush" });
      });
      await expect.poll(remainingFurniture).toBe(2);
      await page.getByRole("button", { name: "Return to street" }).click();
      await page.goto("/tilefun/");
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      const resume = page.getByRole("button", { name: "Resume", exact: true });
      if (await resume.isVisible()) await resume.click();
      await expect(enter).toBeVisible();
      await enter.click();
      await expect.poll(remainingFurniture).toBe(2);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                document.querySelector("#game") as unknown as {
                  __game: import("../src/client/GameClient.js").GameClient;
                }
              ).__game.stateView.props.find((p) => p.proceduralId === "fixture:side-table")
                ?.position.wx,
          ),
        )
        .toBe(88);
      await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
      // A reload from inside resumes the same parent doorway rather than an empty realm origin.
      await page.goto("/tilefun/");
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      const resumeAfterInterior = page.getByRole("button", { name: "Resume", exact: true });
      if (await resumeAfterInterior.isVisible()) await resumeAfterInterior.click();
      await expect(enter).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
