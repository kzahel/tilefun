import { expect, it } from "vitest";
import { regionalWorld, seedFromText } from "../generation/regional/WorldDescriptor.js";
import {
  DEFAULT_OVERLAYS,
  locationUrl,
  parseLocation,
  screenToWorld,
  zoomAt,
} from "./ViewState.js";

it("keeps a negative-coordinate pointer anchor fixed through zoom and round-trips shared locations", () => {
  const view = { x: -1800, y: -400, zoom: 0.42 };
  const point = { x: 720, y: 180 };
  const anchor = screenToWorld(view, 1000, 700, point);
  const zoomed = zoomAt(view, 1000, 700, point, 2);
  expect(screenToWorld(zoomed, 1000, 700, point)).toEqual(anchor);
  const world = regionalWorld(seedFromText("woodland"));
  const overlays = { ...DEFAULT_OVERLAYS, roads: false, boundaries: true };
  const url = locationUrl(
    "https://example.test/tilefun/world-explorer.html",
    world,
    view,
    overlays,
  );
  expect(parseLocation(url)).toEqual({ world, view, overlays });
  expect(seedFromText("2026")).toBe(2026);
  expect(() => parseLocation("https://example.test/?version=future")).toThrow(/version/);
  expect(() => parseLocation("https://example.test/?x=NaN")).toThrow(/view/);
  expect(() => seedFromText("4294967296")).toThrow(/Seed/);
});
