import { describe, expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { collectPlayerMarkers } from "./PlayerMarkers.js";

const camera = new Camera();
camera.setViewport(800, 600);
camera.zoom = 1;
const player = (id: number, x: number, y: number) => ({ ...createPlayer(x, y), id });

describe("co-op location markers", () => {
  it("marks only other players, without relying on a name sync or including NPCs", () => {
    const local = player(1, 0, 0);
    const other = player(2, 40, 0);
    const markers = collectPlayerMarkers(camera, [local, other, createChicken(0, 0)], 1, {}, 1);
    expect(markers).toEqual([
      expect.objectContaining({ id: 2, name: "Player", offscreen: false, angle: Math.PI / 2 }),
    ]);
    expect(collectPlayerMarkers(camera, [local], 1, {}, 1)).toEqual([]);
  });

  it.each([
    [1000, 0, "east"],
    [-1000, 0, "west"],
    [0, -1000, "north"],
    [0, 1000, "south"],
    [1000, -1000, "northeast"],
    [-1000, -1000, "northwest"],
    [1000, 1000, "southeast"],
    [-1000, 1000, "southwest"],
  ])("keeps the %s,%s (%s) arrow on the inset edge and on the target ray", (x, y) => {
    const [marker] = collectPlayerMarkers(camera, [player(2, x, y)], 1, { 2: "Friend" }, 1);
    expect(marker).toBeDefined();
    if (!marker) return;
    expect(marker.offscreen).toBe(true);
    expect(marker.x).toBeGreaterThanOrEqual(28);
    expect(marker.x).toBeLessThanOrEqual(772);
    expect(marker.y).toBeGreaterThanOrEqual(28);
    expect(marker.y).toBeLessThanOrEqual(572);
    expect(Math.min(marker.x - 28, 772 - marker.x, marker.y - 28, 572 - marker.y)).toBeCloseTo(0);
    expect(Math.atan2(marker.y - 300, marker.x - 400)).toBeCloseTo(marker.angle);
    expect(marker.name).toBe("Friend");
  });

  it("follows displayed XY, jump/roof height, sprite height and zoom", () => {
    const other = player(2, 100, 50);
    other.prevPosition = { wx: 0, wy: 0 };
    other.wz = 40;
    other.prevWz = 20;
    const [marker] = collectPlayerMarkers(camera, [other], 1, {}, 0.5);
    const screen = camera.worldToScreen(50, 25 - 30);
    expect(marker?.x).toBe(screen.sx);
    expect(marker?.y).toBe(screen.sy - (other.sprite?.spriteHeight ?? 0) * camera.scale - 16);
    const zoomed = new Camera();
    zoomed.setViewport(800, 600);
    zoomed.zoom = 2;
    const [closer] = collectPlayerMarkers(zoomed, [other], 1, {}, 0.5);
    expect(closer?.x).toBe(zoomed.worldToScreen(50, 25).sx);
  });

  it("keeps a pointer for a partially visible sprite, then switches to an edge arrow", () => {
    const other = player(2, 0, 300 / camera.scale + 8);
    expect(collectPlayerMarkers(camera, [other], 1, {}, 1)[0]?.offscreen).toBe(false);
    other.position.wy += 100;
    expect(collectPlayerMarkers(camera, [other], 1, {}, 1)[0]?.offscreen).toBe(true);
    other.position = { wx: 0, wy: 0 };
    expect(collectPlayerMarkers(camera, [other], 1, {}, 1)[0]?.offscreen).toBe(false);
  });

  it("handles portrait resizing, camera offsets, pixel snapping and tiny viewports", () => {
    const portrait = new Camera();
    portrait.setViewport(390, 844);
    portrait.snapTo(200, 300);
    portrait.pixelSnap = true;
    const [marker] = collectPlayerMarkers(portrait, [player(2, 2000, -2000)], 1, {}, 1);
    expect(marker?.offscreen).toBe(true);
    expect(marker?.x).toBeLessThanOrEqual(362);
    expect(marker?.y).toBeGreaterThanOrEqual(28);
    portrait.setViewport(0, 0);
    expect(collectPlayerMarkers(portrait, [player(2, 0, 0)], 1, {}, 1)).toEqual([]);
  });
});
