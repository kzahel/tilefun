// Run against a Vite dev server; uses bundled Chromium, reaped in finally.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.TILEFUN_DEV_URL ?? "http://localhost:5174/tilefun"}/package.json`);
  const result = await page.evaluate(async () => {
    const root = "/tilefun/src/";
    const { loadModernInteriorsAtlasIndex } = await import(
      `${root}assets/ModernInteriorsAtlasIndex.ts`
    );
    const { interiorPlan, INTERIOR_FLOOR } = await import(`${root}interiors/GameplayInterior.ts`);
    const { CachedInteriorRenderer } = await import(`${root}interiors/CachedInteriorRenderer.ts`);
    const { drawFurnishedInterior } = await import(`${root}interiors/FurnishedInterior.ts`);
    await loadModernInteriorsAtlasIndex();
    const image = new Image();
    image.src = "assets/tilesets/modern-interiors-atlas.png";
    await image.decode();
    const shell = interiorPlan({
      version: "interior-v1",
      floor: 0,
      buildingType: "prop-country-house",
    });
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    ctx.scale(3, 3);
    let calls = 0;
    const drawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (...a) => {
      calls++;
      drawImage(...a);
    };
    const renderer = new CachedInteriorRenderer(image, shell.map, shell.plan, INTERIOR_FLOOR);
    const validate = (shell) => {
      const renderer = new CachedInteriorRenderer(image, shell.map, shell.plan, INTERIOR_FLOOR);
      const variants = [
        shell.furniture,
        shell.furniture.slice(1),
        shell.furniture.map((p) =>
          ["chair", "stool", "dresser"].includes(p.id) ? { ...p, x: p.x + 16 } : p,
        ),
      ];
      for (const scale of [1, 2, 3])
        for (const placements of variants)
          for (const depth of [50, 85, 120]) {
            const render = (cached) => {
              const canvas = document.createElement("canvas");
              canvas.width = 640;
              canvas.height = 640;
              const ctx = canvas.getContext("2d");
              ctx.imageSmoothingEnabled = false;
              ctx.scale(scale, scale);
              const actors = [
                {
                  id: "visitor",
                  depth,
                  draw(ctx) {
                    ctx.fillStyle = "#ee4499";
                    ctx.fillRect(43, depth - 24, 10, 24);
                  },
                },
              ];
              if (cached) renderer.draw(ctx, placements, actors);
              else
                drawFurnishedInterior(
                  ctx,
                  image,
                  shell.map,
                  shell.plan,
                  placements,
                  actors,
                  INTERIOR_FLOOR,
                );
              return ctx.getImageData(0, 0, 640, 640).data;
            };
            const old = render(false),
              cached = render(true);
            if (old.some((v, i) => v !== cached[i]))
              throw Error(`Cached pixels changed: scale=${scale}, depth=${depth}`);
          }
    };
    for (const buildingType of [
      "prop-country-house",
      "prop-city-architecture-v1-office-3",
      "prop-city-architecture-v1-condo-wide-3",
    ])
      validate(interiorPlan({ version: "interior-v1", floor: 0, buildingType }));
    const measure = (cached) => {
      const samples = [];
      for (let i = 0; i < 150; i++) {
        calls = 0;
        const start = performance.now();
        if (cached) renderer.draw(ctx, shell.furniture);
        else
          drawFurnishedInterior(
            ctx,
            image,
            shell.map,
            shell.plan,
            shell.furniture,
            [],
            INTERIOR_FLOOR,
          );
        if (i >= 30) samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return { drawsPerFrame: calls, medianMs: samples[60], p95Ms: samples[114], frames: 120 };
    };
    return { uncached: measure(false), cached: measure(true), pixelParityCases: 81 };
  });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
