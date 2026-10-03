import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });

for (const changed of [false, true]) {
  test(`development source drift permits review only when preview matches: changed=${changed}`, async ({
    page,
  }) => {
    await page.route("**/api/workshop/inbox", async (route) => {
      const response = await route.fetch();
      const inbox = await response.json();
      inbox.manifestCurrent = false;
      inbox.reviewAllowed = true;
      if (changed)
        inbox.candidates = inbox.candidates.map((c: { id: string; fingerprint: string }) =>
          c.id === "pattern:rail-v1-rails-grey" ? { ...c, fingerprint: "0".repeat(64) } : c,
        );
      await route.fulfill({ json: inbox });
    });
    await page.goto("/tilefun/workshop.html#/");
    await expect(page.getByText("Development is continuing.", { exact: false })).toBeVisible();
    await page.goto("/tilefun/workshop.html#/review/pattern%3Arail-v1-rails-grey?show=all");
    const vote = page.getByRole("button", { name: "Looks right ✓", exact: true });
    if (changed) {
      await expect(
        page.getByText("Railway preview changed. Regenerate the manifest before reviewing."),
      ).toBeVisible();
      await expect(vote).toBeDisabled();
    } else {
      await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
      await expect(vote).toBeEnabled();
      await expect(page.getByText("Manifest needs regeneration.", { exact: false })).toHaveCount(0);
    }
  });
}
