import { expect, test } from "@playwright/test";
import { SPRITE_MANIFEST } from "../src/assets/GameAssets.js";
import { ENTITY_PALETTE } from "../src/editor/EditorPalettes.js";

// Exercise the same compositor used by the actual picker, including phone sizing.
test.use({ channel: "chromium" });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`entity thumbnails fill their buttons without stretching at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/tilefun/?nogamepad");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator('[data-editor-tab="entities"]').click();
    const entries = ENTITY_PALETTE.map(({ type, label, previewRow }) => {
      const asset = SPRITE_MANIFEST.find((a) => a.key === type);
      if (!asset) throw Error(`Missing entity image: ${type}`);
      return { label, path: asset.path, width: asset.w, height: asset.h, row: previewRow ?? 0 };
    });
    const measurements = await page.evaluate(async (entries) => {
      function bounds(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Missing preview context");
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width,
          top = canvas.height,
          right = -1,
          bottom = -1;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        return { left, top, width: right - left + 1, height: bottom - top + 1 };
      }
      return Promise.all(
        entries.map(async (entry) => {
          const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
            (b) => b.title === `Place ${entry.label} (click map)`,
          );
          const preview = button?.querySelector("canvas");
          if (!button || !preview) throw Error(`Missing preview: ${entry.label}`);
          const image = new Image();
          image.src = `/tilefun/${entry.path}`;
          await image.decode();
          const frame = document.createElement("canvas");
          frame.width = entry.width;
          frame.height = entry.height;
          const ctx = frame.getContext("2d");
          if (!ctx) throw Error("Missing source context");
          ctx.drawImage(
            image,
            0,
            entry.row * entry.height,
            entry.width,
            entry.height,
            0,
            0,
            entry.width,
            entry.height,
          );
          const source = bounds(frame),
            visible = bounds(preview);
          const scale = Math.min(preview.width / source.width, preview.height / source.height);
          const rect = preview.getBoundingClientRect(),
            buttonRect = button.getBoundingClientRect();
          return {
            label: entry.label,
            visible,
            scale,
            expected: { width: source.width * scale, height: source.height * scale },
            canvas: { width: preview.width, height: preview.height },
            displayed: { width: rect.width, height: rect.height },
            inside:
              rect.left >= buttonRect.left + 2 &&
              rect.right <= buttonRect.right - 2 &&
              rect.top >= buttonRect.top + 2 &&
              rect.bottom <= buttonRect.bottom - 2,
            background: getComputedStyle(button).backgroundColor,
          };
        }),
      );
    }, entries);
    await page.getByTitle("Place Wild tiger (click map)", { exact: true }).scrollIntoViewIfNeeded();
    await page
      .getByTestId("editor-panel")
      .screenshot({ path: testInfo.outputPath("entities.png") });
    for (const m of measurements) {
      expect(m.visible.width, m.label).toBeGreaterThan(0);
      expect(
        Math.max(m.visible.width / m.canvas.width, m.visible.height / m.canvas.height),
        `${m.label} fills the available space`,
      ).toBeGreaterThanOrEqual(0.95);
      // Downsampling can drop single-pixel extremities (e.g. the manta's thin tail).
      // Enlarged thumbnails must preserve the complete silhouette and its proportions.
      if (m.scale >= 1) {
        expect(
          Math.abs(m.visible.width - m.expected.width),
          `${m.label} width`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(m.visible.height - m.expected.height),
          `${m.label} height`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(m.visible.left + m.visible.width / 2 - m.canvas.width / 2),
          `${m.label} horizontal center`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(m.visible.top + m.visible.height / 2 - m.canvas.height / 2),
          `${m.label} vertical center`,
        ).toBeLessThanOrEqual(1);
      }
      expect(m.displayed, `${m.label} CSS aspect ratio`).toEqual(m.canvas);
      expect(m.inside, `${m.label} fits inside the border`).toBe(true);
      expect(m.background, `${m.label} contrast background`).toBe("rgb(75, 85, 99)");
    }
    await page.getByTitle("Place Wild tiger (click map)", { exact: true }).click();
    await expect(page.getByTestId("editor-selection")).toHaveText("Wild tiger");
  });
}
