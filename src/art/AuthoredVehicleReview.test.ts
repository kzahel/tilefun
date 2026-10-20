import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { AUTHORED_REVIEW_REVISIONS } from "../../tests-support/AuthoredVehicleReview.fixture.js";

it.each(AUTHORED_REVIEW_REVISIONS)(
  "retains the exact $asset $revision model and registered comparison",
  ({ asset, revision, name }) => {
    const base = `public/assets/models/vehicles`;
    expect(readFileSync(`${base}/${asset}-${revision}.glb`).subarray(0, 4).toString()).toBe("glTF");
    const html = readFileSync(`${base}/review/${asset}-${revision}/index.html`, "utf8");
    expect(html.toLowerCase()).toContain(`${name} ${revision}`.toLowerCase());
    const manifest = JSON.parse(readFileSync("public/data/workshop-manifest.json", "utf8"));
    const candidate = manifest.candidates.find(
      (c: { id: string }) => c.id === `projection:authored-${asset}-${revision}`,
    );
    expect(candidate).toBeDefined();
    // Historical revisions have their own retained comparison, independent of current models.
    expect(JSON.stringify(candidate)).toContain(
      `/assets/models/vehicles/review/${asset}-${revision}/`,
    );
  },
);
it("preserves the frozen 45-model grounded game-camera fit report and its comparison", () => {
  const base = "public/assets/models/vehicles/review/game-fit-v2";
  expect(existsSync(`${base}/index.html`)).toBe(true);
  const rows = JSON.parse(readFileSync(`${base}/report.json`, "utf8")) as {
    ground: { minZ: number }[];
    shadowPixels: number;
    views: { mesh: { h: number }; src: { h: number } }[];
  }[];
  expect(rows).toHaveLength(45);
  for (const row of rows) {
    expect(row.ground).toHaveLength(32);
    expect(row.shadowPixels).toBeGreaterThan(100);
    for (const view of row.views.slice(0, 2))
      expect(Math.abs(view.mesh.h - view.src.h)).toBeLessThanOrEqual(1);
    for (const sample of row.ground) expect(Math.abs(sample.minZ)).toBeLessThan(0.15);
  }
});
