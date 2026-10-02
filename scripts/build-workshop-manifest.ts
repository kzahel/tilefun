import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { loadWorkshopManifest, workshopInputDigest } from "../src/server/workshopManifest.js";

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
