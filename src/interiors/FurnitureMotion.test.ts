import { describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { furnishedSceneOrder } from "./FurnishedInterior.js";
import { FURNITURE_CATALOG } from "./FurnitureCatalog.js";
import { FurnitureMotion, furnitureCollider, MOTION_SCENES } from "./FurnitureMotion.js";
import { parseReviewFeedback } from "./review/ReviewFeedback.js";

const scene = (id: string) => {
  const s = MOTION_SCENES.find((s) => s.id === id);
  if (!s) throw new Error("Missing scene");
  return new FurnitureMotion(s.furniture);
};
describe("furniture in shared game physics", () => {
  it("converts ground footprints to game prop colliders without including sprite padding", () => {
    for (const d of FURNITURE_CATALOG) {
      const c = furnitureCollider(d);
      if (!d.blocking) {
        expect(c).toBeNull();
        continue;
      }
      if (!c) throw new Error("Missing collider");
      const r = d.footprint;
      expect(getEntityAABB({ wx: 80, wy: 90 }, c)).toEqual({
        left: 80 + r.x,
        top: 90 + r.y,
        right: 80 + r.x + r.width,
        bottom: 90 + r.y + r.height,
      });
    }
  });
  it("stops at the actual footprint from front and back and slides along its side", () => {
    const m = scene("wardrobe");
    m.player.position = { wx: 80, wy: 112 };
    for (let i = 0; i < 100; i++) m.step(0, -1);
    expect(m.player.position.wy).toBeGreaterThanOrEqual(94);
    expect(m.player.position.wy).toBeLessThan(95);
    const first = m.player.position.wy;
    for (let i = 0; i < 20; i++) m.step(1, -1);
    expect(m.player.position.wx).toBeGreaterThan(85);
    expect(m.player.position.wy).toBeGreaterThanOrEqual(94);
    expect(m.player.position.wy).toBeLessThanOrEqual(first);
    m.player.position = { wx: 80, wy: 50 };
    for (let i = 0; i < 100; i++) m.step(0, 1);
    expect(m.player.position.wy).toBeLessThanOrEqual(76);
    expect(m.player.position.wy).toBeGreaterThan(75);
  });
  it("permits walking on rendered floor within a wall sketch cell", () => {
    const m = scene("bunk");
    expect(m.canStand(20, 80)).toBe(true);
    expect(m.canStand(12, 80)).toBe(false);
    expect(m.canStand(80, 37)).toBe(false);
    expect(m.canStand(80, 38)).toBe(true);
    const wardrobe = scene("wardrobe");
    wardrobe.moveObject("wardrobe", 22, 88);
    expect(wardrobe.collisionBoxes()[0]?.bounds.left).toBe(8);
    expect(() => wardrobe.moveObject("wardrobe", 21, 88)).toThrow(/floor/);
  });
  it("moves furniture by one pixel, carries supported items, and rejects overlap with the player", () => {
    const m = scene("worktable"),
      plant = m.objects.find((o) => o.placement.id === "plant");
    const x = plant?.x;
    m.moveObject("table", 81, 72);
    expect(m.objects.find((o) => o.placement.id === "plant")?.x).toBe((x ?? 0) + 1);
    const bunk = scene("bunk");
    expect(() => bunk.moveObject("bunk", 80, 116)).toThrow(/player/);
    expect(bunk.furniture[0]?.y).toBe(88);
  });
  it("finds clear routes around each preset, using the full player collider", () => {
    for (const s of MOTION_SCENES) {
      const m = new FurnitureMotion(s.furniture);
      const id = m.furniture[0]?.id;
      if (!id) throw new Error("Missing object");
      for (const target of m.circleTargets(id)) {
        const path = m.pathTo(...target);
        expect(path, `${s.id} ${target}`).not.toBeNull();
        for (const p of path ?? []) expect(m.canStand(...p)).toBe(true);
      }
    }
  });
  it("keeps a table and its plant together when the player changes depth", () => {
    const m = scene("worktable");
    const ids = (y: number) =>
      furnishedSceneOrder(m.objects, [{ id: "player", depth: y, draw: () => {} }]).map((o) =>
        "placement" in o ? o.placement.id : o.id,
      );
    expect(ids(60)).toEqual(["player", "table", "plant", "stool"]);
    expect(ids(80)).toEqual(["table", "plant", "player", "stool"]);
    expect(ids(110)).toEqual(["table", "plant", "stool", "player"]);
  });
  it("restores a safe player spawn after saved furniture covers the default start", () => {
    const m = new FurnitureMotion([{ id: "bunk", asset: "bunk-bed", x: 80, y: 116 }]);
    expect(m.canStand(m.player.position.wx, m.player.position.wy)).toBe(true);
    expect(m.player.position).not.toEqual({ wx: 80, wy: 120 });
  });
  it("saves movement context without confusing it with a static approval", () => {
    const m = scene("bunk");
    const report = {
      id: "test",
      caseId: "furniture-motion-bunk",
      fingerprint: "a".repeat(64),
      name: "Test",
      sketch: "#####\n#LLL#\n#####",
      verdict: "wrong",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
      furniture: m.furniture,
      furnitureCatalogVersion: 1,
      playtest: { playerX: 80, playerY: 94.2, facing: 1, selected: "bunk", mode: "walk" },
    };
    expect(parseReviewFeedback(report).playtest).toEqual(report.playtest);
    expect(() =>
      parseReviewFeedback({ ...report, playtest: { ...report.playtest, playerX: NaN } }),
    ).toThrow(/playtest/);
  });
});
