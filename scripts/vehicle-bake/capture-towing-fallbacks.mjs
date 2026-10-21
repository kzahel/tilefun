import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const output =
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ??
  "data/vehicle-bake/towing-fallbacks";
try {
  await readFile(resolve(output, "recipe.json"));
  throw Error("Retained output already exists");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: "node_modules/.vite-towing-art",
  logLevel: "error",
  optimizeDeps: { entries: ["scripts/vehicle-bake/TowingFallbackCapture.ts"] },
  plugins: [
    {
      name: "blank-capture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] === "/tilefun/tow-capture") {
            res.setHeader("Content-Type", "text/html");
            res.end("<!doctype html><title>Tow asset capture</title>");
          } else next();
        });
      },
    },
  ],
  server: { port: 0, host: "127.0.0.1", watch: null },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/tilefun/tow-capture`);
  const result = await page.evaluate(async () =>
    (
      await import("/tilefun/scripts/vehicle-bake/TowingFallbackCapture.ts")
    ).captureTowingFallbacks(),
  );
  for (const key of ["cars", "truck"])
    await writeFile(
      resolve(output, `${key}.png`),
      Buffer.from(result[key].split(",")[1], "base64"),
    );
  await writeFile(resolve(output, "frames.json"), `${JSON.stringify(result.frames, null, 2)}\n`);
  const files = [
    "scripts/vehicle-bake/TowingFallbackCapture.ts",
    "scripts/vehicle-bake/capture-towing-fallbacks.mjs",
    "src/traffic/towing-profiles.json",
    "src/traffic/Towing.ts",
    "src/traffic/vehicle-paints-v1.json",
    "src/rendering/AuthoredVehicleMeshes.ts",
    "src/rendering/CarMeshAsset.ts",
    "src/rendering/CarPixelOutline.ts",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/vehicle-mesh-fits.json",
    "public/assets/models/vehicles/tow-truck-v2.glb",
  ];
  const profiles = JSON.parse(await readFile("src/traffic/towing-profiles.json", "utf8"));
  files.push(...Object.values(profiles).map((p) => p.path));
  const paints = JSON.parse(await readFile("src/traffic/vehicle-paints-v1.json", "utf8"));
  for (const key of Object.keys(profiles))
    for (const paint of paints.families[key]?.schemes ?? []) files.push(`public/${paint.atlas}`);
  files.push("package.json", "package-lock.json");
  // Freeze the mutable shared loader/pose dependencies too. Historical capture
  // recipes must remain replayable after unrelated engine edits.
  const discovered = new Set(files);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!/\.(?:ts|tsx|mjs)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /^import(?![ \t]+type\b)[ \t]+[\s\S]*?\bfrom\s+["'](\.[^"']+)["']/gm,
    )) {
      let path = resolve(dirname(file), match[1].replace(/\?raw$/, ""));
      if (!path.startsWith(resolve(".") + sep)) throw Error("Capture input escaped repository");
      if (path.endsWith(".js")) {
        try {
          await access(path);
        } catch {
          path = `${path.slice(0, -3)}.ts`;
        }
      }
      const local = relative(resolve("."), path).split(sep).join("/");
      if (!discovered.has(local)) {
        discovered.add(local);
        files.push(local);
      }
    }
  }
  const sha = async (f) =>
    createHash("sha256")
      .update(await readFile(f))
      .digest("hex");
  const inputs = Object.fromEntries(
    await Promise.all([...new Set(files)].map(async (f) => [f, await sha(f)])),
  );
  const snapshots = {};
  for (const file of files.filter((f) => !f.startsWith("public/"))) {
    const snapshot = `inputs/${file}`;
    await mkdir(dirname(resolve(output, snapshot)), { recursive: true });
    await copyFile(file, resolve(output, snapshot));
    snapshots[file] = snapshot;
  }
  const outputs = Object.fromEntries(
    await Promise.all(
      ["cars.png", "truck.png", "frames.json"].map(async (f) => [f, await sha(resolve(output, f))]),
    ),
  );
  await writeFile(
    resolve(output, "recipe.json"),
    `${JSON.stringify(
      {
        revision: "v2",
        method:
          "Actual shared GLB loader, fitted game projection and inward outline at native pixels; four cardinal towing poses, original and every eligible paint",
        inputs,
        snapshots,
        outputs,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Captured ${result.frames.keys.length} passenger paints and two truck equipment poses to ${output}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
