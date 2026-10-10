import { afterEach, describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { furnitureRecipe } from "../scenarios/FurnitureRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { FURNITURE_CATALOG } from "./FurnitureCatalog.js";
import { furnishedSceneOrder } from "./FurnitureLayout.js";
import { FurnitureMotion, furnitureCollider, MOTION_SCENES } from "./FurnitureMotion.js";
import { FURNITURE_BODIES } from "./FurniturePhysics.js";
import { parseReviewFeedback } from "./review/ReviewFeedback.js";

const sessions = new Map<FurnitureMotion, ScenarioSession>();
afterEach(async () => {
  for (const session of sessions.values()) await session.close();
  sessions.clear();
});
async function step(m: FurnitureMotion, dx: number, dy: number, dt = 1 / 120, jump = false) {
  let session = sessions.get(m);
  if (!session) {
    session = await ScenarioSession.create(furnitureRecipe(m));
    sessions.set(m, session);
  }
  const player = session.player.player;
  Object.assign(player, structuredClone(m.player), { id: player.id, type: "player" });
  await session.step({ dx, dy, jump, sprinting: false }, dt);
  Object.assign(m.player, JSON.parse(JSON.stringify(player)));
  if (player.jumpVZ === undefined) delete m.player.jumpVZ;
}
const scene = (id: string) => {
  const s = MOTION_SCENES.find((s) => s.id === id);
  if (!s) throw new Error("Missing scene");
  return new FurnitureMotion(s.furniture);
};
describe("furniture in shared game physics", async () => {
  it("converts ground footprints to game prop colliders without including sprite padding", async () => {
    for (const d of FURNITURE_CATALOG.filter((d) => !d.blocking || FURNITURE_BODIES[d.id])) {
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
  it("stops at the actual footprint from front and back and slides along its side", async () => {
    const m = scene("wardrobe");
    m.player.position = { wx: 80, wy: 112 };
    for (let i = 0; i < 100; i++) await step(m, 0, -1);
    expect(m.player.position.wy).toBeGreaterThanOrEqual(94);
    expect(m.player.position.wy).toBeLessThan(95);
    const first = m.player.position.wy;
    for (let i = 0; i < 20; i++) await step(m, 1, -1);
    expect(m.player.position.wx).toBeGreaterThan(85);
    expect(m.player.position.wy).toBeGreaterThanOrEqual(94);
    expect(m.player.position.wy).toBeLessThanOrEqual(first);
    m.player.position = { wx: 80, wy: 50 };
    for (let i = 0; i < 100; i++) await step(m, 0, 1);
    expect(m.player.position.wy).toBeLessThanOrEqual(76);
    expect(m.player.position.wy).toBeGreaterThan(75);
  });
  it("permits walking on rendered floor within a wall sketch cell", async () => {
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
  it("moves furniture by one pixel, carries supported items, and rejects overlap with the player", async () => {
    const m = scene("worktable"),
      plant = m.objects.find((o) => o.placement.id === "plant");
    const x = plant?.x;
    m.moveObject("table", 81, 72);
    expect(m.objects.find((o) => o.placement.id === "plant")?.x).toBe((x ?? 0) + 1);
    const bunk = scene("bunk");
    expect(() => bunk.moveObject("bunk", 80, 116)).toThrow(/player/);
    expect(bunk.furniture[0]?.y).toBe(88);
  });
  it("finds clear routes around each preset, using the full player collider", async () => {
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
  it("keeps a table and its plant together when the player changes depth", async () => {
    const m = scene("worktable");
    const ids = (y: number) =>
      furnishedSceneOrder(m.objects, [{ id: "player", depth: y }]).map((o) =>
        "placement" in o ? o.placement.id : o.id,
      );
    expect(ids(60)).toEqual(["player", "table", "plant", "stool"]);
    expect(ids(80)).toEqual(["table", "plant", "player", "stool"]);
    expect(ids(110)).toEqual(["table", "plant", "stool", "player"]);
  });
  it("restores a safe player spawn after saved furniture covers the default start", async () => {
    const m = new FurnitureMotion([{ id: "bunk", asset: "bunk-bed", x: 80, y: 116 }]);
    expect(m.canStand(m.player.position.wx, m.player.position.wy)).toBe(true);
    expect(m.player.position).not.toEqual({ wx: 80, wy: 120 });
  });
  it("lands on finite-height furniture, stays on top, and falls when walking off", async () => {
    const m = scene("wardrobe");
    m.gravityScale = 0.25;
    // Approach from directly in front; walk toward it only after clearing its top.
    m.player.position = { wx: 80, wy: 98 };
    let maxZ = 0;
    for (let i = 0; i < 500; i++) {
      const z = m.player.wz ?? 0;
      await step(m, 0, z > 34 && m.player.position.wy > 84 ? -1 : 0, 1 / 120, true);
      maxZ = Math.max(maxZ, m.player.wz ?? 0);
    }
    expect(maxZ).toBeGreaterThan(32);
    expect(m.player.wz).toBe(32);
    expect(m.player.jumpVZ).toBeUndefined();
    for (let i = 0; i < 30; i++) await step(m, 0, 0);
    expect(m.player.wz).toBe(32);
    expect(() => m.setBody("wardrobe", { height: 40, walkableTop: true })).toThrow(/overlap/);
    for (let i = 0; i < 180; i++) await step(m, 1, 0);
    expect(m.player.wz).toBe(0);
    expect(m.player.jumpVZ).toBeUndefined();
  });
  it("normal gravity cannot clear the wardrobe, while lower gravity can", async () => {
    const peak = async (gravity: number) => {
      const m = scene("wardrobe");
      m.gravityScale = gravity;
      let highest = 0;
      for (let i = 0; i < 600; i++) {
        await step(m, 0, 0, 1 / 120, true);
        highest = Math.max(highest, m.player.wz ?? 0);
      }
      return highest;
    };
    expect(await peak(1)).toBeLessThan(32);
    expect(await peak(0.25)).toBeGreaterThan(64);
  }, 20000);
  it("height edits alter Z collision and reset clears airborne state", async () => {
    const m = scene("wardrobe");
    expect(m.canStand(80, 84, 31)).toBe(false);
    expect(m.canStand(80, 84, 32)).toBe(true);
    m.setBody("wardrobe", { height: 48, walkableTop: false });
    expect(m.canStand(80, 84, 32)).toBe(false);
    await step(m, 0, 0, 1 / 120, true);
    m.resetPlayer();
    expect(m.player.wz).toBe(0);
    expect(m.player.jumpVZ).toBeUndefined();
    expect(m.bodies.wardrobe).toEqual({ height: 48, walkableTop: false });
    expect(() => m.setBody("wardrobe", { height: NaN, walkableTop: true })).toThrow();
  });
  it("keeps the player in front across the full bed top and behind at ground level", async () => {
    const m = scene("bedside");
    const order = () =>
      furnishedSceneOrder(m.objects, [{ id: "player", depth: m.playerDepth() }]).map((o) =>
        "placement" in o ? o.placement.id : o.id,
      );
    for (const y of [64, 68, 74, 80, 88]) {
      m.player.position = { wx: 64, wy: y };
      m.player.wz = 8;
      m.player.groundZ = 8;
      await step(m, 0, 0);
      expect(m.player.wz).toBe(8);
      expect(order().indexOf("player")).toBeGreaterThan(order().indexOf("bed"));
    }
    m.player.position = { wx: 64, wy: 60 };
    m.player.wz = 0;
    expect(order().indexOf("player")).toBeLessThan(order().indexOf("bed"));
    const table = scene("worktable");
    table.player.position = { wx: 80, wy: 61 };
    table.player.wz = 10;
    expect(table.playerDepth()).toBeGreaterThan(72);
  });
  it("saves movement context without confusing it with a static approval", async () => {
    const m = scene("bunk");
    const report = {
      id: "test",
      caseId: "furniture-motion-bunk",
      fingerprint: "a".repeat(64),
      name: "Test",
      sketch: "#####\n#LLL#\n#####",
      verdict: "good",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
      furniture: m.furniture,
      furnitureCatalogVersion: 1,
      playtest: {
        playerX: 80,
        playerY: 94.2,
        playerZ: 24,
        groundZ: 24,
        gravityScale: 0.25,
        bodies: m.bodies,
        physicsVersion: 1,
        sceneSignature: "example",
        facing: 1,
        selected: "bunk",
        mode: "walk",
      },
    };
    expect(parseReviewFeedback(report).playtest).toEqual(report.playtest);
    expect(() =>
      parseReviewFeedback({ ...report, playtest: { ...report.playtest, playerX: NaN } }),
    ).toThrow(/playtest/);
  });
});
