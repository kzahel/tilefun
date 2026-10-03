import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { loadWorkshopManifest, workshopInputDigest } from "../src/server/workshopManifest.js";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

const digest = await workshopInputDigest();
if (process.argv.includes("--check")) {
  const manifest = await loadWorkshopManifest();
  if (manifest.inputDigest !== digest)
    throw new Error(
      "Workshop candidate inputs changed. Run npm run workshop:manifest to render current review identities.",
    );
  console.log(`Workshop manifest current: ${manifest.candidates.length} candidates.`);
} else {
  // No project server plugins: this deterministic build cannot write human feedback.
  const server = await createServer({
    configFile: false,
    base: "/tilefun/",
    server: { port: 0, host: "127.0.0.1" },
    logLevel: "error",
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Missing manifest build server");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/tilefun/workshop-manifest.html`);
    await page
      .waitForFunction(() => "workshopManifestReady" in window, undefined, { timeout: 180000 })
      .catch((error) => {
        throw new Error(`${String(error)}\n${errors.join("\n")}`);
      });
    const manifest = await page.evaluate(() => Reflect.get(window, "workshopManifest"));
    if (errors.length) throw new Error(errors.join("\n"));
    // A current source digest cannot detect CPU/GPU raster differences. Verify
    // fresh character and vehicle canvases in normal Chromium before publishing
    // identities produced by headless-shell. Never make the user discover this.
    const normalBrowser = await chromium.launch({ channel: "chromium", headless: true });
    try {
      const normalPage = await normalBrowser.newPage({ deviceScaleFactor: 2 });
      const normalErrors: string[] = [];
      normalPage.on("pageerror", (error) => normalErrors.push(error.message));
      await normalPage.goto(`http://127.0.0.1:${address.port}/tilefun/workshop-manifest.html`);
      await normalPage.waitForFunction(() => "workshopManifestReady" in window, undefined, {
        timeout: 180000,
      });
      if (normalErrors.length) throw new Error(normalErrors.join("\n"));
      const normal = (await normalPage.evaluate(() =>
        Reflect.get(window, "workshopManifest"),
      )) as WorkshopManifest;
      const checks = (manifest as WorkshopManifest).candidates.filter(
        (c) =>
          c.kind === "character" ||
          c.kind === "vehicle" ||
          c.kind === "railway" ||
          c.batchId === "rooms-16",
      );
      const mismatches = checks.filter(
        (c) => normal.candidates.find((n) => n.id === c.id)?.fingerprint !== c.fingerprint,
      );
      if (mismatches.length)
        throw new Error(
          `Review raster mismatch in normal Chromium: ${mismatches.map((c) => c.id).join(", ")}. Fix canvas determinism before rebuilding.`,
        );
      console.log(
        `Verified ${checks.length} character/vehicle/railway/building-layout identities in normal Chromium at retina scale.`,
      );
    } finally {
      await normalBrowser.close();
    }
    if ((await workshopInputDigest()) !== digest)
      throw new Error(
        "Review inputs changed during manifest generation. Rerun after edits finish.",
      );
    await writeFile(
      "public/data/workshop-manifest.json",
      `${JSON.stringify({ ...manifest, inputDigest: digest }, null, 2)}\n`,
    );
    console.log(
      `Rendered ${manifest.candidates.length} Workshop candidates (${manifest.candidates.filter((c: { excluded?: string }) => c.excluded).length} compiler exclusions).`,
    );
  } finally {
    await browser?.close();
    await server.close();
  }
}
