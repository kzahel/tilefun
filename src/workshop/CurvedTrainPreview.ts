import type { RailAlignment } from "../railway/RailPath.js";
import type { Camera } from "../rendering/Camera.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
/** Lab-only town/platform markers. Tracks use the production terrain cache. */
export function drawCurvedRailLayout(
  frame: OverlayFrame,
  camera: Camera,
  alignment: RailAlignment,
) {
  const scale = camera.scale;
  const line = (x: number, y: number, x2: number, y2: number, color: string) => {
    const a = camera.worldToScreen(x, y),
      z = camera.worldToScreen(x2, y2);
    frame.line(a.sx, a.sy, z.sx, z.sy, color);
  };
  if (alignment.path.closed) {
    const town = camera.worldToScreen(-320, -224);
    frame.rect(town.sx, town.sy, 640 * scale, 448 * scale, "#c3cdbb", "#acb8a7");
    for (const x of [-240, -80, 80, 240])
      for (const y of [-144, 80]) {
        const p = camera.worldToScreen(x - 48, y - 40);
        frame.rect(p.sx, p.sy, 96 * scale, 80 * scale, "#a6b2a5", "#83988d");
      }
    const p = camera.worldToScreen(0, 0);
    frame.label("TOWN · layout placeholder", p.sx, p.sy, "#516760", "14px sans-serif", true);
  }
  for (const stop of alignment.path.stops) {
    const p = alignment.sample(stop.distance),
      nx = -Math.sin(p.angle),
      ny = Math.cos(p.angle);
    for (const offset of [40, 56, 72])
      line(
        p.x - Math.cos(p.angle) * 240 + nx * offset,
        p.y - Math.sin(p.angle) * 240 + ny * offset,
        p.x + Math.cos(p.angle) * 240 + nx * offset,
        p.y + Math.sin(p.angle) * 240 + ny * offset,
        "#8dada8",
      );
    const label = camera.worldToScreen(p.x + nx * 105, p.y + ny * 105);
    frame.label(stop.name, label.sx, label.sy, "#253b42", "bold 14px sans-serif", true);
  }
}
