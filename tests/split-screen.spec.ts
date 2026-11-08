import { expect, type Page, test } from "@playwright/test";
import { flushLocalWorld, stopLocalWorld, worldRecords } from "./helpers/local-world.js";

// Split screen (226): real `KeyboardEvent.code` routing for two keyboard schemes, and
// two mocked standard pads. Input routing and DOM menus, not GPU output, so Canvas.
const FLAT = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
const GAME = `/tilefun/?renderer=canvas&generation=${encodeURIComponent(JSON.stringify(FLAT))}`;

type Game = import("../src/client/GameTestHooks.js").GameTestHooks;
type Snapshot = { views: number[][]; seats: number[]; positions: Record<number, number[]> };

/** Each view's region and seat, and every seat's authoritative position. */
function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const game = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const replica = game.stateView as import("../src/client/ClientStateView.js").RemoteStateView;
    const positions: Record<number, number[]> = {};
    for (const [seat, id] of replica.seats.entities) {
      const entity = replica.serverEntities.find((e) => e.id === id);
      if (entity) positions[seat] = [entity.position.wx, entity.position.wy];
    }
    return {
      views: game.device.views.map((v) => [v.seat, v.region.x, v.region.width]),
      seats: game.device.seats.list().map((s) => s.seat),
      positions,
    };
  });
}

async function startFlatWorld(page: Page, errors: string[]) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(GAME);
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");
  await expect.poll(async () => (await snapshot(page)).positions[0]).toBeTruthy();
}

/** Hold keys for a while and return each seat's movement. */
async function moved(page: Page, hold: () => Promise<void>, release: () => Promise<void>) {
  const before = await snapshot(page);
  await hold();
  await page.waitForTimeout(700);
  await release();
  await page.waitForTimeout(300);
  const after = await snapshot(page);
  const delta = (seat: number): [number, number] => {
    const [ax = 0, ay = 0] = after.positions[seat] ?? [];
    const [bx = 0, by = 0] = before.positions[seat] ?? [];
    return [ax - bx, ay - by];
  };
  return { 0: delta(0), 1: delta(1) };
}

test("a second keyboard player joins with Slash and plays the arrows in its own view", async ({
  page,
}) => {
  const errors: string[] = [];
  await startFlatWorld(page, errors);
  await page.keyboard.press("Slash");
  await expect
    .poll(async () => (await snapshot(page)).views)
    .toEqual([
      [0, 0, 640],
      [1, 640, 640],
    ]);
  await expect.poll(async () => (await snapshot(page)).positions[1]).toBeTruthy();
  await expect(page.getByTestId("gem-hud")).toBeHidden(); // each view draws its own badge
  // Seat 0's taps resolve through its own view (the left half), not the whole canvas.
  const tapRegion = () =>
    page.evaluate(() => {
      const game = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      return Reflect.get(Reflect.get(game, "tapMovement"), "region");
    });
  await expect.poll(tapRegion).toMatchObject({ x: 0, y: 0, width: 640 });
  // Real physical codes: seat 0 keeps WASD, the guest (joined one tile to its right)
  // has the arrows; they walk apart.
  const apart = await moved(
    page,
    async () => {
      await page.keyboard.down("KeyA");
      await page.keyboard.down("ArrowRight");
    },
    async () => {
      await page.keyboard.up("KeyA");
      await page.keyboard.up("ArrowRight");
    },
  );
  expect(apart[0][0]).toBeLessThan(-20);
  expect(apart[1][0]).toBeGreaterThan(20);
  const down = await moved(
    page,
    () => page.keyboard.down("ArrowDown"),
    () => page.keyboard.up("ArrowDown"),
  );
  expect(Math.abs(down[0][1])).toBeLessThan(1); // the arrows no longer move seat 0
  expect(down[1][1]).toBeGreaterThan(20);
  // The guest leaves from the menu; seat 0 gets the arrows back.
  await page.keyboard.press("Escape");
  const menu = page.getByTestId("world-menu");
  await expect(menu).toHaveAttribute("data-page", "home");
  await menu.getByRole("button", { name: "Player 2 leaves", exact: true }).click();
  await expect(menu.getByRole("button", { name: "Player 2 leaves", exact: true })).toBeHidden();
  await menu.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).views).toEqual([[0, 0, 1280]]);
  await expect(page.getByTestId("gem-hud")).toBeVisible();
  const solo = await moved(
    page,
    () => page.keyboard.down("ArrowUp"),
    () => page.keyboard.up("ArrowUp"),
  );
  expect(solo[0][1]).toBeLessThan(-20);
  expect(errors).toEqual([]);
});

