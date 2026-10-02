import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { ArtNote } from "../art/ArtNotes.js";
import type { OutdoorCatalog } from "../assets/outdoor/OutdoorCatalog.js";
import { assetNotes, catalogAssets } from "./OutdoorQueries.js";

it("agent status replies cannot resurrect older human metadata", () => {
  const catalog = JSON.parse(
      readFileSync("public/data/outdoor-catalog.json", "utf8"),
    ) as OutdoorCatalog,
    asset = catalog.assets[0]!;
  const note = (name: string, decision: string, updated: string) =>
    ({
      threadId: name,
      createdAt: updated,
      fingerprint: catalog.sourceFingerprint,
      rect: asset.rect,
      assetAnnotation: {
        assetId: asset.id,
        createdAt: decision,
        metadata: { ...asset.metadata, name },
        verdict: "note",
      },
    }) as ArtNote;
  const older = note("Old label", "2026-10-02T10:00:00Z", "2026-10-02T12:00:00Z"),
    newer = note("Corrected label", "2026-10-02T11:00:00Z", "2026-10-02T11:00:00Z");
  expect(catalogAssets(catalog, [newer, older]).find((a) => a.id === asset.id)?.metadata.name).toBe(
    "Corrected label",
  );
  expect(
    assetNotes([newer, older], asset, catalog.sourceFingerprint).at(-1)?.assetAnnotation?.metadata
      .name,
  ).toBe("Corrected label");
});

it("changed catalog definitions stay visible instead of being overwritten by an old report", () => {
  const catalog = JSON.parse(
      readFileSync("public/data/outdoor-catalog.json", "utf8"),
    ) as OutdoorCatalog,
    asset = catalog.assets[0]!;
  const original = { ...asset.metadata, name: "Original label" },
    updated = { ...asset.metadata, name: "Fixed label" };
  const note = {
    threadId: "old-report",
    createdAt: "2026-10-02T10:00:00Z",
    fingerprint: catalog.sourceFingerprint,
    rect: asset.rect,
    assetAnnotation: {
      assetId: asset.id,
      createdAt: "2026-10-02T10:00:00Z",
      baseMetadata: original,
      metadata: original,
      verdict: "changes",
    },
  } as ArtNote;
  const changed = { ...catalog, assets: [{ ...asset, metadata: updated }] };
  expect(catalogAssets(changed, [note])[0]?.metadata.name).toBe("Fixed label");
});
