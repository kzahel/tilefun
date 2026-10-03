import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test("retired browser worlds stay listed and recreate with the same seed in a new container", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 812);
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  await page.getByPlaceholder("World name...").fill("Retired town");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  const original = await page.evaluate(async () => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    const id = game.mainMenu.currentWorldId;
    if (!id) throw Error("Missing current world");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tilefun-registry");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("worlds", "readwrite"),
          store = tx.objectStore("worlds"),
          request = store.get(id);
        request.onsuccess = () =>
          store.put({
            ...request.result,
            generation: { ...request.result.generation, version: "regional-v5" },
          });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    return id;
  });
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Retired generator — recreate to play.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recreate with same seed", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  const recreated = await page.evaluate(
    () =>
      (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game.mainMenu.currentWorldId,
  );
  expect(recreated).not.toBe(original);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Retired town", { exact: true })).toBeVisible();
  await expect(page.getByText("Retired town (recreated)", { exact: true })).toBeVisible();
});
