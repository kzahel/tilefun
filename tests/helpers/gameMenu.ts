import { expect, type Page } from "@playwright/test";
export async function openHome(page: Page): Promise<void> {
  // Own the opening toggle: a caller's preceding Escape may still be awaiting
  // the Worker realm list, so a second Escape can close the newly opened menu.
  const menu = page.getByTestId("world-menu");
  if (!(await menu.isVisible())) await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  while ((await menu.getAttribute("data-page")) !== "home")
    await menu.getByRole("button", { name: "Back", exact: true }).click();
}
export async function openWorlds(page: Page): Promise<void> {
  await openHome(page);
  const menu = page.getByTestId("world-menu");
  await menu.getByRole("button", { name: "Worlds", exact: true }).click();
  await expect(menu).toHaveAttribute("data-page", "worlds");
}
export async function openCreate(page: Page): Promise<void> {
  const menu = page.getByTestId("world-menu");
  if ((await menu.isVisible()) && (await menu.getAttribute("data-page")) === "create") return;
  await openWorlds(page);
  await menu.getByRole("button", { name: "Create new world", exact: true }).click();
}