test.describe("two pads", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const pad = (index: number) => ({
        connected: true,
        mapping: "standard",
        index,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
      });
      const pads = [pad(0), pad(1)];
      Object.assign(window, { testPads: pads });
      Object.defineProperty(navigator, "getGamepads", { value: () => pads });
    });
  });

  type Pads = { testPads: { axes: number[]; buttons: { pressed: boolean; value: number }[] }[] };
  const frames = (page: Page, count: number) =>
    page.evaluate(async (n) => {
      for (let i = 0; i < n; i++)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, count);
  async function press(page: Page, pad: number, button: number) {
    await page.evaluate(
      ([p, b]) => {
        const target = (window as unknown as Pads).testPads[p as number]?.buttons[b as number];
        if (target) Object.assign(target, { pressed: true, value: 1 });
      },
      [pad, button],
    );
    await frames(page, 3);
    await page.evaluate(
      ([p, b]) => {
        const target = (window as unknown as Pads).testPads[p as number]?.buttons[b as number];
        if (target) Object.assign(target, { pressed: false, value: 0 });
      },
      [pad, button],
    );
    await frames(page, 3);
  }
  const stick = (page: Page, pad: number, x: number, y: number) =>
    page.evaluate(
      ([p, ax, ay]) => {
        const axes = (window as unknown as Pads).testPads[p as number]?.axes;
        if (axes) {
          axes[0] = ax as number;
          axes[1] = ay as number;
        }
      },
      [pad, x, y],
    );
  const focused = (page: Page) => page.evaluate(() => document.activeElement?.textContent ?? "");

  test("a second pad joins its own view, opens and drives the menu, and leaves", async ({
    page,
  }) => {
    const errors: string[] = [];
    await startFlatWorld(page, errors);
    // Pad 0 is seat 0's once it is used; pad 1's press joins Player 2.
    await stick(page, 0, 1, 0);
    await frames(page, 3);
    await stick(page, 0, 0, 0);
    await press(page, 1, 0);
    await expect
      .poll(async () => (await snapshot(page)).views)
      .toEqual([
        [0, 0, 640],
        [1, 640, 640],
      ]);
    await expect.poll(async () => (await snapshot(page)).positions[1]).toBeTruthy();
    const apart = await moved(
      page,
      async () => {
        await stick(page, 0, 0, 1);
        await stick(page, 1, 0, -1);
      },
      async () => {
        await stick(page, 0, 0, 0);
        await stick(page, 1, 0, 0);
      },
    );
    expect(apart[0][1]).toBeGreaterThan(20);
    expect(apart[1][1]).toBeLessThan(-20);
    // The guest's Menu button opens the world menu, which only its pad drives.
    await press(page, 1, 9);
    const menu = page.getByTestId("world-menu");
    await expect(menu).toHaveAttribute("data-page", "home");
    await expect.poll(() => focused(page)).toBe("Resume");
    await press(page, 0, 13); // seat 0's pad does not move the guest's menu
    expect(await focused(page)).toBe("Resume");
    for (let i = 0; i < 6 && (await focused(page)) !== "Player 2 leaves"; i++)
      await press(page, 1, 13);
    expect(await focused(page)).toBe("Player 2 leaves");
    await press(page, 1, 0);
    await expect(menu.getByRole("button", { name: "Player 2 leaves", exact: true })).toBeHidden();
    await expect.poll(async () => (await snapshot(page)).seats).toEqual([0]);
    await press(page, 1, 1); // back: the menu closes and play resumes on one view
    await expect(menu).toBeHidden();
    await expect.poll(async () => (await snapshot(page)).views).toEqual([[0, 0, 1280]]);
    expect(errors).toEqual([]);
  });

  test("Options opened from a guest's pad returns focus to its opener, and the guest keeps the menu", async ({
    page,
  }) => {
    const errors: string[] = [];
    await startFlatWorld(page, errors);
    await stick(page, 0, 1, 0);
    await frames(page, 3);
    await stick(page, 0, 0, 0);
    await press(page, 1, 0);
    await expect.poll(async () => (await snapshot(page)).positions[1]).toBeTruthy();
    await press(page, 1, 9);
    const menu = page.getByTestId("world-menu");
    await expect(menu).toHaveAttribute("data-page", "home");
    await expect.poll(() => focused(page)).toBe("Resume");
    for (let i = 0; i < 8 && (await focused(page)) !== "Options"; i++) await press(page, 1, 13);
    expect(await focused(page)).toBe("Options");
    await press(page, 1, 0);
    const options = page.getByTestId("options-dialog");
    await expect(options).toBeVisible();
    const inOptions = await focused(page);
    await press(page, 0, 13); // seat 0's pad does not drive the guest's Options
    expect(await focused(page)).toBe(inOptions);
    await press(page, 1, 1); // back closes Options onto its opener
    await expect(options).toBeHidden();
    await expect.poll(() => focused(page)).toBe("Options");
    await press(page, 0, 12);
    expect(await focused(page)).toBe("Options");
    await press(page, 1, 12); // the guest still drives the menu
    expect(await focused(page)).not.toBe("Options");
    await press(page, 1, 1); // back: the menu closes and both seats play on
    await expect(menu).toBeHidden();
    await expect.poll(async () => (await snapshot(page)).views.length).toBe(2);
    const apart = await moved(
      page,
      async () => {
        await stick(page, 0, 0, 1);
        await stick(page, 1, 0, -1);
      },
      async () => {
        await stick(page, 0, 0, 0);
        await stick(page, 1, 0, 0);
      },
    );
    expect(apart[0][1]).toBeGreaterThan(20);
    expect(apart[1][1]).toBeLessThan(-20);
    expect(errors).toEqual([]);
  });
});

