import { describe, expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { projectWorld } from "../rendering/Projection.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import { TapMovement, touchMovementMode } from "./TapMovement.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe("tap movement intent", () => {
  it("walks with normal physics, brakes within the arrival tolerance and stays stopped", async () => {
    const controller = new TapMovement();
    const session = await ScenarioSession.create({
      version: 1,
      id: "tap-arrival",
      generation: FLAT_SCENARIO,
      player: createPlayer(0, 0),
      props: [],
    });
    const p = session.player.player;
    try {
      controller.setTarget({ wx: 100, wy: 60, wz: 0 });
      let arrived = false;
      for (let i = 0; i < 300; i++) {
        const input = controller.sample(p.position, idle, 1 / 60);
        await session.step({ ...input, dx: quantizeAxis(input.dx), dy: quantizeAxis(input.dy) });
        if (!controller.target) arrived = true;
        if (arrived) expect(input.dx).toBe(0);
      }
      expect(arrived).toBe(true);
      expect(Math.hypot(p.position.wx - 100, p.position.wy - 60)).toBeLessThanOrEqual(8);
      expect(Math.hypot(p.velocity?.vx ?? 0, p.velocity?.vy ?? 0)).toBeLessThan(0.01);
    } finally {
      await session.close();
    }
  });
  it("redirects immediately and preserves Jump and Sprint", () => {
    const c = new TapMovement();
    c.setTarget({ wx: 100, wy: 0, wz: 0 });
    expect(c.sample({ wx: 0, wy: 0 }, idle, 0.1).dx).toBe(1);
    c.setTarget({ wx: 0, wy: -100, wz: 0 });
    expect(c.sample({ wx: 0, wy: 0 }, { ...idle, jump: true, sprinting: true }, 0.1)).toEqual({
      ...idle,
      dy: -1,
      jump: true,
      sprinting: true,
    });
  });
  it("expires stalled walking and briefly retains blocked feedback", () => {
    const c = new TapMovement();
    c.setTarget({ wx: 100, wy: 0, wz: 0 });
    for (let i = 0; i < 50; i++) c.sample({ wx: 0, wy: 0 }, idle, 1 / 60);
    expect(c.target).toBeNull();
    expect(c.blockedTarget?.wx).toBe(100);
    expect(c.blockedFade).toBeGreaterThan(0);
    expect(c.sample({ wx: 0, wy: 0 }, idle, 0.5)).toEqual(idle);
    expect(c.blockedFade).toBe(0);
  });
  it("does not expire when steady progress is made", () => {
    const c = new TapMovement();
    c.setTarget({ wx: 1000, wy: 0, wz: 0 });
    for (let i = 0; i < 180; i++) c.sample({ wx: i * 0.2, wy: 0 }, idle, 1 / 60);
    expect(c.target?.wx).toBe(1000);
  });
  it("cancels on manual steering, near-feet taps and teleport", () => {
    const c = new TapMovement();
    c.setTarget({ wx: 100, wy: 0, wz: 0 });
    const manual = { ...idle, dx: -1 };
    expect(c.sample({ wx: 0, wy: 0 }, manual, 0.1)).toEqual(manual);
    expect(c.target).toBeNull();
    c.setTarget({ wx: 4, wy: 4, wz: 0 });
    expect(c.sample({ wx: 0, wy: 0 }, idle, 0.1)).toEqual(idle);
    c.setTarget({ wx: 500, wy: 0, wz: 0 });
    c.sample({ wx: 0, wy: 0 }, idle, 0.1);
    expect(c.sample({ wx: 80, wy: 0 }, idle, 0.1)).toEqual(idle);
    expect(c.target).toBeNull();
  });
  it("uses the captured presentation, CSS scaling and support plane after camera changes", () => {
    const c = new TapMovement();
    const view = {
      x: 100,
      y: 150,
      zoom: 1.3,
      pixelSnap: true,
      viewportWidth: 800,
      viewportHeight: 600,
    };
    c.captureView({ camera: view, region: { x: 0, y: 0, width: 800, height: 600 } }, 32);
    const point = projectWorld(view, 130, 175, 32);
    view.x = 999;
    const canvas = {
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
    } as HTMLCanvasElement;
    expect(c.resolve(canvas, 10 + point.sx / 2, 20 + point.sy / 2)).toEqual({
      wx: 130,
      wy: 175,
      wz: 32,
    });
  });
  it("resolves through a split view's region and ignores taps outside it (226)", () => {
    const c = new TapMovement();
    // The left half of a 1600×600 canvas shown at half size: the view's viewport is
    // its region, not the canvas.
    const camera = { x: 100, y: 150, zoom: 1, viewportWidth: 800, viewportHeight: 600 };
    const canvas = {
      width: 1600,
      height: 600,
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 300 }),
    } as HTMLCanvasElement;
    const point = projectWorld(camera, 130, 175, 0);
    c.captureView({ camera, region: { x: 0, y: 0, width: 800, height: 600 } }, 0);
    expect(c.resolve(canvas, 10 + point.sx / 2, 20 + point.sy / 2)).toEqual({
      wx: 130,
      wy: 175,
      wz: 0,
    });
    expect(c.resolve(canvas, 10 + 400 + point.sx / 2, 20 + point.sy / 2)).toBeNull();
    // A held contact that started in the view still resolves beyond its edge.
    // (800 canvas pixels right of the point: beyond the view's right edge.)
    const beyond = c.resolve(canvas, 10 + 400 + point.sx / 2, 20 + point.sy / 2, true);
    expect(beyond?.wx).toBeGreaterThan(130 + 800 / 2 / camera.zoom / 2);
    expect(beyond?.wy).toBeCloseTo(175);
    // A view in the right half resolves its own region's points.
    c.captureView({ camera, region: { x: 800, y: 0, width: 800, height: 600 } }, 0);
    expect(c.resolve(canvas, 10 + 400 + point.sx / 2, 20 + point.sy / 2)).toEqual({
      wx: 130,
      wy: 175,
      wz: 0,
    });
    expect(c.resolve(canvas, 10 + point.sx / 2, 20 + point.sy / 2)).toBeNull();
    // A canvas with no size resolves nothing.
    c.captureView({ camera, region: { x: 0, y: 0, width: 800, height: 600 } }, 0);
    const hidden = {
      ...canvas,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
    expect(c.resolve(hidden as HTMLCanvasElement, 10, 20)).toBeNull();
  });
  it("defaults missing or invalid saved preferences to Joystick", () => {
    for (const value of [null, undefined, "other", 1, "joystick"])
      expect(touchMovementMode(value)).toBe("joystick");
    expect(touchMovementMode("tap")).toBe("tap");
    expect(touchMovementMode("hold")).toBe("hold");
  });
});
