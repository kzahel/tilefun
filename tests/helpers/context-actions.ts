import { expect, type Page } from "@playwright/test";

/** The normal contextual menu, shared by game, labs and capture runners. */
export async function chooseVehicleAction(page: Page, name: string, touch = false) {
  const menu = page.getByTestId("context-actions");
  if (!(await menu.evaluate((e) => (e as HTMLDialogElement).open))) {
    const launcher = page.locator("[data-context-actions]");
    if (touch) await launcher.tap();
    else await launcher.click();
  }
  await expect(menu).toBeVisible();
  const action = menu.getByRole("button", { name, exact: true });
  if (touch) await action.tap();
  else await action.click();
  await expect(menu).toBeHidden();
}