test("the world saves both seats; after a reload seat 0 resumes and a guest joins beside it", async ({
  page,
}) => {
  const errors: string[] = [];
  await startFlatWorld(page, errors);
  await page.keyboard.press("Slash");
  await expect.poll(async () => (await snapshot(page)).positions[1]).toBeTruthy();
  await moved(
    page,
    async () => {
      await page.keyboard.down("KeyA");
      await page.keyboard.down("ArrowRight");
    },
    async () => {
      await page.keyboard.up("KeyA");
      await page.keyboard.up("ArrowRight");
    },
  );
  const saved = await snapshot(page);
  const [hostX = 0, hostY = 0] = saved.positions[0] ?? [];
  const [guestX = 0, guestY = 0] = saved.positions[1] ?? [];
  expect(guestX - hostX).toBeGreaterThan(48); // walked apart
  await flushLocalWorld(page);
  // Each seat has its own record: the guest's under its host's key, by seat.
  const players = (await worldRecords(page)).filter((r) => r.collection === "players");
  const host = players.find((r) => !r.key.includes("#"));
  const guest = players.find((r) => r.key === `${host?.key}#1`);
  expect([host?.value, guest?.value]).toMatchObject([
    { x: expect.closeTo(hostX, -1), y: expect.closeTo(hostY, -1) },
    { x: expect.closeTo(guestX, -1), y: expect.closeTo(guestY, -1) },
  ]);
  await stopLocalWorld(page);
  await page.goto("/tilefun/?renderer=canvas"); // reopen the saved world, not a new one
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect.poll(async () => (await snapshot(page)).positions[0]).toBeTruthy();
  const resumed = await snapshot(page);
  expect(resumed.seats).toEqual([0]); // guests join again themselves
  expect(resumed.positions[0]?.[0]).toBeCloseTo(hostX, -1);
  expect(resumed.positions[0]?.[1]).toBeCloseTo(hostY, -1);
  await page.keyboard.press("Slash");
  await expect.poll(async () => (await snapshot(page)).positions[1]).toBeTruthy();
  const rejoined = await snapshot(page);
  // Guests follow seat 0 (226): the returning guest plays beside it with its own record.
  const [x0 = 0, y0 = 0] = rejoined.positions[0] ?? [];
  const [x1 = 0, y1 = 0] = rejoined.positions[1] ?? [];
  expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(40);
  expect(rejoined.views.map((v) => v[0])).toEqual([0, 1]);
  expect(errors).toEqual([]);
});
