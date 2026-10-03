import { expect, type Page, test } from "@playwright/test";
import { PROMOTED_CHARACTERS } from "../src/characters/PromotedCharacters.js";
import type { Entity } from "../src/entities/Entity.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { ClientMessage } from "../src/shared/protocol.js";

type GameHarness = {
  stateView: { playerEntity: Entity; entities: Entity[] };
  transport: { send(m: ClientMessage): void };
  netEmulatedTransport: {
    base: { shutdown(): Promise<void>; flush(): Promise<void>; setHidden(v: boolean): void };
  };
  loop: { stop(): void };
};

const playerSheet = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector("#game") as unknown as { __game: GameHarness }).__game.stateView
        .playerEntity.sprite?.sheetKey,
  );
async function choose(page: Page, name: string) {
  const picker = page.getByTestId("player-model-picker");
  if (!(await picker.isVisible())) {
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  }
  if (!(await picker.evaluate((el) => (el as HTMLDetailsElement).open)))
    await picker.locator("summary").click();
  await picker.getByRole("button", { name, exact: true }).click();
  await expect(picker.getByRole("status")).toHaveText("Character saved.");
  await expect(picker.getByRole("button", { name, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test("approved NPCs place, save and reload in the Worker; player choice persists separately", async ({
  page,
}) => {
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 422)))}`,
  );
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await choose(page, "Trail Explorer");
  await expect.poll(() => playerSheet(page)).toBe("character-person-v1");
  await page.getByTestId("player-model-picker").locator("summary").click();
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  for (const c of PROMOTED_CHARACTERS) {
    const button = page.getByRole("button", { name: `Place ${c.name} (click map)`, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    // Real editor pointer path, above the tool tray.
    await page
      .locator("#game")
      .click({ position: { x: 300 + PROMOTED_CHARACTERS.indexOf(c) * 70, y: 180 } });
  }
  const npcTypes = () =>
    page.evaluate(() =>
      (
        document.querySelector("#game") as unknown as { __game: GameHarness }
      ).__game.stateView.entities
        .filter((e) => e.type.startsWith("character-"))
        .map((e) => e.type)
        .sort(),
    );
  const expected = PROMOTED_CHARACTERS.map((c) => c.sheetKey).sort();
  await expect.poll(npcTypes).toEqual(expected);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  const before = await page.evaluate(
    () =>
      (document.querySelector("#game") as unknown as { __game: GameHarness }).__game.stateView
        .playerEntity.position.wx,
  );
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector("#game") as unknown as { __game: GameHarness }).__game.stateView
            .playerEntity.position.wx,
      ),
    )
    .toBeGreaterThan(before + 10);
  await page.keyboard.up("ArrowRight");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameHarness }).__game;
    g.loop.stop();
    const host = g.netEmulatedTransport.base;
    host.setHidden(true);
    await host.flush();
    await host.shutdown();
  });
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => playerSheet(page)).toBe("character-person-v1");
  await expect.poll(npcTypes).toEqual(expected);
  await choose(page, "Classic Player");
  await expect.poll(() => playerSheet(page)).toBe("player");
  await page.screenshot({ path: "/tmp/tilefun-player-model-picker.png" });
});

test("phone picker scrolls, animates previews and isolates profile choices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await choose(page, "Brown Bear");
  const picker = page.getByTestId("player-model-picker");
  const preview = picker.getByRole("button", { name: "Brown Bear", exact: true }).locator("canvas");
  const first = await preview.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await expect
    .poll(() => preview.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(first);
  const bounds = await picker.boundingBox();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/tilefun-player-model-picker-phone.png" });
  // The second profile starts with the classic appearance, leaving the first choice intact.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("tilefun-profiles");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("profiles", "readwrite");
      tx.objectStore("profiles").put({
        id: "second-character-profile",
        name: "Second Player",
        pin: null,
        createdAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByText("Second Player", { exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => playerSheet(page)).toBe("player");
});
