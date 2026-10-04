import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG } from "./FurnitureCatalog.js";
import { FurnitureMotion, MOTION_SCENES } from "./FurnitureMotion.js";
import { motionSceneSignature, motionVerdict, nextUncheckedScene } from "./MotionReview.js";

describe("movement review catalog", () => {
  it("keeps native-loop reviews historical when adopting shared engine presentation", () => {
    const model = new FurnitureMotion([{ id: "bunk", asset: "bunk-bed", x: 80, y: 88 }]);
    const signature = motionSceneSignature(model.furniture, model.bodies, model.gravityScale);
    const legacy = JSON.parse(signature);
    delete legacy.presentationVersion;
    const records = [
      {
        caseId: "furniture-motion-bunk",
        verdict: "good" as const,
        id: "test-report",
        fingerprint: "0".repeat(64),
        note: "",
        sketch: "",
        name: "Bunk",
        createdAt: "2026-10-03",
        playtest: {
          playerX: 80,
          playerY: 120,
          facing: 0,
          selected: "bunk",
          mode: "walk" as const,
          sceneSignature: JSON.stringify(legacy),
        },
      },
    ];
    expect(motionVerdict(records, "bunk", signature)).toBe("unchecked");
    for (const row of records) row.playtest.sceneSignature = signature;
    expect(motionVerdict(records, "bunk", signature)).toBe("good");
  });
  it("reopens older motion approvals when switching to the authoritative Worker runtime", () => {
    const approved = JSON.parse(
      readFileSync("tests/fixtures/furniture-motion-approved.json", "utf8"),
    ) as { id: string; sceneSignature: string }[];
    expect(approved).toHaveLength(9);
    for (const row of approved) {
      const preset = MOTION_SCENES.find((s) => s.id === row.id);
      if (!preset) throw new Error("Missing approved scene");
      const model = new FurnitureMotion(preset.furniture);
      expect(motionSceneSignature(model.furniture, model.bodies, model.gravityScale)).not.toBe(
        row.sceneSignature,
      );
    }
  });
  it("reopens the bed report and the affected worktable approval", () => {
    const reopened = JSON.parse(
      readFileSync("tests/fixtures/furniture-motion-reopened.json", "utf8"),
    ) as { id: string; sceneSignature: string }[];
    expect(reopened.map((r) => r.id).sort()).toEqual(["bedside", "worktable"]);
    for (const row of reopened) {
      const preset = MOTION_SCENES.find((s) => s.id === row.id);
      if (!preset) throw new Error("Missing scene");
      const m = new FurnitureMotion(preset.furniture);
      expect(motionSceneSignature(m.furniture, m.bodies, m.gravityScale)).not.toBe(
        row.sceneSignature,
      );
    }
  });
  it("covers the whole curated catalog with valid physics and visible sprites", () => {
    const used = new Set<string>();
    for (const preset of MOTION_SCENES) {
      const model = new FurnitureMotion(preset.furniture);
      for (const o of model.objects) {
        used.add(o.definition.id);
        expect(o.origin[0]).toBeGreaterThanOrEqual(0);
        expect(o.origin[1]).toBeGreaterThanOrEqual(0);
        expect(o.origin[0] + o.definition.size[0]).toBeLessThanOrEqual(160);
        expect(o.origin[1] + o.definition.size[1]).toBeLessThanOrEqual(model.map.pixelHeight);
        if (o.definition.blocking) expect(model.bodies[o.placement.id]?.height).toBeGreaterThan(0);
      }
    }
    expect([...used].sort()).toEqual(FURNITURE_CATALOG.map((d) => d.id).sort());
  });
  it("skips checked scenes, wraps, and stops when nothing else is unchecked", () => {
    const ids = ["bed", "lamp", "tree", "rug"];
    expect(nextUncheckedScene(ids, "bed", (id) => id === "rug")).toBe("rug");
    expect(nextUncheckedScene(ids, "rug", (id) => id === "lamp")).toBe("lamp");
    expect(nextUncheckedScene(ids, "rug", (id) => id === "rug")).toBeUndefined();
    expect(nextUncheckedScene(ids, "bed", () => false)).toBeUndefined();
  });
});
