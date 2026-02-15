import { describe, expect, it } from "vitest";
import { Camera } from "./Camera.js";

describe("Camera", () => {
  it("worldToScreen places origin at viewport center when camera is at origin", () => {
    const cam = new Camera();
    cam.setViewport(800, 600);

    const s = cam.worldToScreen(0, 0);
    expect(s.sx).toBe(400);
    expect(s.sy).toBe(300);
  });

  it("worldToScreen offsets by camera position", () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.x = 100;
    cam.y = 50;

    // Looking at (100, 50), so that point should be at screen center
    const s = cam.worldToScreen(100, 50);
    expect(s.sx).toBe(400);
    expect(s.sy).toBe(300);

    // Origin should be offset left and up
    const o = cam.worldToScreen(0, 0);
    expect(o.sx).toBe(400 - 100 * 3); // PIXEL_SCALE = 3
    expect(o.sy).toBe(300 - 50 * 3);
  });

  it("screenToWorld is the inverse of worldToScreen", () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.x = 42;
    cam.y = -17;

    const screen = cam.worldToScreen(100, 200);
    const world = cam.screenToWorld(screen.sx, screen.sy);
    expect(world.wx).toBeCloseTo(100);
    expect(world.wy).toBeCloseTo(200);
  });

  it("screenToWorld converts screen corners to world coords", () => {
    const cam = new Camera();
    cam.setViewport(900, 600);
    cam.x = 0;
    cam.y = 0;

    // Top-left of screen -> world
    const tl = cam.screenToWorld(0, 0);
    expect(tl.wx).toBeCloseTo(-150); // -(900/2) / 3
    expect(tl.wy).toBeCloseTo(-100); // -(600/2) / 3
  });

  it("first follow snaps to target", () => {
    const cam = new Camera();
    cam.follow(100, 200, 0.5);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(200);
    expect(cam.prevX).toBe(100);
    expect(cam.prevY).toBe(200);
  });

  it("follow lerps toward target after first snap", () => {
    const cam = new Camera();
    // First follow snaps
    cam.follow(0, 0, 0.5);

    cam.follow(100, 200, 0.5);
    expect(cam.x).toBe(50);
    expect(cam.y).toBe(100);

    cam.follow(100, 200, 0.5);
    expect(cam.x).toBe(75);
    expect(cam.y).toBe(150);
  });

  it("follow with lerpFactor=1 snaps to target", () => {
    const cam = new Camera();
    cam.x = -50;
    cam.y = 30;

    cam.follow(100, 200, 1);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(200);
  });

  it("getVisibleChunkRange returns correct range", () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.x = 0;
    cam.y = 0;

    const range = cam.getVisibleChunkRange();
    // Visible world: ~266.67 x 200 pixels centered at origin
    // Top-left world: (-133.33, -100)  -> chunks (-1, -1)
    // Bottom-right world: (133.33, 100) -> chunks (0, 0)
    expect(range.minCx).toBe(-1);
    expect(range.maxCx).toBe(0);
    expect(range.minCy).toBe(-1);
    expect(range.maxCy).toBe(0);
  });

  it("getVisibleChunkRange shifts with camera position", () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.x = 512; // 2 chunks right
    cam.y = 256; // 1 chunk down

    const range = cam.getVisibleChunkRange();
    // Visible world center at (512, 256)
    // Top-left world: (512 - 133.33, 256 - 100) = (378.67, 156)
    // Bottom-right: (512 + 133.33, 256 + 100) = (645.33, 356)
    // Chunks: floor(378.67/256)=1, floor(645.33/256)=2
    //         floor(156/256)=0, floor(356/256)=1
    expect(range.minCx).toBe(1);
    expect(range.maxCx).toBe(2);
    expect(range.minCy).toBe(0);
    expect(range.maxCy).toBe(1);
  });
});
