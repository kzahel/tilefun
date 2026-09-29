import { expect, it } from "vitest";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { DEFAULT_PREVIEW, explorerUrl, parseExplorerLocation } from "./PreviewSettings.js";
import { DEFAULT_OVERLAYS } from "./ViewState.js";

it("round-trips generation and presentation independently including legacy seeds", () => {
  for (const descriptor of [
    createDescriptor("regional", 2026),
    createDescriptor("island", -12.5),
    createDescriptor("flat", 42),
  ]) {
    const view = { x: -300, y: 519, zoom: 32 };
    const preview = { ...DEFAULT_PREVIEW, mode: "tiles" as const, radius: 3 };
    const url = explorerUrl(
      "https://test.example/world-explorer.html",
      descriptor,
      view,
      DEFAULT_OVERLAYS,
      preview,
    );
    expect(parseExplorerLocation(url)).toEqual({
      generation: descriptor,
      view,
      overlays: DEFAULT_OVERLAYS,
      preview,
    });
  }
  expect(parseExplorerLocation("https://test.example/?seed=2026").generation).toEqual(
    createDescriptor("regional", 2026),
  );
  expect(() => parseExplorerLocation("https://test.example/?version=future")).toThrow();
  expect(() => parseExplorerLocation("https://test.example/?radius=10")).toThrow();
});
