import { expect, type Page, test } from "@playwright/test";
import { createServer } from "vite";

test("the built game exposes a valid standalone launcher under its deployment path", async ({
  page,
}) => {
  await page.goto("/tilefun/?perf");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expectLauncher(page);
});

test("Vite dev serving applies the deployment prefix once to launcher assets", async ({ page }) => {
  // The live site uses dev serving, whose HTML rewriting differs from vite build.
  // No project plugins or game startup: this server only exercises public assets.
  const server = await createServer({
    configFile: false,
    base: "/tilefun/",
    server: { host: "127.0.0.1", port: 0 },
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing dev-server address");
    await page.route("**/src/main.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await page.goto(`http://127.0.0.1:${address.port}/tilefun/?perf`);
    await expectLauncher(page);
  } finally {
    await server.close();
  }
});

async function expectLauncher(page: Page) {
  const session = await page.context().newCDPSession(page);
  const manifest = await session.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  expect(new URL(manifest.url).pathname).toBe("/tilefun/manifest.webmanifest");
  expect(manifest.data).toBeTruthy();
  const data = JSON.parse(manifest.data ?? "{}");
  expect(data.name).toBe("Tilefun");
  expect(data.display).toBe("standalone");
  for (const key of ["id", "start_url", "scope"]) {
    const resolved = new URL(data[key], manifest.url);
    expect(resolved.pathname).toBe("/tilefun/");
    expect(resolved.search).toBe("");
  }
  const response = await page.request.get(manifest.url);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const icons = data.icons.map((icon: { src: string; sizes: string }) => ({
    url: new URL(icon.src, manifest.url).href,
    size: Number(icon.sizes.split("x")[0]),
  }));
  expect(icons.map((icon: { size: number }) => icon.size)).toEqual([192, 512]);
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIcon).toBeTruthy();
  icons.push({ url: new URL(appleIcon ?? "", page.url()).href, size: 180 });
  for (const icon of icons) {
    expect(new URL(icon.url).pathname).toMatch(/^\/tilefun\/icons\//);
    const dimensions = await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, icon.url);
    expect(dimensions).toEqual([icon.size, icon.size]);
  }
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
  expect((await session.send("Page.getInstallabilityErrors")).installabilityErrors).toEqual([]);
}
