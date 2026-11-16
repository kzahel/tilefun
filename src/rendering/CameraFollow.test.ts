import { describe, expect, it } from "vitest";
import { Camera } from "./Camera.js";
import { advanceCameraFollow, type CameraFollowState } from "./CameraFollow.js";
import { onPixelGrid } from "./PixelGrid.js";

describe("camera settling on the top-down pixel grid", () => {
  for (const hz of [30, 60, 120]) {
    it.each([0.25, 0.5, 1, 1.3, 2])(
      `finishes without a delayed pixel pop at ${hz}Hz, zoom %s`,
      (zoom) => {
        // Include exact rounding ties and stops just either side of them. A stop
        // 0.0001px beyond a tie used to pop after ~1.45 seconds of no visible motion.
        for (const phase of [0, 0.25, 0.49, 0.4999, 0.5, 0.5001, 0.51, 0.75, 0.99]) {
          for (const direction of [-1, 1]) {
            const camera = new Camera();
            camera.zoom = zoom;
            const end = (100 + phase) / camera.scale;
            const stop = 1.5;
            let previousPixel = 0;
            let lastChange = stop;
            for (let n = 0; n <= hz * 4; n++) {
              const time = n / hz;
              const x = end - direction * 64 * Math.max(0, stop - time);
              camera.presentFollow(time, x, -x, "test");
              // This is the eye placement the unified renderer actually uses.
              const pixel = onPixelGrid(camera.x, camera.scale) * camera.scale;
              if (time >= stop) {
                expect(direction * (camera.x - x)).toBeLessThanOrEqual(1e-10);
                expect(camera.y).toBeCloseTo(-camera.x, 10);
                if (Math.abs(pixel - previousPixel) > 0.5) {
                  expect(time - lastChange).toBeLessThanOrEqual(0.15);
                  lastChange = time;
                }
                if (time >= stop + 0.75) expect(camera.x).toBe(end);
              }
              previousPixel = pixel;
            }
            expect(camera.x).toBe(end);
            expect(camera.y).toBe(-end);
          }
        }
      },
    );
  }

  it("retains the moving-target response, including slow movement and restarting after rest", () => {
    const camera = new Camera();
    let reference: CameraFollowState | null = null;
    for (let n = 0; n <= 180; n++) {
      const time = n / 60;
      // Slow enough that the entire follow error is less than a screen pixel.
      const x = time < 1 ? time * 0.2 : time < 2 ? 0.2 : 0.2 + (time - 2) * 64;
      reference = advanceCameraFollow(reference, time, x, x);
      camera.presentFollow(time, x, x, "test");
      if (time < 1) expect(camera.x).toBe(reference.x);
      if (time >= 1 + 1 / 60 && time <= 2) expect(camera.x).toBe(0.2);
      if (time > 2) {
        expect(camera.x).toBeGreaterThan(0.2);
        expect(camera.x).toBeLessThan(x);
        expect(Math.abs(camera.x - reference.x)).toBeLessThan(1 / camera.scale);
      }
    }
  });
});
