import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// Deliberate ownership boundaries, not a blanket ban on platform/UI composition.
const neutral = [
  "assets/SpriteCatalog.ts",
  "rendering/RenderFrame.ts",
  "rendering/MeshPresentation.ts",
  "rendering/EntityMeshPose.ts",
  "rendering/CarMeshDefinition.ts",
  "rendering/Projection.ts",
  "rendering/PresentationSettings.ts",
  "rendering/PlayerPresentation.ts",
  "rendering/OutdoorPresentation.ts",
  "rendering/TerrainPresentation.ts",
  "rendering/TerrainFrame.ts",
  "rendering/SceneItem.ts",
  "rendering/SceneFrame.ts",
  "rendering/OverlayFrame.ts",
  "rendering/ElevationDescriptorCache.ts",
  "rendering/collectScene.ts",
  "rendering/GrassBladeRenderer.ts",
  "rendering/GrassFrameBuffer.ts",
  "rendering/propDepth.ts",
  "interiors/InteriorPresentation.ts",
  "interiors/FurnitureLayout.ts",
  "interiors/LayeredInteriorMap.ts",
  "editor/collectEditorOverlay.ts",
  "scenes/renderWorld.ts",
  "scenes/renderInterior.ts",
  "world/Chunk.ts",
];
const forbidden =
  /^(?:Canvas.*|OffscreenCanvas|HTMLCanvasElement|ImageBitmap|HTMLImageElement|GPU\w*|WebGL\w*|Spritesheet|TileRenderer)$/;
function inspect(source: string) {
  // Intentionally inspect type-only imports as well as executable references.
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const violations = [...code.matchAll(/\b[A-Za-z_$][\w$]*\b/g)]
    .map((match) => match[0])
    .filter((name) => forbidden.test(name));
  for (const match of code.matchAll(/(?:from\s*|import\s*\()(["'])([^"']+)\1/g)) {
    if (
      /(?:Canvas|Spritesheet|TileRenderer|FurnishedInterior|ThreeDebugRenderer|RenderHost)/.test(
        match[2] ?? "",
      )
    )
      violations.push(match[2] ?? "");
  }
  for (const match of code.matchAll(/\bgc\.(?:ctx|canvas|tileRenderer|sheets)\b/g))
    violations.push(match[0]);
  if (/\bdocument\.(?:createElement|getElementById|querySelector)/.test(code))
    violations.push("document graphics access");
  return violations;
}

it("keeps contracts, frame policy and world data independent of concrete graphics resources", () => {
  for (const path of neutral)
    expect(inspect(readFileSync(resolve("src", path), "utf8")), path).toEqual([]);
});
it("detects forbidden types/imports/access even when they are type-only", () => {
  expect(
    inspect(
      'import type { Spritesheet } from "./Spritesheet.js"; let image: OffscreenCanvas; gc.ctx.fillRect();',
    ),
  ).toContain("OffscreenCanvas");
  expect(inspect("gc.tileRenderer.clear()")).toContain("gc.tileRenderer");
});
it("selects the backend in platform composition, not gameplay orchestration", () => {
  const client = readFileSync(resolve("src/client/GameClient.ts"), "utf8");
  expect(client).toContain("renderHostFactory");
  expect(client).not.toMatch(/TileRenderer|CanvasRenderBackend/);
  for (const path of ["scenes/PlayScene.ts", "scenes/EditScene.ts", "core/GameScene.ts"]) {
    const source = readFileSync(resolve("src", path), "utf8");
    expect(source, path).not.toMatch(
      /import[^;]*(?:TileRenderer|CanvasRenderBackend|Canvas2DRenderer|Spritesheet)/,
    );
  }
});
