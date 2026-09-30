import { expect, it } from "vitest";
import { createDescriptor, type GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { DEFAULT_PREVIEW } from "./PreviewSettings.js";
import { type ReviewRecord, ReviewStore, reviewKey } from "./ReviewStore.js";
import { DEFAULT_OVERLAYS, DEFAULT_VIEW } from "./ViewState.js";

const world = regionalWorld(2026);
const generation: GenerationDescriptor = {
  type: "regional",
  seed: 2026,
  version: "regional-v1",
  preset: "temperate-v1",
};
const record: ReviewRecord = {
  world,
  caseId: "case",
  view: DEFAULT_VIEW,
  bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  detail: "overview",
  overlays: DEFAULT_OVERLAYS,
  featureId: null,
  verdict: "approved",
  note: "legacy",
  location: "https://example.test/",
  createdAt: "2026-09-30T00:00:00Z",
};

it("retains legacy review keys and separates changed revisions and exact previews", () => {
  const identity = { generation, world, preview: DEFAULT_PREVIEW, view: DEFAULT_VIEW };
  const key = reviewKey("case", identity);
  expect(key).toBe("regional-v1:temperate-v1:2026:case");
  expect(
    reviewKey("case", { ...identity, generation: createDescriptor("regional", 2026) }),
  ).not.toBe(key);
  expect(reviewKey("case", { ...identity, view: { ...DEFAULT_VIEW, zoom: 16 } })).not.toBe(key);
});

it("loads and exports old verdicts only for their pinned world identity", () => {
  const store = new ReviewStore(() => ({
    getItem: () => JSON.stringify({ legacy: record }),
    setItem: () => {},
  }));
  expect(store.load()).toBe(true);
  expect(store.get("legacy")).toEqual(record);
  expect(store.forWorld(generation, world)).toEqual([record]);
  expect(store.forWorld(createDescriptor("classic", 2026), world)).toEqual([]);
  expect(store.forWorld(generation, regionalWorld(99))).toEqual([]);
});

it("keeps new verdicts exportable when browser storage throws", () => {
  const store = new ReviewStore(() => {
    throw new Error("Storage unavailable");
  });
  expect(store.load()).toBe(false);
  expect(store.record("case", record)).toBe(false);
  expect(store.get("case")).toEqual(record);
  expect(store.forWorld(generation, world)).toEqual([record]);
});
