import { expect, test } from "@playwright/test";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const source = new DenseDistrictSource(regionalWorld(2026), true);
for (const kind of ["apartment", "shop"] as const)
  test(`enters and returns from the shared ${kind} interior`, async ({ page }) => {
    const plan = source.owner(0, 0);
    const lot = plan?.blocks
      .flatMap((b) => b.lots)
      .find((l) =>
        kind === "shop" ? l.buildingType.includes("butcher") : l.buildingType.includes("condo"),
      );
    if (!lot) throw new Error(`Missing ${kind} checkpoint`);
    const generation = {
        type: "regional",
        version: CURRENT_REGIONAL_VERSION,
        seed: 2026,
        preset: "temperate-v1",
      } as const,
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
      .toBe(kind === "apartment" ? 6 : 5);
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
      await expect.poll(remainingFurniture).toBe(kind === "apartment" ? 6 : 5);
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
        game.transport.send({ type: "edit-move-prop", propId: table.id, wx: 120, wy: 112 });
        game.transport.send({ type: "edit-delete-prop", propId: bed.id });
        game.transport.send({ type: "flush" });
      });
      await expect.poll(remainingFurniture).toBe(5);
      await page.getByRole("button", { name: "Return to street" }).click();
      await page.goto("/tilefun/");
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      const resume = page.getByRole("button", { name: "Resume", exact: true });
      if (await resume.isVisible()) await resume.click();
      await expect(enter).toBeVisible();
      await enter.click();
      await expect.poll(remainingFurniture).toBe(5);
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
        .toBe(120);
      await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
      // A reload resumes the same interior, including the saved furniture.
      await page.goto("/tilefun/");
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      const resumeAfterInterior = page.getByRole("button", { name: "Resume", exact: true });
      if (await resumeAfterInterior.isVisible()) await resumeAfterInterior.click();
      await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
      await expect.poll(remainingFurniture).toBe(5);
    }
    expect(errors).toEqual([]);
  });
