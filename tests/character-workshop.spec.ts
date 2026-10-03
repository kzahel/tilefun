import { expect, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ArtNote } from "../src/art/ArtNotes.js";

const url = "/tilefun/workshop.html#/tool/character-lab";

test("character lab lists six candidates and exercises movement, grounding, animation and editing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html");
  await expect(page.getByRole("heading", { name: "Character movement & geometry" })).toBeVisible();
  await page.locator('[data-batch="character-lab"]').getByRole("link").click();
  const canvas = page.getByLabel("Character movement test");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(page.getByLabel("Character", { exact: true }).locator("option")).toHaveCount(6);
  for (const [key, direction] of [
    ["ArrowRight", "3"],
    ["ArrowLeft", "2"],
    ["ArrowUp", "1"],
    ["ArrowDown", "0"],
  ]) {
    await canvas.focus();
    await page.keyboard.down(required(key));
    await expect(canvas).toHaveAttribute("data-moving", "true");
    await expect(canvas).toHaveAttribute("data-direction", required(direction));
    await expect.poll(() => canvas.getAttribute("data-frame")).not.toBe("0");
    await page.keyboard.up(required(key));
    await expect(canvas).toHaveAttribute("data-moving", "false");
    await expect(canvas).toHaveAttribute("data-frame", "0");
  }
  await canvas.focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await canvas.getAttribute("data-z"))).toBeGreaterThan(0);
  await page.keyboard.up("Space");
  await expect(canvas).toHaveAttribute("data-z", "0");
  await page.getByLabel("Sprite vertical offset").fill("7");
  await page.getByLabel("Ground width", { exact: true }).fill("12");
  await page.getByLabel("Character feedback").fill("Check the feet with a 7px offset.");
  await page.getByLabel("Character", { exact: true }).selectOption("dog");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Character", { exact: true }).selectOption("tiger");
  await expect(page.getByLabel("Sprite vertical offset")).toHaveValue("7");
  await expect(page.getByLabel("Character feedback")).toHaveValue(
    "Check the feet with a 7px offset.",
  );
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Save settings / reopen" }).click();
  await expect
    .poll(async () => {
      const rows: ArtNote[] = await (await page.request.get("/tilefun/api/art-notes")).json();
      return rows.some(
        (n) =>
          n.characterAnnotation?.candidateId === "character:tiger" &&
          n.characterAnnotation.settings.drawOffsetY === 7 &&
          n.characterAnnotation.settings.width === 12,
      );
    })
    .toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/tilefun-character-lab-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("character touch controls release, drafts survive reload, and offline reviews retry", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}?character=cat`);
  const canvas = page.getByLabel("Character movement test");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const control = page.getByRole("button", { name: "Character Right", exact: true });
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: required(box).x + 10, y: required(box).y + 10 }],
  });
  await expect.poll(async () => Number(await canvas.getAttribute("data-x"))).toBeGreaterThan(2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(canvas).toHaveAttribute("data-moving", "false");
  await page.getByLabel("Physical height", { exact: true }).fill("19");
  await page.getByLabel("Character feedback").fill("Mobile height check");
  await page.reload();
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(page.getByLabel("Physical height", { exact: true })).toHaveValue("19");
  await expect(page.getByLabel("Character feedback")).toHaveValue("Mobile height check");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/tilefun-character-lab-phone.png", fullPage: true });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Approve character", exact: true }).click();
  await expect(page.getByText(/1 pending save.*kept in this browser/)).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const rows: ArtNote[] = await (await page.request.get("/tilefun/api/art-notes")).json();
        return rows.some(
          (n) =>
            n.characterAnnotation?.candidateId === "character:cat" &&
            n.characterAnnotation.verdict === "approved" &&
            n.characterAnnotation.settings.physicalHeight === 19,
        );
      },
      { timeout: 25000 },
    )
    .toBe(true);
});

test("character reports require reasons and pause after two reports", async ({ page }) => {
  await page.goto(`${url}?character=dog`);
  const canvas = page.getByLabel("Character movement test");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Needs changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Leave a reason");
  for (const id of ["dog", "bear"]) {
    await page.getByLabel("Character", { exact: true }).selectOption(id);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Character feedback").fill(`${id} alignment needs adjustment`);
    await page.getByRole("button", { name: "Needs changes", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Review paused after two Needs changes reports" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve character" })).toBeDisabled();
});
