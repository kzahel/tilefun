import { expect, test } from "@playwright/test";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../src/interiors/BuildingDoors.js";

for (const kind of ["butcher", "condo-bay"]) {
  test(`${kind}: walk between entrances, exit at the selected door and reload indoors`, async ({
    page,
  }) => {
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes(kind));
    if (!lot) throw new Error("Missing building");
    const doors = exteriorDoors({
      type: lot.buildingType,
      position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
    });
    const secondary = doors[1];
    if (!secondary) throw new Error("Missing second entrance");
    const generation = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: secondary.outside.wx / 16, y: secondary.outside.wy / 16, generation };
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.getByRole("button", { name: /^Enter (shop|apartment)/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    const state = () =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return {
          interior: game.stateView.interior,
          player: (game.stateView as import("../src/client/ClientStateView.js").RemoteStateView)
            .serverPlayerEntity.position,
        };
      });
    const before = await state();
    expect(before.interior?.layout).toBe(kind === "butcher" ? "shop-v2" : "apartment-v2");
    const entry = before.interior?.doors?.find((d) => d.id === secondary.id);
    const exit = before.interior?.doors?.find((d) => d.id === "street");
    if (!entry || !exit) throw new Error("Missing room doors");
    await expect.poll(async () => (await state()).player).toEqual(entry.arrival);
    await page.screenshot({ path: `/tmp/tilefun-building-${kind}-interior.png` });
    // Traverse the shared hall with real input and collision; no teleporting across walls.
    const direction = exit.arrival.wx > entry.arrival.wx ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(direction);
    await expect
      .poll(async () => Math.abs((await state()).player.wx - exit.arrival.wx))
      .toBeLessThan(15);
    await page.keyboard.up(direction);
    await page.getByRole("button", { name: /Return to street/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect
      .poll(async () => {
        const outside = (await state()).player;
        return Math.hypot(outside.wx - exit.outside.wx, outside.wy - exit.outside.wy);
      })
      .toBeLessThan(2);
    await page.getByRole("button", { name: /^Enter (shop|apartment)/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await page.goto("/tilefun/");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    expect((await state()).interior).toEqual(before.interior);
    await expect.poll(async () => (await state()).player).toEqual(exit.arrival);
    expect(errors).toEqual([]);
  });
}

test("all four playable layouts have usable Workshop previews", async ({ page }) => {
  for (const id of ["butcher", "bay-apartment", "shop", "apartment"]) {
    await page.goto(`/tilefun/workshop.html#/review/building-layout-v2-${id}?show=all`);
    // ReviewPage verifies the rendered fingerprint before enabling review.
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  }
});

for (const kind of ["butcher", "condo-bay"]) {
  test(`${kind}: automatic walk-through, fade, arrival and reload latch`, async ({ page }) => {
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes(kind));
    if (!lot) throw new Error("Missing building");
    const door = exteriorDoors({
      type: lot.buildingType,
      position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
    })[1];
    if (!door) throw new Error("Missing second door");
    const generation = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: door.outside.wx / 16, y: (door.outside.wy + 48) / 16, generation };
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    // New worlds open in the editor; walk-through is deliberately play-only.
    await page.keyboard.press("Tab");
    // Observe the actual presented actor, not just its already-safe authority position.
    await page.evaluate(() => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      const probe: {
        motions: import("../src/interiors/DoorTraversal.js").DoorMotion[];
        frames: { opacity: number; position: { wx: number; wy: number } }[];
      } = { motions: [], frames: [] };
      Reflect.set(window, "exitDoorProbe", probe);
      const presentation = Reflect.get(
        game,
        "doorPresentation",
      ) as import("../src/client/DoorPresentation.js").DoorPresentation;
      const receive = presentation.receive.bind(presentation);
      presentation.receive = (message, ...args) => {
        if (message.self) probe.motions.push(message);
        receive(message, ...args);
      };
      const present = presentation.entities.bind(presentation);
      presentation.entities = (...args) => {
        const entities = present(...args);
        const actor = entities.find((e) => e.id === game.stateView.playerEntity.id);
        if (!game.stateView.interior && probe.motions.at(-1)?.phase === "arrive" && actor) {
          const veil = document.querySelector<HTMLElement>('[data-door-fade="true"]');
          probe.frames.push({
            opacity: Number(veil?.style.opacity),
            position: { ...actor.position },
          });
        }
        return entities;
      };
    });
    await page.keyboard.down("ArrowUp");
    const fade = page.locator('[data-door-fade="true"]');
    await expect(fade).toHaveAttribute("data-stage", "depart");
    await page.keyboard.up("ArrowUp");
    await page.screenshot({ path: `/tmp/tilefun-auto-door-${kind}-opening.png` });
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect(fade).toHaveAttribute("data-stage", "idle");
    await page.screenshot({ path: `/tmp/tilefun-auto-door-${kind}.png` });
    // The arrival latch requires walking clear before attempting the reverse trip.
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowDown");
    await expect(fade).toHaveAttribute("data-stage", "depart");
    await page.keyboard.up("ArrowDown");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    await expect(fade).toHaveAttribute("data-stage", "arrive");
    await page.screenshot({ path: `/tmp/tilefun-exit-${kind}-emerging.png` });
    await expect(fade).toHaveAttribute("data-stage", "idle");
    const probe = (await page.evaluate(() => Reflect.get(window, "exitDoorProbe"))) as {
      motions: import("../src/interiors/DoorTraversal.js").DoorMotion[];
      frames: { opacity: number; position: { wx: number; wy: number } }[];
    };
    const entry = probe.motions[0],
      exit = probe.motions[3];
    expect(exit?.from).toEqual(entry?.to);
    expect(exit?.to).toEqual(door.outside);
    if (kind === "butcher") expect(exit?.overlay?.kind).toBe("butcher");
    // The doorway itself is visible before the guided walk heads onto the sidewalk.
    expect(
      probe.frames.some(
        (f) =>
          f.opacity <= 0.5 && f.position.wx === exit?.from.wx && f.position.wy === exit?.from.wy,
      ),
    ).toBe(true);
    expect(
      probe.frames.some(
        (f) => f.position.wy > (exit?.from.wy ?? Infinity) && f.position.wy < door.outside.wy,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(450);
    await page.keyboard.up("ArrowUp");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
    expect(errors).toEqual([]);
  });
}

test("door animation candidates match the registered preview", async ({ page }) => {
  for (const side of ["left", "right"]) {
    await page.goto(`/tilefun/workshop.html#/review/pattern:door-butcher-v1-${side}?show=all`);
    await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  }
});
