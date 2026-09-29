import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test("game creates and reopens every generator with the pinned descriptor in IndexedDB", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const choice of ["classic", "island", "flat", "regional"] as const) {
    const generation = createDescriptor(choice, 2026);
    await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("combobox", { name: "World type" })).toHaveValue(choice);
    await expect(page.getByRole("textbox", { name: "World seed" })).toHaveValue("2026");
    await page.getByPlaceholder("World name...").fill(`${choice} checkpoint`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-generator", choice);
    await expect(canvas).toHaveAttribute("data-seed", "2026");
    await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
    const metadata = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("tilefun-registry");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        return await new Promise<
          { name: string; generation?: unknown; seed?: number; worldType?: string }[]
        >((resolve, reject) => {
          const req = db.transaction("worlds").objectStore("worlds").getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    });
    const meta = metadata.find((world) => world.name === `${choice} checkpoint`);
    expect(meta?.generation).toEqual(generation);
    expect(meta?.seed).toBeUndefined();
    expect(meta?.worldType).toBeUndefined();
    await page.goto("/tilefun/");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-generator", choice);
    await expect(canvas).toHaveAttribute("data-generation", JSON.stringify(generation));
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(`${choice} · seed 2026 · ${generation.version}`, { exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("explorer handoff preserves settings and game reports an invalid seed", async ({ page }) => {
  await page.goto("/tilefun/world-explorer.html");
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page.getByRole("link", { name: "Create this world" }).click();
  await expect(page.getByRole("combobox", { name: "World type" })).toHaveValue("regional");
  await expect(page.getByRole("textbox", { name: "World seed" })).toHaveValue("2026");
  await page.getByRole("textbox", { name: "World seed" }).fill("4294967296");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Seed");
  await page.getByRole("textbox", { name: "World seed" }).fill("2026");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "regional");
});
