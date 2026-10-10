import { describe, expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { projectWorld } from "../rendering/Projection.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import { TapMovement, touchMovementMode } from "./TapMovement.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe("tap movement intent", () => {
  it("walks with normal physics, brakes within the arrival tolerance and stays stopped", () => {
    const controller = new TapMovement();
    const p = createPlayer(0, 0);
    controller.setTarget({ wx: 100, wy: 60, wz: 0 });
    const context = {
      getCollision: () => 0,
      getHeight: () => 0,
      isEntityBlocked: () => false,
      isPropBlocked: () => false,
      noclip: false,
    };
    let arrived = false;
    for (let i = 0; i < 300; i++) {
      const input = controller.sample(p.position, idle, 1 / 60);
      stepPlayerFromInput(
        p,
        { ...input, dx: quantizeAxis(input.dx), dy: quantizeAxis(input.dy) },
        1 / 60,
        context,
        () => 0,
        () => ({ props: [], entities: [] }),
        { jumpConsumed: false, lastJumpHeld: false },
        getMovementPhysicsParams(),
      );
      if (!controller.target) arrived = true;
      if (arrived) expect(input.dx).toBe(0);
    }
    expect(arrived).toBe(true);
    expect(Math.hypot(p.position.wx - 100, p.position.wy - 60)).toBeLessThanOrEqual(8);
    expect(Math.hypot(p.velocity?.vx ?? 0, p.velocity?.vy ?? 0)).toBe(0);
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
    c.captureView(view, 32);
    const point = projectWorld(view, 130, 175, 32);
    view.x = 999;
    const canvas = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
    } as HTMLCanvasElement;
    expect(c.resolve(canvas, 10 + point.sx / 2, 20 + point.sy / 2)).toEqual({
      wx: 130,
      wy: 175,
      wz: 32,
    });
  });
  it("defaults missing or invalid saved preferences to Joystick", () => {
    for (const value of [null, undefined, "other", 1, "joystick"])
      expect(touchMovementMode(value)).toBe("joystick");
    expect(touchMovementMode("tap")).toBe("tap");
  });
});
